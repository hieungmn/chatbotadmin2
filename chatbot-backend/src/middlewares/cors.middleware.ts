import cors from 'cors';
import { Request } from 'express';

// ============================================================
// 管理画面用の許可ドメイン一覧（固定） — Authorization トークンを使用する
// ため、ドメインを厳格に制限する。
// ============================================================
const STATIC_ADMIN_ALLOWED = [
    'http://localhost:5173',
    'http://localhost:4173', // vite preview
    'http://127.0.0.1:5173',
];

// 環境変数 ALLOWED_ORIGINS でも追加可能（本番ドメインへのデプロイ時用）。
// カンマ区切りで複数指定できる。
const envOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const ADMIN_ALLOWED_ORIGINS = [...STATIC_ADMIN_ALLOWED, ...envOrigins];

const NGROK_PATTERN = /^https:\/\/[a-z0-9-]+\.(ngrok-free\.app|ngrok\.io|ngrok\.app)$/i;

// ============================================================
// ウィジェット用の公開ルート（サイト情報・チャット・フィードバック）:
// ログイン不要のため、ドメイン制限をかけない — 導入先サイトのドメインは
// 事前にすべて把握できないため。
// ============================================================
const isPublicWidgetPath = (path: string): boolean => {
    return path.startsWith('/api/v1/chat/') || /^\/api\/v1\/sites\/[^/]+\/public$/.test(path);
};

/**
 * cors ライブラリの「delegate」形式を使用 — リクエストごとにCORS設定を
 * 動的に決定する。パスによって管理画面用／ウィジェット用の2パターンを
 * 1つのミドルウェアで切り替える。
 */
const corsOptionsDelegate = (req: Request, callback: (err: Error | null, options?: cors.CorsOptions) => void) => {
    if (isPublicWidgetPath(req.path)) {
        // ウィジェット公開ルート: 全ドメイン許可（cookie/token不使用のためcredentials不要）
        callback(null, {
            origin: true,
            credentials: false,
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning'],
        });
        return;
    }

    // 管理画面: 従来通り厳格なドメイン制限を維持
    const origin = req.headers.origin;
    const isAllowed = !origin || ADMIN_ALLOWED_ORIGINS.includes(origin) || NGROK_PATTERN.test(origin);

    if (!isAllowed) {
        console.warn(`⚠️ 許可リストにないoriginからのアクセスを拒否（管理画面）: ${origin}`);
    }

    callback(null, {
        origin: isAllowed,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
    });
};

export const corsMiddleware = cors(corsOptionsDelegate as any);
