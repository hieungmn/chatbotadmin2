import { useMemo } from 'react';
import { sanitizeChatHtml } from './safe-html';

export function ChatMessageContent({ text, sender }: { text: string; sender: 'bot' | 'user' }) {
    const html = useMemo(() => sender === 'bot' ? sanitizeChatHtml(text) : '', [text, sender]);
    return sender === 'bot' ? <span dangerouslySetInnerHTML={{ __html: html }} /> : <>{text}</>;
}
