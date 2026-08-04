import { Router } from 'express';
import { chatApiLimit, chatQueryLimit, chatSessionLimit } from '../../middlewares/rate-limit.middleware';
import { getChatHistory, getInitialSuggestions, handleChatQuery } from './chat.controller';
const router = Router();

// /api/v1/chat/* 配下は全て公開ルート（埋め込みウィジェットから呼び出し、
// ログイン不要）— CORS設定は cors.middleware.ts の isPublicWidgetPath を参照。

router.use(chatApiLimit);
router.post('/query', chatQueryLimit, chatSessionLimit, handleChatQuery);
router.get('/suggestions', getInitialSuggestions);
router.get('/history', getChatHistory);

export default router;
