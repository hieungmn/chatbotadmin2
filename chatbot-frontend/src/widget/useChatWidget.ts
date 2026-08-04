import { useCallback, useEffect, useRef, useState } from 'react';
import { chatGetHistory, chatQuery, chatSuggestions } from '../api/chat';
import { getPublicSiteInfo } from '../api/sites';
import type { ChatMessage, SuggestedTopic } from '../types';
import { mapWidgetReply } from './widget-reply';
import { widgetSessionStorageKey } from './widget-runtime';

const DEFAULT_THEME = '#1B2C4F';

export function useChatWidget(siteId: string, apiUrl?: string) {
    const activeRequest = useRef<AbortController | null>(null);
    useEffect(() => () => { activeRequest.current?.abort(); activeRequest.current = null; }, [siteId, apiUrl]);
    const [siteName, setSiteName] = useState<string>('サポート');
    const [contactUrl, setContactUrl] = useState<string>('#');
    const [homeUrl, setHomeUrl] = useState<string>('#');
    const [themeColor, setThemeColor] = useState<string>(DEFAULT_THEME);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    const [available, setAvailable] = useState(true);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [suggestedTopics, setSuggestedTopics] = useState<SuggestedTopic[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [sessionId, setSessionIdState] = useState<string | null>(null);

    const setSessionId = useCallback((id: string | null) => {
        setSessionIdState(id);
        if (id) {
            try { localStorage.setItem(widgetSessionStorageKey(siteId, apiUrl), id); } catch { /* ignore */ }
        }
    }, [siteId, apiUrl]);

    // Closing ends this conversation; reopening starts a fresh session.
    const endSession = useCallback(() => {
        activeRequest.current?.abort();
        activeRequest.current = null;
        setIsTyping(false);
        try { localStorage.removeItem(widgetSessionStorageKey(siteId, apiUrl)); } catch { /* ignore */ }
        setSessionIdState(null);
        setMessages([{ id: 'welcome', sender: 'bot', text: `こんにちは。<b>${siteName}</b> サポートAIです。ご質問がございましたら、お気軽にご入力ください。` }]);
        setInput('');
    }, [siteId, apiUrl, siteName]);

    const bodyRef = useRef<HTMLDivElement>(null);

    // F5・タブ閉じる・別ドメインへの遷移時は会話をリセットする（beforeunloadは
    // ページの実際の破棄時のみ発火し、SPA内部のルーティングでは発火しないため
    // 「管理画面内のページ切り替え」と区別できる）。
    useEffect(() => {
        const handleBeforeUnload = () => {
            activeRequest.current?.abort();
            try { localStorage.removeItem(widgetSessionStorageKey(siteId, apiUrl)); } catch { /* ignore */ }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [siteId, apiUrl]);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        setReady(false);
        setAvailable(true);
        setIsTyping(false);
        setMessages([]);
        setSuggestedTopics([]);
        setInput('');
        setSiteName('サポート');
        setContactUrl('#');
        setHomeUrl('#');
        setThemeColor(DEFAULT_THEME);
        setAvatarUrl(null);

        // 保存済みのsession_idを復元する（管理画面内のページ切り替え時のみ有効。
        // F5・タブ閉じるの場合は上記のbeforeunloadで既に削除されているため、
        // その場合はnullとなり自動的に新しい会話として扱われる）。
        let savedSessionId: string | null = null;
        try {
            savedSessionId = localStorage.getItem(widgetSessionStorageKey(siteId, apiUrl));
            setSessionIdState(savedSessionId || null);
        } catch {
            savedSessionId = null;
            setSessionIdState(null);
        }

        const welcomeMessage = (name: string): ChatMessage => ({
            id: 'welcome',
            sender: 'bot',
            text: `こんにちは。<b>${name}</b> サポートAIです。ご質問がございましたら、お気軽にご入力ください。`,
        });

        getPublicSiteInfo(siteId, apiUrl, controller.signal)
            .then(async (res) => {
                if (cancelled) return;
                const site = res?.site;
                const name = site?.site_name || 'サポート';
                setSiteName(name);
                // contact_url: AIが回答を見つけられない場合のフォールバック用。
                // home_url: 低評価フィードバック時の遷移先（window.location.originは
                // プレビュー環境など別ドメインで動く可能性があるため使用しない）。
                setContactUrl(site?.contact_url || '#');
                setHomeUrl(site?.home_url || site?.contact_url || '#');
                setThemeColor(site?.theme_color || DEFAULT_THEME);
                setAvatarUrl(site?.avatar_url || null);

                // 保存済みのsession_idがあれば、過去のメッセージ履歴を復元して表示する
                // （画像も含む — chat_messagesに保存された images をそのまま利用）。
                if (savedSessionId) {
                    try {
                        const historyRes = await chatGetHistory(siteId, savedSessionId, apiUrl, controller.signal);
                        if (!cancelled && historyRes?.success && Array.isArray(historyRes.messages) && historyRes.messages.length > 0) {
                            const restored: ChatMessage[] = historyRes.messages.map((m: any, idx: number) => ({
                                id: `restored-${idx}`,
                                sender: m.role === 'user' ? 'user' : 'bot',
                                text: m.content,
                                images: Array.isArray(m.images) && m.images.length > 0 ? m.images : undefined,
                            }));
                            setMessages(restored);
                            return;
                        }
                    } catch {
                        // 履歴取得に失敗しても（通信エラー・セッション期限切れ等）ウィジェット
                        // 全体は止めず、通常のあいさつメッセージで続行する。
                    }
                }

                if (!cancelled) setMessages([welcomeMessage(name)]);
            })
            .catch((error) => {
                if (cancelled) return;
                if (error?.response?.status === 404) {
                    setAvailable(false);
                    setSuggestedTopics([]);
                    setMessages([{ id: 'unavailable', sender: 'bot', text: '現在このチャットはご利用いただけません。' }]);
                    return;
                }
                setSiteName('サポート');
                setThemeColor(DEFAULT_THEME);
                setMessages([welcomeMessage('サポート')]);
            })
            .finally(() => { if (!cancelled) setReady(true); });

        chatSuggestions(siteId, apiUrl, controller.signal)
            .then((res) => { if (!cancelled) setSuggestedTopics(res?.success ? (res.suggested_topics || []) : []); })
            .catch(() => { if (!cancelled) setSuggestedTopics([]); });

        return () => { cancelled = true; controller.abort(); };
    }, [siteId, apiUrl]);

    useEffect(() => {
        bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, isTyping]);

    const fallbackBubble = useCallback((text: string) => {
        return `${text}<br/><br/><a href="${contactUrl}" target="_blank" rel="noreferrer" class="cbw-link">✉ お問い合わせ窓口</a>`;
    }, [contactUrl]);

    const sendMessage = useCallback(async (forcedText?: string) => {
        const text = (forcedText ?? input).trim();
        if (!text || isTyping || activeRequest.current || !ready || !available || text.length > 4000) return;

        setMessages(prev => [...prev, { id: 'user-' + Date.now(), sender: 'user', text }]);
        if (!forcedText) setInput('');
        setIsTyping(true);
        const request = new AbortController();
        activeRequest.current = request;

        try {
            const res = await chatQuery(siteId, text, sessionId, apiUrl, request.signal);
            if (request.signal.aborted || activeRequest.current !== request) return;

            if (res?.session_id) setSessionId(res.session_id);

            setMessages(prev => [...prev, {
                id: 'bot-' + Date.now(), sender: 'bot',
                ...mapWidgetReply(res ?? {}, fallbackBubble('ご質問の内容を確認できませんでした。')),
            }]);
        } catch (error: any) {
            if (request.signal.aborted || activeRequest.current !== request) return;
            const unavailable = error?.response?.data?.code === 'SITE_UNAVAILABLE';
            if (unavailable) { setAvailable(false); setSuggestedTopics([]); }
            setMessages(prev => [...prev, {
                id: 'bot-err-' + Date.now(), sender: 'bot',
                text: unavailable ? '現在このチャットはご利用いただけません。' : error?.response?.status === 429
                    ? '送信回数の上限に達しました。少し待ってから再度お試しください。'
                    : error?.response?.data?.code === 'SERVER_BUSY'
                    ? '現在処理が混み合っています。少し待ってから再度お試しください。'
                    : fallbackBubble('ただいまシステムに接続できませんでした。しばらくしてから再度お試しください。'),
            }]);
        } finally {
            if (activeRequest.current === request) { activeRequest.current = null; setIsTyping(false); }
        }
    }, [input, isTyping, ready, available, siteId, apiUrl, sessionId, setSessionId, fallbackBubble]);

    // Display-only acknowledgement; no request or persisted rating.
    const sendFeedback = useCallback((msgId: string, score: number) => {
        if (!messages.some(m => m.id === msgId && m.showFeedback && !m.feedbackGiven)) return;
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, showFeedback: false, feedbackGiven: true } : m));

        if (score === 1) {
            setMessages(prev => [...prev, { id: 'fb-' + Date.now(), sender: 'bot', text: 'フィードバックをありがとうございます。お役に立てて嬉しいです。' }]);
        } else {
            setMessages(prev => [...prev, {
                id: 'fb-' + Date.now(), sender: 'bot',
                text: `ご期待に沿えず申し訳ございません。<br/><a href="${homeUrl}" target="_blank" rel="noreferrer" class="cbw-link">ホームページ</a>から他の情報もご確認いただけます。`,
            }]);
        }

    }, [messages, homeUrl]);

    return {
        siteName, contactUrl, homeUrl, themeColor, avatarUrl, ready, sessionId,
        messages, suggestedTopics: available ? suggestedTopics : [], input, setInput, isTyping, available,
        bodyRef, sendMessage, sendFeedback, endSession,
    };
}
