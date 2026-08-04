import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import pool from '../../config/db';
import type { PoolClient } from 'pg';
import { assertSitePermission, assertFaqChange, lockFaq } from './faq-permission';

const MAX_IMAGES_PER_FAQ = 5;

/**
 * ==========================================
 * FAQ画像 — 1FAQにつき複数枚（最大5枚）、自由アップロード
 * （URL指定不要）、uploads/faq-images/ に永続保存する。
 * ==========================================
 */

async function markFaqPendingIfStaff(client: PoolClient, faqId: number, user: any) {
    // 承認済みFAQの画像をスタッフが追加/削除した場合は「承認待ち」に戻す
    // （テキスト編集時と同じ挙動 — 画像だけ変更して承認フローを回避されないため）
    if (user.role !== 'admin') {
        await client.query(
            `UPDATE public.faq_master SET approval_status = 'pending', is_draft = FALSE, reviewed_by = NULL, reviewed_at = NULL, updated_at = NOW() WHERE id = $1`,
            [faqId]
        );
    }
}

export const uploadFaqImages = async (req: Request, res: Response) => {
    let client: PoolClient | undefined;
    let saved = false;
    const files = (req as any).files as Express.Multer.File[] | undefined;
    try {
        const user = (req as any).user;
        const { id } = req.params;

        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, message: "画像ファイルが選択されていません。" });
        }

        client = await pool.connect();
        await client.query('BEGIN');
        const faq = await lockFaq(client, String(id));
        if (!assertFaqChange(faq, res)) return;
        if (!await assertSitePermission(user, faq.site_id, res)) return;

        const countRes = await client.query('SELECT COUNT(*) AS cnt FROM public.faq_images WHERE faq_id = $1', [id]);
        const existingCount = Number(countRes.rows[0]?.cnt || 0);

        if (existingCount + files.length > MAX_IMAGES_PER_FAQ) {
            return res.status(400).json({
                success: false,
                message: `1つのFAQにつき画像は最大${MAX_IMAGES_PER_FAQ}枚までです（現在${existingCount}枚登録済み）。`,
            });
        }

        const maxOrderRes = await client.query('SELECT COALESCE(MAX(display_order), -1) AS max_order FROM public.faq_images WHERE faq_id = $1', [id]);
        let nextOrder = Number(maxOrderRes.rows[0]?.max_order ?? -1) + 1;

        const inserted = [];
        for (const file of files) {
            const relativePath = `/uploads/faq-images/${file.filename}`;
            const r = await client.query(
                `INSERT INTO public.faq_images (faq_id, image_path, display_order, created_at) VALUES ($1,$2,$3,NOW()) RETURNING id, image_path, display_order`,
                [id, relativePath, nextOrder]
            );
            inserted.push(r.rows[0]);
            nextOrder++;
        }

        await markFaqPendingIfStaff(client, Number(id), user);
        await client.query('COMMIT');
        saved = true;

        return res.json({ success: true, images: inserted, message: `${inserted.length}枚の画像をアップロードしました。` });
    } catch (error) {
        console.error("❌ FAQ画像アップロードでエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    } finally {
        if (client) {
            if (!saved) await client.query('ROLLBACK');
            client.release();
        }
        if (!saved) for (const file of files || []) { try { fs.unlinkSync(file.path); } catch { /* already removed */ } }
    }
};

export const getFaqImages = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const faq = await pool.query('SELECT site_id FROM public.faq_master WHERE id = $1', [id]);
        if (faq.rows.length === 0) {
            return res.status(404).json({ success: false, message: '対象のFAQが見つかりません。' });
        }
        if (!await assertSitePermission((req as any).user, faq.rows[0].site_id, res)) return;
        const result = await pool.query(
            'SELECT id, image_path, display_order FROM public.faq_images WHERE faq_id = $1 ORDER BY display_order ASC, id ASC',
            [id]
        );
        return res.json({ success: true, images: result.rows });
    } catch (error) {
        console.error("❌ FAQ画像取得でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    }
};

export const deleteFaqImage = async (req: Request, res: Response) => {
    let client: PoolClient | undefined;
    let saved = false;
    try {
        const user = (req as any).user;
        const { id, imageId } = req.params;
        client = await pool.connect();
        await client.query('BEGIN');
        const faq = await lockFaq(client, String(id));
        if (!assertFaqChange(faq, res)) return;
        if (!await assertSitePermission(user, faq.site_id, res)) return;

        const imgRes = await client.query(
            `SELECT fi.id, fi.image_path, f.site_id, f.id AS faq_id
             FROM public.faq_images fi
             JOIN public.faq_master f ON f.id = fi.faq_id
             WHERE fi.id = $1 AND fi.faq_id = $2`,
            [imageId, id]
        );
        if (imgRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "対象の画像が見つかりません。" });
        }

        const ok = await assertSitePermission(user, imgRes.rows[0].site_id, res);
        if (!ok) return;

        await client.query('DELETE FROM public.faq_images WHERE id = $1', [imageId]);
        await markFaqPendingIfStaff(client, imgRes.rows[0].faq_id, user);
        await client.query('COMMIT');
        saved = true;

        try {
            const filePath = path.join(process.cwd(), imgRes.rows[0].image_path.replace(/^\//, ''));
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (fsErr) {
            console.warn("⚠️ 物理ファイルの削除に失敗（DBデータには影響なし）:", fsErr);
        }

        return res.json({ success: true, message: "画像を削除しました。" });
    } catch (error) {
        console.error("❌ FAQ画像削除でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    } finally {
        if (client) {
            if (!saved) await client.query('ROLLBACK');
            client.release();
        }
    }
};
