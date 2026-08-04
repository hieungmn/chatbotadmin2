import type { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';
import { CAPACITY } from '../config/capacity';

export const apiErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (res.headersSent) { _next(err); return; }
    if (err instanceof MulterError) {
        const oversized = err.code === 'LIMIT_FILE_SIZE';
        res.status(oversized ? 413 : 400).json({ success: false, code: err.code,
            message: oversized ? `Knowledge files must be ${CAPACITY.knowledgeFileBytes / 1024 / 1024} MiB or smaller.` : 'Invalid multipart upload.' });
        return;
    }
    if (err?.type === 'entity.too.large') {
        res.status(413).json({ success: false, code: 'BODY_TOO_LARGE', message: 'Request body is too large.' });
        return;
    }
    if (err?.type === 'entity.parse.failed') {
        res.status(400).json({ success: false, message: 'Invalid JSON body.' });
        return;
    }
    if (err?.code === 'UNSUPPORTED_KNOWLEDGE_FILE') {
        res.status(415).json({ success: false, code: err.code, message: 'Supported files: .docx, .xlsx, .xls, .txt, .pdf.' });
        return;
    }
    console.error('Unhandled API error.');
    res.status(500).json({ success: false, message: 'Internal server error.' });
};
