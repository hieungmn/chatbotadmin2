import pool from '../../config/db';
import { CAPACITY } from '../../config/capacity';
import { getEmbedding } from "../ai/ollama.service";
import { extractKnowledgeDocument } from './file-extraction';
import { KnowledgeFileReadError } from './file-extraction-error';
export async function importKnowledgeFile(input: {
    siteId: string; name: string; type: string; path: string; userId: number; approval: string;
}) {
    const { chunks, warnings } = await extractKnowledgeDocument(input.path, input.name, input.type);
    if (!chunks.length) throw new KnowledgeFileReadError('読み取れる本文がありません。ファイルの内容を確認してください。');
    if (CAPACITY.knowledgeMaxChunks > 0 && chunks.length > CAPACITY.knowledgeMaxChunks) {
        throw new KnowledgeFileReadError(`A knowledge import is limited to ${CAPACITY.knowledgeMaxChunks} chunks. Please split the document.`);
    }
    // AI calls happen before opening a transaction; failure leaves no partial document.
    const rows: unknown[][] = [];
    for (const [index, chunk] of chunks.entries()) {
        const embedding = await getEmbedding(chunk.text);
        if (embedding.length !== 768 || !embedding.every(Number.isFinite)) throw new Error('Invalid knowledge embedding.');
        rows.push([index, chunk.text, JSON.stringify(embedding), chunk.sectionId ?? null,
            chunk.headingPath?.join(' / ') || null, chunk.pageNumber ?? null,
            chunk.sheetName ?? null, chunk.rowNumber ?? null]);
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const file = await client.query(`INSERT INTO public.site_knowledge_files
            (site_id, file_name, file_type, file_path, status, approval_status, uploaded_by)
            VALUES ($1,$2,$3,'','completed',$4,$5) RETURNING id`,
            [input.siteId, input.name.slice(0, 255), input.type, input.approval, input.userId]);
        const fileId = file.rows[0].id;
        for (let offset = 0; offset < rows.length; offset += 128) {
            const batch = rows.slice(offset, offset + 128);
            const values = batch.map((_, index) =>
                '(' + Array.from({ length: 10 }, (_, column) => `$${index * 10 + column + 1}`).join(',') + ')');
            await client.query(`INSERT INTO public.site_knowledge_chunks
                (file_id, site_id, chunk_index, content_text, embedding,
                 section_id, section_title, page_number, sheet_name, row_number)
                VALUES ${values.join(',')}`, batch.flatMap(row => [fileId, input.siteId, ...row]));
        }
        await client.query('COMMIT');
        return { file_id: fileId, chunk_count: rows.length, warnings };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally { client.release(); }
}
