import publicWidgetClient, { widgetApiUrl } from './public-widget-client';

// ===================== チャット（公開ウィジェット） =====================
export const chatQuery = (site_id: string, message: string, session_id: string | null, apiUrl?: string, signal?: AbortSignal) =>
    publicWidgetClient.post(widgetApiUrl('/chat/query', apiUrl), { site_id, message, session_id }, { signal }).then(r => r.data);

export const chatSuggestions = (site_id: string, apiUrl?: string, signal?: AbortSignal) =>
    publicWidgetClient.get(widgetApiUrl('/chat/suggestions', apiUrl), { params: { site_id }, signal }).then(r => r.data);

export const chatGetHistory = (site_id: string, session_id: string, apiUrl?: string, signal?: AbortSignal) =>
    publicWidgetClient.get(widgetApiUrl('/chat/history', apiUrl), { params: { site_id, session_id }, signal }).then(r => r.data);
