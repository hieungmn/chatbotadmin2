import { Request, Response } from 'express';
import pool from '../../config/db';
import type { PoolClient } from 'pg';
import { computeFaqEmbedding } from './faq-embedding';
import { assertSitePermission, parseAllowedSiteIds, lockFaq, assertFaqChange } from './faq-permission';

/**
 * ==========================================
 * 5. FAQ一覧の取得（サイト指定によるフィルタ）
 * ==========================================
 */
export const getFaqMasterList = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const explicitSiteId = req.query.site_id ? String(req.query.site_id).trim().toLowerCase() : null;
        const allowedSiteIds = parseAllowedSiteIds(req);

        const conditions: string[] = [];
        const queryParams: any[] = [];

        if (explicitSiteId) {
            if (user && user.role !== 'admin') {
                const permCheck = await pool.query(
                    'SELECT 1 FROM public.user_site_permissions WHERE user_id = $1 AND site_id = $2',
                    [user.id, explicitSiteId]
                );
                if (permCheck.rows.length === 0) {
                    return res.status(403).json({ success: false, message: `サイト [${explicitSiteId}] のデータを閲覧する権限がありません。` });
                }
            }
            conditions.push(`f.site_id = $${queryParams.length + 1}`);
            queryParams.push(explicitSiteId);
        } else if (user && user.role !== 'admin') {
            if (allowedSiteIds.length > 0) {
                conditions.push(`f.site_id = ANY($${queryParams.length + 1})`);
                queryParams.push(allowedSiteIds);
            } else {
                return res.json({ success: true, faqs: [] });
            }
        }

        let queryStr = `
            SELECT f.id, f.data_id, f.site_id, f.category, f.question, f.keywords, f.answer_text,
                   f.redirect_url, f.is_draft, f.approval_status, f.import_batch_id,
                   b.file_name AS batch_file_name, b.approval_status AS batch_approval_status, f.created_at,
                   COALESCE((SELECT COUNT(*) FROM public.faq_images fi WHERE fi.faq_id = f.id), 0) AS image_count
            FROM public.faq_master f
            LEFT JOIN public.faq_import_batches b ON b.id = f.import_batch_id
        `;
        if (conditions.length > 0) queryStr += ' WHERE ' + conditions.join(' AND ');
        queryStr += ' ORDER BY f.id DESC';

        const resDb = await pool.query(queryStr, queryParams);
        return res.json({ success: true, faqs: resDb.rows });
    } catch (error) {
        console.error("❌ FAQ一覧取得でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    }
};

/**
 * ==========================================
 * 6. FAQ詳細の取得（ID指定）
 * ==========================================
 */
export const getFaqMasterById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const resDb = await pool.query(`
            SELECT id, data_id, site_id, category, question, keywords, answer_text, redirect_url,
                   is_draft, approval_status, created_at, updated_at
            FROM public.faq_master
            WHERE id = $1;
        `, [id]);

        if (resDb.rows.length === 0) {
            return res.status(404).json({ success: false, message: "データが見つかりません。" });
        }

        if (!await assertSitePermission((req as any).user, resDb.rows[0].site_id, res)) return;

        const imagesRes = await pool.query(
            'SELECT id, image_path, display_order FROM public.faq_images WHERE faq_id = $1 ORDER BY display_order ASC, id ASC',
            [id]
        );

        return res.json({ success: true, faq: { ...resDb.rows[0], images: imagesRes.rows } });
    } catch (error) {
        console.error("❌ FAQ詳細取得でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    }
};

/**
 * ==========================================
 * 7. FAQの直接新規作成（Excelを介さない）
 *    管理者 → 即承認、スタッフ → 承認待ち
 * ==========================================
 */
export const createFaqItem = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { site_id, data_id, category, question, keywords, answer_text, redirect_url, is_draft } = req.body;

        const cleanSiteId = String(site_id || '').trim().toLowerCase();
        if (!cleanSiteId || !question || !answer_text) {
            return res.status(400).json({ success: false, message: "サイト・質問・回答は必須項目です。" });
        }

        const ok = await assertSitePermission(user, cleanSiteId, res);
        if (!ok) return;

        // data_idはタイムスタンプで自動生成される（FAQ_MANUAL_...）ため重複せず、
        // data_idのみのチェックでは同一質問の重複作成を防げない。質問の「内容」
        // （大文字小文字・余分な空白を無視）も同一サイト内で重複していないか確認する。
        const dupCheck = await pool.query(
            `SELECT id FROM public.faq_master
             WHERE site_id = $1 AND LOWER(TRIM(question)) = LOWER(TRIM($2))
             LIMIT 1`,
            [cleanSiteId, question]
        );
        if (dupCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: `同じ質問内容のFAQが既に存在します（ID: ${dupCheck.rows[0].id}）。編集はFAQ管理画面から行ってください。`,
            });
        }

        const finalDataId = String(data_id || '').trim() || `FAQ_MANUAL_${Date.now()}`;
        const approvalStatus = user.role === 'admin' ? 'approved' : 'pending';
        const embeddingVector = await computeFaqEmbedding(question, keywords || '');

        const resDb = await pool.query(`
            INSERT INTO public.faq_master (data_id, site_id, category, question, keywords, answer_text, redirect_url, is_draft, approval_status, created_by, embedding, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::vector,NOW(),NOW())
            RETURNING id, data_id, site_id, category, question, keywords, answer_text, redirect_url, is_draft, approval_status, created_at
        `, [
            finalDataId, cleanSiteId, category || '一般', question,
            keywords || '', answer_text, redirect_url || null, user.role === 'admin' && Boolean(is_draft), approvalStatus, user.id, embeddingVector,
        ]);

        

        return res.json({ success: true, faq: resDb.rows[0], message: approvalStatus === 'pending' ? "FAQを作成しました（承認待ち）。" : "FAQを作成しました。" });
    } catch (error: any) {
        if (error.code === '23505') {
            return res.status(400).json({ success: false, message: "同じdata_idのFAQが既に存在します。" });
        }
        console.error("❌ FAQ新規作成でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    }
};

/**
 * ==========================================
 * 8. FAQ内容の更新
 *    スタッフが編集 → 'pending'に戻る（再承認が必要）、管理者が編集 → 即'approved'
 * ==========================================
 */
export const updateFaqItem = async (req: Request, res: Response) => {
    let client: PoolClient | undefined;
    try {
        const user = (req as any).user;
        const { id } = req.params;
        const { category, question, keywords, answer_text, redirect_url, is_draft } = req.body;

        const existing = await pool.query(`SELECT f.site_id, f.approval_status, f.import_batch_id,
            b.approval_status AS batch_approval_status FROM public.faq_master f
            LEFT JOIN public.faq_import_batches b ON b.id = f.import_batch_id WHERE f.id = $1`, [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: "対象のFAQが見つかりません。" });
        }

        const ok = await assertSitePermission(user, existing.rows[0].site_id, res);
        if (!ok) return;
        if (!assertFaqChange(existing.rows[0], res)) return;

        const dupCheck = await pool.query(
            `SELECT id FROM public.faq_master
             WHERE site_id = $1 AND LOWER(TRIM(question)) = LOWER(TRIM($2)) AND id != $3
             LIMIT 1`,
            [existing.rows[0].site_id, question, id]
        );
        if (dupCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: `同じ質問内容の別のFAQが既に存在します（ID: ${dupCheck.rows[0].id}）。`,
            });
        }

        const approvalStatus = user.role === 'admin' ? 'approved' : 'pending';
        const reviewedBy = user.role === 'admin' ? user.id : null;
        const embeddingVector = await computeFaqEmbedding(question, keywords || '');

        client = await pool.connect();
        await client.query('BEGIN');
        if (!assertFaqChange(await lockFaq(client, String(id)), res)) {
            await client.query('ROLLBACK');
            return;
        }
        const resDb = await client.query(`
            UPDATE public.faq_master
            SET category = $1, question = $2, keywords = $3, answer_text = $4,
                redirect_url = $5, is_draft = $6, approval_status = $7,
                reviewed_by = $8::int,
                reviewed_at = CASE WHEN $8::int IS NOT NULL THEN NOW() ELSE NULL END,
                embedding = COALESCE($10::vector, embedding),
                updated_at = NOW()
            WHERE id = $9::int
            RETURNING id, data_id, site_id, category, question, keywords, answer_text, redirect_url, is_draft, approval_status, created_at
        `, [category || '一般', question, keywords || '', answer_text, redirect_url || null, user.role === 'admin' && Boolean(is_draft), approvalStatus, reviewedBy, id, embeddingVector]);
        await client.query('COMMIT');

        return res.json({ success: true, faq: resDb.rows[0], message: approvalStatus === 'pending' ? "FAQを更新しました(再承認待ち)。" : "FAQを更新しました。" });
    } catch (error: any) {
        await client?.query('ROLLBACK');
        console.error("❌ FAQ更新でエラー:", error);
        return res.status(500).json({ success: false, message: error?.message ? `サーバーエラー: ${error.message}` : "サーバーエラーが発生しました。" });
    } finally {
        client?.release();
    }
};

