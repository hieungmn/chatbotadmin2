import React, { useEffect, useMemo, useState } from 'react';
import { useChatWidget } from './useChatWidget';
import { darken, hexToRgba, lighten } from './widget-theme';
export function useWidgetPresentation(siteId: string, apiUrl?: string) {

    const [isOpen, setIsOpen] = useState(false);

    const [isExpanded, setIsExpanded] = useState(false);

    const [showTeaser, setShowTeaser] = useState(false);

    const [hoverTeaser, setHoverTeaser] = useState(false);

    const [teaserDismissed, setTeaserDismissed] = useState(false);



    const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

    const [copiedId, setCopiedId] = useState<string | null>(null);

    // 回答をプレーンテキストとしてコピーする（HTMLタグは除去、リンクは
    // 「テキスト（URL）」の形に変換して読みやすく残す）。
    const handleCopy = (msgId: string, html: string) => {
        const plain = html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2（$1）')
            .replace(/<[^>]+>/g, '')
            .trim();
        navigator.clipboard?.writeText(plain).then(() => {
            setCopiedId(msgId);
            setTimeout(() => setCopiedId(prev => (prev === msgId ? null : prev)), 1800);
        }).catch(() => { /* クリップボード権限がない場合は無視 */ });
    };



    const {
        siteName, contactUrl, themeColor, avatarUrl, messages, suggestedTopics, input, setInput, isTyping,
        ready, available,
        bodyRef, sendMessage, sendFeedback, endSession,
    } = useChatWidget(siteId, apiUrl);

    const handleCloseClick = () => {
        endSession();
        setIsOpen(false);
        setIsExpanded(false);
        setLightbox(null);
    };

    // 数秒経ってもチャットが開かれない場合に表示される誘導吹き出し —
    // サポートウィジェットでも一般的な手法。
    useEffect(() => {
        if (isOpen || teaserDismissed) { setShowTeaser(false); return; }
        const t = setTimeout(() => setShowTeaser(true), 4000);
        return () => clearTimeout(t);
    }, [isOpen, teaserDismissed]);

    const accentVars = useMemo(() => ({
        '--cbw-accent': themeColor,
        '--cbw-accent-dark': darken(themeColor, 0.30),
        '--cbw-accent-soft': lighten(themeColor, 0.92),
        '--cbw-accent-shadow': hexToRgba(themeColor, 0.22),
    } as React.CSSProperties), [themeColor]);

    const showSuggestedTopics = suggestedTopics.length > 0 && !isTyping;

    // 自動表示（4秒後）と、起動ボタンへのホバー／フォーカス、どちらでも吹き出しが
    // 出るようにする — 「閉じている間ずっと出しっぱなし」ではなく、マウスを
    // 乗せた時にも反応する方が動きが感じられて自然なため。
    const teaserVisible = !isOpen && (showTeaser || hoverTeaser);
    return {
        isOpen,
        setIsOpen,
        isExpanded,
        setIsExpanded,
        setShowTeaser,
        setHoverTeaser,
        setTeaserDismissed,
        lightbox,
        setLightbox,
        copiedId,
        handleCopy,
        siteName,
        contactUrl,
        avatarUrl,
        messages,
        suggestedTopics,
        input,
        setInput,
        isTyping,
        ready,
        available,
        bodyRef,
        sendMessage,
        sendFeedback,
        handleCloseClick,
        accentVars,
        showSuggestedTopics,
        teaserVisible
    };
}
