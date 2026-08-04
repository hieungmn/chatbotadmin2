import pool from '../../config/db';
import { randomUUID } from 'node:crypto';
import { CONVERSATION_HISTORY_TURNS } from './chat.config';
import { ConversationTurn } from '../ai/ai.types';
/** Remove only the old, generated reference footer when restoring earlier AI replies. */
export function stripReferenceFooter(text: string): string {
    return text.replace(/(?:<br\s*\/?>(?:\s*)){2}<b>(?:参考資料|Reference documents|Tài liệu tham khảo|参考资料|참고 자료)<\/b><ul>[\s\S]*<\/ul>\s*$/iu, '');
}

const stripHtml = (text: string) => text.replace(/<[^>]*>/g, '').trim();

/** Store a message; a logging failure must not prevent returning the answer. */
export async function saveMessage(params: {
    sessionId: string;
    role: "user" | "assistant" | "system";
    content: string;
    modelName?: string | null;
    images?: string[] | null;
}): Promise<void> {
    try {
        await pool.query(
            `INSERT INTO public.chat_messages
                (session_id, role, content, images, model_name, created_at)
             VALUES ($1,$2,$3,$4,$5,NOW())
             `,
            [
                params.sessionId, params.role, params.content,
                params.images && params.images.length > 0 ? params.images : null,
                params.modelName ?? null,
            ]
        );
    } catch (err) {
        console.error("⚠️ chat_messages の書き込みに失敗（チャット応答は継続）:", err);
    }
}

/** セッションの直近N往復を取得する（AIへ渡す会話履歴として使用） */
export async function loadHistory(sessionId: string, turns: number): Promise<ConversationTurn[]> {
    try {
        const r = await pool.query(
            `SELECT role, content, model_name FROM public.chat_messages
             WHERE session_id = $1 AND role IN ('user','assistant')
             ORDER BY created_at DESC, id DESC LIMIT $2`,
            [sessionId, turns * 2]
        );
        return r.rows.reverse().map(row => ({
            role: row.role as 'user' | 'assistant',
            content: row.role === 'user' ? String(row.content) : stripHtml(row.model_name ? stripReferenceFooter(row.content) : row.content),
        }));
    } catch (err) {
        console.error("⚠️ 会話履歴の取得に失敗（チャット応答は継続）:", err);
        return [];
    }
}

/** search_logs に1件書き込む — すべての質問はここに必ず1行記録される */
export async function saveSearch(params: {
    sessionId: string;
    siteId: string;
    queryText: string;
    matchedFaqId: number | null;
    responseSource: "faq" | "ai" | "escalated" | "fallback";
}): Promise<void> {
    try {
        await pool.query(
            `INSERT INTO public.search_logs
                (session_id, site_id, query_text, matched_faq_id, response_source, searched_at)
             VALUES ($1,$2,$3,$4,$5,NOW())
             `,
            [
                params.sessionId, params.siteId, params.queryText, params.matchedFaqId, params.responseSource,
            ]
        );
    } catch (err) {
        console.error("⚠️ search_logs の書き込みに失敗（チャット応答は継続）:", err);
    }
}

export class ChatSiteUnavailableError extends Error {
    constructor() { super('Chat site is unavailable.'); }
}
export async function loadChatSiteConfig(cleanSiteId: string) {
    const siteRes = await pool.query(
        `SELECT contact_url, ai_model, custom_prompt_rules, is_active FROM public.sites WHERE site_id = $1`,
        [cleanSiteId]
    );
    if (!siteRes.rows.length || !siteRes.rows[0].is_active) throw new ChatSiteUnavailableError();
    const contactUrl = siteRes.rows[0]?.contact_url || "#";
    const modelName: string = siteRes.rows[0]?.ai_model || "gemma3:4b";
    const customRules: string = siteRes.rows[0]?.custom_prompt_rules || "";

    return { contactUrl, modelName, customRules };
}

export class ChatSessionMismatchError extends Error {
    constructor() {
        super('Session does not belong to this site.');
    }
}

export async function startChat(cleanSiteId: string, cleanMsg: string, session_id: string | null | undefined, clientIp: string) {
    const finalSessionId = session_id || `sess_${randomUUID()}`;

    const session = await pool.query(`
            INSERT INTO public.chat_sessions (session_id, site_id, ip_address, created_at, last_active_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (session_id) DO UPDATE SET last_active_at = NOW()
            WHERE chat_sessions.site_id = EXCLUDED.site_id
            RETURNING session_id;
        `, [finalSessionId, cleanSiteId, String(clientIp)]);

    if (session.rows.length === 0) throw new ChatSessionMismatchError();

    // 現在の質問を保存する前に会話履歴を取得（自分自身を含めないため）
    const conversationHistory = await loadHistory(finalSessionId, CONVERSATION_HISTORY_TURNS);

    await saveMessage({ sessionId: finalSessionId, role: "user", content: cleanMsg });
    return { finalSessionId, conversationHistory };
}

// 曖昧な質問（指示語を含む・短すぎる）かどうかの判定。曖昧な場合のみ検索クエリに
// 会話履歴を連結する（曖昧でない質問は毎回同じ検索結果になるようにするため）。
export const REFERENCE_WORDS = ['それ', 'あれ', 'これ', 'その', 'あの', 'この', 'そちら', 'あちら', 'こちら', '上記', '先ほど', 'さっき', '前述', '同じ'];

export const AMBIGUOUS_MIN_LENGTH = 8;

export function needsConversationContext(message: string): boolean {
    if (message.length < AMBIGUOUS_MIN_LENGTH) return true;
    return REFERENCE_WORDS.some(w => message.includes(w))
        || /\b(it|that|this|those|these|same|what about|how about)\b/i.test(message)
        || /\b(cái đó|cái này|điều đó|như trên|vậy còn|thế còn)\b/iu.test(message)
        || /那个|这个|上述|그것|이것/.test(message);
}
