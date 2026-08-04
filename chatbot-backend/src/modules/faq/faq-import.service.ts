import type { PoolClient } from 'pg';
import type { ExcelFaqRowInput } from './faq-batch.controller';
import { computeFaqEmbedding } from './faq-embedding';

export async function importFaqRows(client: PoolClient, batchId: number, cleanSiteId: string, user: { id: number }, approvalStatus: string, faq_list: ExcelFaqRowInput[]) {
    let inserted = 0;
    let skipped = 0;

    for (const item of faq_list) {
        // Excelにsite_id列があり、選択中のサイトと異なる場合はスキップ（二重チェック）
        const rowSiteId = item.site_id ? String(item.site_id).trim().toLowerCase() : cleanSiteId;
        if (rowSiteId !== cleanSiteId) {
            skipped++;
            continue;
        }

        const dataId = String(item.data_id || '').trim();
        if (!dataId) { skipped++; continue; }

        const category = String(item.category || '一般').trim();
        const question = String(item.question || '').trim();
        const keywords = String(item.keywords || '').trim();
        const answerText = String(item.answer_text || '').trim();
        const redirectUrl = String(item.redirect_url || '').trim();
        const isDraft = false;

        if (!question || !answerText) { skipped++; continue; }

        // 同一サイト内で質問内容が重複していないか確認（data_idだけでなく内容も
        // チェック — 同じファイルの再アップロードや内容が同一の別ファイルで
        // 重複FAQが量産されるのを防ぐ）
        const dupCheck = await client.query(
            `SELECT 1 FROM public.faq_master
                 WHERE site_id = $1 AND LOWER(TRIM(question)) = LOWER(TRIM($2))
                 LIMIT 1`,
            [cleanSiteId, question]
        );
        if (dupCheck.rows.length > 0) {
            skipped++;
            continue;
        }

        const embeddingVector = await computeFaqEmbedding(question, keywords);

        const insertRes = await client.query(`
                INSERT INTO public.faq_master (
                    data_id, site_id, import_batch_id, category, question, keywords,
                    answer_text, redirect_url, is_draft, approval_status, created_by, embedding, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::vector,NOW(),NOW())
                ON CONFLICT (site_id, data_id) DO NOTHING
                RETURNING id
            `, [dataId, cleanSiteId, batchId, category, question, keywords, answerText, redirectUrl || null, isDraft, approvalStatus, user.id, embeddingVector]);

        if (insertRes.rows.length > 0) inserted++;
        else skipped++;
    }

    return { inserted, skipped };
}
