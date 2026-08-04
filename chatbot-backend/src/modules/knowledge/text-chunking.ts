/** Structural splitting only: no model calls, and every output obeys the hard limit. */
export function chunkText(text: string, maxChars = 900, overlapChars = 80): string[] {
    if (!Number.isInteger(maxChars) || maxChars < 32) throw new Error('Chunk size must be at least 32 characters.');
    if (!Number.isInteger(overlapChars) || overlapChars < 0 || overlapChars >= maxChars / 2) throw new Error('Invalid chunk overlap.');
    const remaining = text.replace(/\r\n?/g, '\n').replace(/\0/g, '').trim();
    if (!remaining) return [];
    const result: string[] = [];
    let start = 0;
    while (start < remaining.length) {
        let end = Math.min(start + maxChars, remaining.length);
        if (end < remaining.length) {
            const window = remaining.slice(start, end);
            // Prefer paragraph, line and sentence boundaries in the last half of the window.
            const boundaries = [/\n\s*\n/g, /\n/g, /[。！？]|[.!?](?:\s+|$)/g, /\s+/g];
            for (const boundary of boundaries) {
                const matches = [...window.matchAll(boundary)];
                const last = matches.at(-1);
                const offset = last ? last.index! + last[0].length : 0;
                if (offset >= maxChars / 2) { end = start + offset; break; }
            }
            // UTF-16 limits are conservative; never split a surrogate pair.
            if (/[\uD800-\uDBFF]/.test(remaining[end - 1])) end--;
        }
        const part = remaining.slice(start, end).trim();
        if (part) result.push(part);
        if (end === remaining.length) break;
        let next = Math.max(start + 1, end - overlapChars);
        if (/[\uDC00-\uDFFF]/.test(remaining[next])) next++;
        start = next;
    }
    return result;
}

/** Include section context on every child while reserving room for actual content. */
export function chunkWithHeading(text: string, headings: string[], maxChars = 900): string[] {
    const heading = headings.join(' > ').slice(0, Math.floor(maxChars / 3));
    const prefix = heading ? `[${heading}]\n` : '';
    const available = maxChars - prefix.length;
    return chunkText(text, available, Math.min(80, Math.floor(available / 5))).map(part => prefix + part);
}
