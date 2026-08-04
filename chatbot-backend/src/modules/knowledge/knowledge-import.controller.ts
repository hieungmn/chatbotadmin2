import type { Request, Response } from 'express';
import path from 'node:path';
import { importKnowledgeFile } from './knowledge-import.service';
import { KnowledgeFileReadError } from './file-extraction-error';
import { AiBusyError } from '../ai/ollama.service';

/** Finish extraction, embeddings and storage before reporting upload success. */
export async function uploadKnowledgeFile(req: Request, res: Response) {
    const file = req.file;
    const siteId = typeof req.body?.site_id === 'string' ? req.body.site_id.trim().toLowerCase() : '';
    if (!file || !siteId || siteId.length > 50) return res.status(400).json({ success: false, message: 'File and site are required.' });
    const user = (req as any).user;
    const extension = path.extname(file.originalname).toLowerCase();
    const type = extension === '.docx' ? 'word' : ['.xlsx', '.xls'].includes(extension) ? 'excel' : extension === '.pdf' ? 'pdf' : 'txt';
    try {
        const result = await importKnowledgeFile({ siteId, name: file.originalname, type, path: file.path,
            userId: user.id, approval: user.role === 'admin' ? 'approved' : 'pending' });
        return res.status(201).json({ success: true, ...result, message: 'アップロードが完了しました。' });
    } catch (error) {
        if (error instanceof AiBusyError) {
            res.setHeader('Retry-After', 5);
            return res.status(503).json({ success: false, code: 'SERVER_BUSY',
                message: '現在AIが処理中です。少し待ってから再度お試しください。' });
        }
        console.error('Knowledge upload failed:', error);
        return res.status(error instanceof KnowledgeFileReadError ? 400 : 500).json({ success: false,
            message: error instanceof KnowledgeFileReadError ? error.message : '取込に失敗しました。Ollamaの稼働を確認し、もう一度アップロードしてください。' });
    }
}
