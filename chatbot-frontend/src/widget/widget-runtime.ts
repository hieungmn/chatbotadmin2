export interface WidgetRuntimeConfig { siteId: string; apiUrl: string }

export function normalizeWidgetApiUrl(value: string): string {
    let url: URL;
    try { url = new URL(value.trim()); } catch { throw new Error('Invalid widget backend URL'); }
    const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname.toLowerCase());
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)
        || url.username || url.password || url.search || url.hash) {
        throw new Error('Invalid widget backend URL');
    }
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

export function readWidgetRuntime(script: HTMLScriptElement | null, fallbackApiUrl: string): WidgetRuntimeConfig {
    const siteId = (script?.dataset.siteId || 's-wing').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,49}$/.test(siteId)) throw new Error('Invalid widget site ID');
    let backend = script?.dataset.apiUrl;
    if (backend === undefined && script?.src) {
        const source = new URL(script.src);
        const suffix = '/static/chatbot-widget.js';
        const prefix = source.pathname.endsWith(suffix) ? source.pathname.slice(0, -suffix.length) : '';
        backend = `${source.origin}${prefix}`;
    }
    return { siteId, apiUrl: normalizeWidgetApiUrl(backend ?? fallbackApiUrl) };
}

export function widgetSessionStorageKey(siteId: string, apiUrl?: string): string {
    return apiUrl ? `cbw_session_${encodeURIComponent(normalizeWidgetApiUrl(apiUrl))}_${siteId}` : `cbw_session_${siteId}`;
}

export function widgetAssetUrl(value: string, apiUrl: string): string | undefined {
    const path = value.trim();
    if (!path || path.startsWith('//')) return undefined;
    try {
        const url = /^[a-z][a-z\d+.-]*:/i.test(path) ? new URL(path)
            : new URL(`${normalizeWidgetApiUrl(apiUrl)}/${path.replace(/^\/+/, '')}`);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
        return url.href;
    } catch { return undefined; }
}

export function findWidgetMount(document: Document, config: WidgetRuntimeConfig): HTMLElement | undefined {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-chatbot-widget-mount]'))
        .find(element => element.dataset.siteId === config.siteId && element.dataset.apiUrl === config.apiUrl);
}
