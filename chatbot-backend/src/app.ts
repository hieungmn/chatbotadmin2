import express from 'express';
import { apiErrorHandler } from './middlewares/api-error.middleware';
import path from 'path';
import { requireAdmin, verifyToken } from './middlewares/auth.middleware';
import { corsMiddleware } from './middlewares/cors.middleware';
import authRoutes from './modules/auth/auth.routes';
import chatRouter from './modules/chat/chat.route';
import faqRoutes from './modules/faq/faq.routes';
import knowledgeRoutes from './modules/knowledge/knowledge.route';
import { getAvailableAiModels, getPublicSiteInfo } from './modules/sites/sites.controller';
import sitesRoutes from './modules/sites/sites.routes';
import userRoutes from './modules/user/user.routes';

const app = express();
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(proxyHops) && proxyHops > 0) app.set('trust proxy', proxyHops);

// ======================
// 1. ミドルウェア（ルーティングより前に配置すること）
// ======================

app.use(corsMiddleware);

app.use(express.json({ limit: '1mb' }));

app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 1000 }));

app.use('/uploads/faq-images', express.static(path.resolve('uploads/faq-images')));

app.use('/static', express.static(path.join(__dirname, '../public/static')));

// ======================
// 2. ルーティング
// ======================

app.use('/api/v1/knowledge', knowledgeRoutes);

app.use('/api/v1/chat', chatRouter);

app.use('/api/v1/staff-users', userRoutes);

// サイト公開情報 — 埋め込みウィジェットが表示名・問い合わせ先取得に使用
app.get('/api/v1/sites/:siteId/public', getPublicSiteInfo);

app.get('/api/v1/admin/ollama-models', verifyToken, requireAdmin, getAvailableAiModels);



app.use('/api/v1/admin/faq', faqRoutes);
app.use('/api/v1/admin/sites', sitesRoutes);
app.use('/api/v1/auth', authRoutes);

app.use(apiErrorHandler);
export default app;
