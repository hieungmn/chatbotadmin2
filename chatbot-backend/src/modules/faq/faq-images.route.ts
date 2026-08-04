import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { verifyToken } from '../../middlewares/auth.middleware';
import { deleteFaqImage, getFaqImages, uploadFaqImages } from './faq-images.controller';

const router = Router({ mergeParams: true });

const FAQ_IMAGES_DIR = path.join(process.cwd(), 'uploads', 'faq-images');
if (!fs.existsSync(FAQ_IMAGES_DIR)) fs.mkdirSync(FAQ_IMAGES_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, FAQ_IMAGES_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = `faq-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, uniqueName);
    },
});

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 5 }, // 1枚5MBまで、1回の送信で最大5枚
    fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.includes(file.mimetype)) {
            cb(new Error('対応していない画像形式です（jpg, png, webpのみ）。'));
            return;
        }
        cb(null, true);
    },
});

// /api/v1/admin/faq/:id/images 配下に登録されるルート
router.post('/', verifyToken, upload.array('images', 5), uploadFaqImages);
router.get('/', verifyToken, getFaqImages);
router.delete('/:imageId', verifyToken, deleteFaqImage);

export default router;
