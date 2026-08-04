import DOMPurify from 'dompurify';

/** Links in both rich-text answers and FAQ buttons may only navigate to HTTP(S). */
export function safeChatUrl(value: string | null | undefined): string | undefined {
    if (!value?.trim()) return undefined;
    try {
        const url = new URL(value.trim(), document.baseURI);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
    } catch {
        return undefined;
    }
}

export function sanitizeChatHtml(html: string): string {
    const fragment = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['a', 'b', 'strong', 'i', 'em', 'u', 's', 'br', 'p', 'div', 'span',
            'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4',
            'table', 'thead', 'tbody', 'tr', 'th', 'td'],
        ALLOWED_ATTR: ['href', 'title'],
        ALLOW_DATA_ATTR: false,
        ALLOW_ARIA_ATTR: false,
        RETURN_DOM_FRAGMENT: true,
    });
    for (const link of fragment.querySelectorAll('a')) {
        const href = safeChatUrl(link.getAttribute('href'));
        if (!href) {
            link.removeAttribute('href');
            continue;
        }
        link.setAttribute('href', href);
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        link.setAttribute('class', 'cbw-link');
    }
    const container = document.createElement('div');
    container.append(fragment);
    return container.innerHTML;
}
