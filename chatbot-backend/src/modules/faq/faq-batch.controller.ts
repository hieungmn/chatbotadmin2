import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../../config/db';
import { importFaqRows } from './faq-import.service';
import { assertSitePermission } from './faq-permission';

export interface ExcelFaqRowInput {
    data_id: string;
    site_id?: string;
    category?: string;
    question?: string;
    keywords?: string;
    answer_text?: string;
    redirect_url?: string;
    is_draft?: boolean;
}

/**
 * ==========================================
 * 1. Excelからの新規FAQ一括アップロード（既存データは削除しない）
 *    - site_idは必ず実在するサイトを指定（スタッフは権限のあるサイトのみ）
 *    - アップロードごとに faq_import_batches に1件記録（ファイル名表示、ロット単位で削除可能）
 *    - Excel内のsite_idが選択中サイトと異なる行はスキップ（件数を明示、誤って別サイトに紐付けない）
 *    - 同一サイト内でdata_idが重複する場合はスキップ（暗黙の上書きはしない）
 *    - 管理者アップロード → 即承認、スタッフアップロード → 承認待ち
 * ==========================================
 */
export const syncFaqDatabase = async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        const user = (req as any).user;
        const { site_id, file_name, faq_list }: { site_id: string; file_name: string; faq_list: ExcelFaqRowInput[] } = req.body;

        if (!site_id || !file_name || !faq_list || !Array.isArray(faq_list) || faq_list.length === 0) {
            return res.status(400).json({ success: false, message: "リクエストデータが不正です。" });
        }

        const cleanSiteId = String(site_id).trim().toLowerCase();

        const siteCheck = await client.query('SELECT 1 FROM public.sites WHERE site_id = $1', [cleanSiteId]);
        if (siteCheck.rows.length === 0) {
            return res.status(400).json({ success: false, message: `サイト [${cleanSiteId}] は存在しません。` });
        }

        const ok = await assertSitePermission(user, cleanSiteId, res);
        if (!ok) return;

        const approvalStatus = user.role === 'admin' ? 'approved' : 'pending';

        await client.query('BEGIN');

        const batchRes = await client.query(`
            INSERT INTO public.faq_import_batches (site_id, file_name, row_count, skipped_count, uploaded_by, approval_status)
            VALUES ($1, $2, 0, 0, $3, $4)
            RETURNING id
        `, [cleanSiteId, file_name, user.id, approvalStatus]);
        const batchId = batchRes.rows[0].id;

        const { inserted, skipped } = await importFaqRows(client, batchId, cleanSiteId, user, approvalStatus, faq_list);

        await client.query(
            'UPDATE public.faq_import_batches SET row_count = $1, skipped_count = $2 WHERE id = $3',
            [inserted, skipped, batchId]
        );

        await client.query('COMMIT');

        

        return res.json({
            success: true,
            batch_id: batchId,
            inserted,
            skipped,
            approval_status: approvalStatus,
            message: skipped > 0
                ? `${inserted}件を取り込みました（${skipped}件は対象サイトと不一致または重複のためスキップ）。`
                : `${inserted}件のFAQを取り込みました。`
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ FAQロットアップロードでエラー:", error);
        return res.status(500).json({ success: false, message: "アップロードに失敗しました。" });
    } finally {
        client.release();
    }
};

/**
 * ==========================================
 * 2. あるサイトのアップロード済みロット一覧
 * ==========================================
 */
export const getFaqBatches = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const siteId = req.query.site_id ? String(req.query.site_id).trim().toLowerCase() : null;

        if (!siteId) {
            return res.json({ success: true, batches: [] });
        }

        if (user.role !== 'admin') {
            const permCheck = await pool.query(
                'SELECT 1 FROM public.user_site_permissions WHERE user_id = $1 AND site_id = $2',
                [user.id, siteId]
            );
            if (permCheck.rows.length === 0) {
                return res.status(403).json({ success: false, message: `サイト [${siteId}] のデータを閲覧する権限がありません。` });
            }
        }

        const resDb = await pool.query(`
            SELECT b.id, b.site_id, b.file_name, b.row_count, b.skipped_count, b.approval_status,
                   b.created_at, u.username AS uploaded_by_username,
                   r.username AS reviewed_by_username, b.reviewed_at
            FROM public.faq_import_batches b
            LEFT JOIN public.admin_users u ON u.id = b.uploaded_by
            LEFT JOIN public.admin_users r ON r.id = b.reviewed_by
            WHERE b.site_id = $1
            ORDER BY b.created_at DESC
        `, [siteId]);

        return res.json({ success: true, batches: resDb.rows });
    } catch (error) {
        console.error("❌ FAQロット一覧取得でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    }
};

/**
 * ==========================================
 * 3. アップロードロットの削除（配下のFAQも連動削除 — ON DELETE CASCADE）
 * ==========================================
 */
export const deleteFaqBatch = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { id } = req.params;

        const existing = await pool.query('SELECT site_id FROM public.faq_import_batches WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: "対象のファイルが見つかりません。" });
        }

        const ok = await assertSitePermission(user, existing.rows[0].site_id, res);
        if (!ok) return;

        await pool.query('DELETE FROM public.faq_import_batches WHERE id = $1', [id]);
        return res.json({ success: true, message: "ファイルと関連するFAQを削除しました。" });
    } catch (error) {
        console.error("❌ FAQロット削除でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    }
};

/**
 * ==========================================
 * 4. アップロードロットの承認／却下（管理者のみ、配下の全FAQに反映）
 * ==========================================
 */
export const reviewFaqBatch = async (req: Request, res: Response) => {
    let client: PoolClient | undefined;
    try {
        const user = (req as any).user;
        const { id } = req.params;
        const { approve } = (req.body || {}) as { approve?: boolean };
        if (typeof approve !== 'boolean') {
            return res.status(400).json({ success: false, message: 'approve は真偽値を指定してください。' });
        }
        const newStatus = approve ? 'approved' : 'rejected';

        client = await pool.connect();
        await client.query('BEGIN');
        const existing = await client.query('SELECT id FROM public.faq_import_batches WHERE id = $1 FOR UPDATE', [id]);
        if (existing.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: "対象のファイルが見つかりません。" });
        }

        await client.query(
            'UPDATE public.faq_import_batches SET approval_status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3',
            [newStatus, user.id, id]
        );
        await client.query(
            "UPDATE public.faq_master SET approval_status = $1::varchar, reviewed_by = $2, reviewed_at = NOW(), is_draft = CASE WHEN $1::varchar = 'approved' THEN FALSE ELSE is_draft END WHERE import_batch_id = $3",
            [newStatus, user.id, id]
        );

        await client.query('COMMIT');

        return res.json({ success: true, message: approve ? "承認しました。" : "却下しました。" });
    } catch (error) {
        await client?.query('ROLLBACK');
        console.error("❌ FAQロット承認処理でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    } finally {
        client?.release();
    }
};
