import { Request, Response } from 'express';
import pool from '../../config/db';
import { getEmbedding } from "../ai/ollama.service";

/**
 * 1件のFAQのembeddingを計算する（question + keywords を代表テキストとして使用）。
 * ここでのエラーがFAQ作成/更新処理全体を止めてはいけない — Ollamaがエラーの
 * 場合はnullを返し、FAQ自体は通常通り保存する（embedding検索TOP5には次回の
 * 再計算成功まで参加できないだけ）。
 */
export async function computeFaqEmbedding(question: string, keywords: string): Promise<string | null> {
    try {
        const vector = await getEmbedding(`${question}\n${keywords || ''}`.trim());
        if (Array.isArray(vector) && vector.length > 0) {
            return `[${vector.join(',')}]`;
        }
        return null;
    } catch (err) {
        console.warn('⚠️ Không tính được embedding cho FAQ (không chặn lưu dữ liệu):', err);
        return null;
    }
}

/**
 * ==========================================
 * 16.既存FAQのembedding再生成（未生成のもの向け）
 *     管理者のみ、DBマイグレーション後に1回実行する。
 * ==========================================
 */
export const backfillFaqEmbeddings = async (req: Request, res: Response) => {
    try {
        const siteId = req.query.site_id ? String(req.query.site_id).trim().toLowerCase() : null;

        const conditions = ['embedding IS NULL'];
        const params: any[] = [];
        if (siteId) {
            conditions.push(`site_id = $${params.length + 1}`);
            params.push(siteId);
        }

        const rows = await pool.query(
            `SELECT id, question, keywords FROM public.faq_master WHERE ${conditions.join(' AND ')}`,
            params
        );

        let updated = 0;
        let failed = 0;
        for (const row of rows.rows) {
            const vector = await computeFaqEmbedding(row.question, row.keywords || '');
            if (vector) {
                await pool.query('UPDATE public.faq_master SET embedding = $1::vector WHERE id = $2', [vector, row.id]);
                updated++;
            } else {
                failed++;
            }
        }

        return res.json({ success: true, total: rows.rows.length, updated, failed });
    } catch (error) {
        console.error("❌ FAQ embedding再生成でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    }
};
