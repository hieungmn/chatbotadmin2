import { Request, Response } from 'express';
import pool from '../../config/db';
import { stripReferenceFooter, ChatSessionMismatchError, ChatSiteUnavailableError } from './chat.repository';
import { answerQuestion } from './chat.service';
import { AiBusyError } from '../ai/ollama.service';
export const handleChatQuery = async (req: Request, res: Response) => {
    const controller = new AbortController();
    const onClose = () => { if (!res.writableFinished) controller.abort(); };
    try {
        const { site_id, message, session_id } = req.body || {};
        if (typeof site_id !== 'string' || !site_id.trim() || site_id.length > 50 || typeof message !== 'string' || !message.trim() || message.length > 4000 ||
            (session_id != null && (typeof session_id !== 'string' || !session_id.trim() || session_id.length > 100))) {
            return res.status(400).json({ success: false, message: 'パラメータが不足しています。' });
        }
        res.once?.('close', onClose);
        const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
        const result = await answerQuestion({ site_id, message, session_id, signal: controller.signal }, clientIp);
        if (controller.signal.aborted) return;
        return res.json(result);
    } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof AiBusyError) {
            res.setHeader('Retry-After', 5);
            return res.status(503).json({ success: false, code: 'SERVER_BUSY', message: 'AI capacity is busy. Please try again shortly.' });
        }
        if (error instanceof ChatSiteUnavailableError) {
            return res.status(404).json({ success: false, code: 'SITE_UNAVAILABLE', message: 'このサイトのチャットは利用できません。' });
        }
        if (error instanceof ChatSessionMismatchError) {
            return res.status(403).json({ success: false, message: 'このサイトのセッションではありません。' });
        }
        console.error('CHAT ERROR:', error);
        return res.status(500).json({ success: false, message: 'サーバーエラーが発生しました。' });
    } finally { res.removeListener?.('close', onClose); }
};

/**
 * =========================
 * セッションIDによる会話履歴取得（公開API）
 * ページ遷移・F5後にウィジェットを開き直した際、過去のメッセージを画面に
 * 復元するために使用する。ログイン不要（他の /chat/* と同様）。
 * =========================
 */
export const getChatHistory = async (req: Request, res: Response) => {
    try {
        const siteId = String(req.query.site_id || '').trim().toLowerCase();
        const sessionId = String(req.query.session_id || '').trim();

        if (!siteId || !sessionId) {
            return res.status(400).json({ success: false, message: "site_id, session_id は必須です。" });
        }

        // session_id が本当にこの site_id のものか確認（他サイトの履歴を誤読しないように）
        const sessionCheck = await pool.query(
            'SELECT 1 FROM public.chat_sessions WHERE session_id = $1 AND site_id = $2',
            [sessionId, siteId]
        );
        if (sessionCheck.rows.length === 0) {
            return res.json({ success: true, messages: [] });
        }

        const result = await pool.query(
            `SELECT role, content, images, created_at, model_name FROM public.chat_messages
             WHERE session_id = $1 AND role IN ('user', 'assistant')
             ORDER BY created_at ASC`,
            [sessionId]
        );

        const messages = result.rows.map(({ model_name, ...message }) => ({
            ...message,
            content: message.role === 'assistant' && model_name ? stripReferenceFooter(message.content) : message.content,
        }));
        return res.json({ success: true, messages });
    } catch (error) {
        console.error("❌ 会話履歴の取得でエラー:", error);
        return res.status(500).json({ success: false, message: "サーバーエラーが発生しました。" });
    }
};

/**
 * =========================
 * FAQカテゴリの候補を取得
 * =========================
 */
export const getInitialSuggestions = async (req: Request, res: Response) => {
    try {
        const siteId = String(req.query.site_id || "s-wing").trim().toLowerCase();
        const result = await pool.query(`
            SELECT f.category AS label, COUNT(s.id) AS search_count
            FROM public.faq_master f
            LEFT JOIN public.search_logs s ON f.id = s.matched_faq_id
            WHERE LOWER(f.site_id) = $1 AND f.is_draft = FALSE AND f.approval_status = 'approved'
              AND NOT EXISTS (SELECT 1 FROM public.faq_import_batches b WHERE b.id = f.import_batch_id AND b.approval_status = 'rejected')
              AND NOT (length(f.question) > 500 AND trim(f.question) = trim(f.answer_text))
            GROUP BY f.category ORDER BY search_count DESC LIMIT 3;
        `, [siteId]);
        return res.json({ success: true, suggested_topics: result.rows });
    } catch (error) {
        return res.status(500).json({ success: false, message: "DB error" });
    }
};
