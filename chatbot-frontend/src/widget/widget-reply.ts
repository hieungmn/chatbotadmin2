import type { ChatMessage } from '../types';

interface ReplyPayload {
    success?: boolean; answer?: string; is_fallback?: boolean;
    response_kind?: string; images?: unknown; redirect_url?: string | null;
    answer_status?: string;
}

/** Backend owns the wording and language, including clarification and escalation. */
export function mapWidgetReply(reply: ReplyPayload, defaultText: string): Omit<ChatMessage, 'id' | 'sender'> {
    if (!reply.success || typeof reply.answer !== 'string' || !reply.answer.trim()) return { text: defaultText };
    return {
        text: reply.answer,
        images: !reply.is_fallback && Array.isArray(reply.images) ? reply.images.filter((image): image is string => typeof image === 'string') : undefined,
        redirect_url: reply.is_fallback ? null : reply.redirect_url || null,
        showFeedback: reply.response_kind !== 'clarification' && reply.answer_status !== 'provider_error',
    };
}