/**
 * ==========================================
 * 9. FAQ個別の承認／却下（管理者のみ）
 * ==========================================
 */
export const reviewFaqItem = async (req: Request, res: Response) => {
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
        if (!assertFaqChange(await lockFaq(client, String(id)), res, true)) {
            await client.query('ROLLBACK');
            return;
        }
        const resDb = await client.query(`
            UPDATE public.faq_master SET approval_status = $1::varchar, reviewed_by = $2, reviewed_at = NOW(),
                is_draft = CASE WHEN $1::varchar = 'approved' THEN FALSE ELSE is_draft END
            WHERE id = $3
            RETURNING id
        `, [newStatus, user.id, id]);

        if (resDb.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: "対象のFAQが見つかりません。" });
        }
        await client.query('COMMIT');
        return res.json({ success: true, message: approve ? "承認しました。" : "却下しました。" });
    } catch (error) {
        await client?.query('ROLLBACK');
        console.error("❌ FAQ承認処理でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    } finally {
        client?.release();
    }
};

/**
 * ==========================================
 * 10. FAQの完全削除
 * ==========================================
 */
export const deleteFaqMasterItem = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { id } = req.params;

        const existing = await pool.query('SELECT site_id FROM public.faq_master WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: "対象のFAQが見つかりません。" });
        }

        const ok = await assertSitePermission(user, existing.rows[0].site_id, res);
        if (!ok) return;

        await pool.query('DELETE FROM public.faq_master WHERE id = $1', [id]);
        return res.json({ success: true, message: "FAQを削除しました。" });
    } catch (error) {
        console.error("❌ FAQ削除でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    }
};
