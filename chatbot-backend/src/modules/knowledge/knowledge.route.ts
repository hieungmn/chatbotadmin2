import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { knowledgeImportLimit } from '../../middlewares/rate-limit.middleware';
import { uploadKnowledgeFile } from './knowledge-import.controller';
import { CAPACITY } from '../../config/capacity';
import { decodeUploadFilename } from './upload-filename';
import { checkSitePermission, requireAdmin, verifyToken } from '../../middlewares/auth.middleware';
import { deleteKnowledgeFile, getKnowledgeFileChunks, getKnowledgeFiles, reviewKnowledgeFile } from './knowledge-files.controller';

const router = Router();
const tempDir = path.resolve(process.env.KNOWLEDGE_UPLOAD_TEMP_DIR || '.knowledge-tmp');
fs.mkdirSync(tempDir, { recursive: true });
const upload = multer({ dest: tempDir,
    limits: { fileSize: CAPACITY.knowledgeFileBytes, files: 1, fields: 4, fieldSize: 4096, parts: 6 },
    fileFilter: (_req, file, done) => {
        file.originalname = decodeUploadFilename(file.originalname);
        if (['.docx', '.xlsx', '.xls', '.txt', '.pdf'].includes(path.extname(file.originalname).toLowerCase())) done(null, true);
        else done(Object.assign(new Error('Unsupported knowledge file.'), { code: 'UNSUPPORTED_KNOWLEDGE_FILE' }));
    },
});
async function discardUpload(file?: Express.Multer.File) {
    if (file) await fs.promises.rm(file.path, { force: true }).catch(() => console.error('Temporary knowledge file cleanup failed.'));
}

// アップロード: ログイン ＋ サイト権限のみで可能。
// スタッフがアップロードした内容は自動的に 'pending'（承認待ち）になる（controller側で処理）。
router.post(
    '/upload',
    verifyToken,
    knowledgeImportLimit,
    upload.single('file'),
    async (req, res, next) => {
        let allowed = false;
        await checkSitePermission(req, res, () => { allowed = true; next(); });
        // Cleanup also runs if a denied client's HTTP connection has already closed.
        if (!allowed) await discardUpload(req.file);
    },
    async (req, res) => {
        try { await uploadKnowledgeFile(req, res); }
        finally { await discardUpload(req.file); }
    }
);

router.get('/files', verifyToken, checkSitePermission, getKnowledgeFiles);
router.get('/files/:id/chunks', verifyToken, getKnowledgeFileChunks);

// 承認／却下 — 管理者のみ
router.post('/files/:id/review', verifyToken, requireAdmin, reviewKnowledgeFile);

// 削除 — サイト権限はcontroller内で確認
router.delete('/files/:id', verifyToken, deleteKnowledgeFile);

export default router;
