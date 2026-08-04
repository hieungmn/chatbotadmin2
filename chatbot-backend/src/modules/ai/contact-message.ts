/** Japanese customer messages distinguish missing knowledge from technical failures. */
export function buildClarificationMessage(): string {
    return 'どのサービスや手続きについてのご質問ですか？知りたい内容をもう少し具体的に教えてください。';
}

export function buildContactFallbackMessage(contactUrl: string): string {
    return withContactLink('十分な情報が見つからなかったため、担当窓口にご案内いたします。', contactUrl);
}

export function buildProviderErrorMessage(contactUrl: string): string {
    return withContactLink('現在、技術的な問題により回答を生成できません。しばらくしてから再度お試しいただくか、担当窓口へお問い合わせください。', contactUrl);
}

function withContactLink(text: string, contactUrl: string): string {
    // Site configuration is still data; do not interpolate unsafe URLs or HTML attributes.
    let safeUrl: string | null = null;
    try {
        const url = new URL(contactUrl);
        if (url.protocol === 'https:' || url.protocol === 'http:') safeUrl = url.href;
    } catch { /* No valid contact link configured. */ }
    if (!safeUrl) return text;
    const escaped = safeUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
    return `${text} <a href="${escaped}" target="_blank" rel="noopener noreferrer">お問い合わせページ</a>`;
}
