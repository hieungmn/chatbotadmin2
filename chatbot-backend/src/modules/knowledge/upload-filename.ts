import { TextDecoder } from 'node:util';

/** Multipart headers may carry UTF-8 bytes decoded by Busboy as Latin-1. */
export function decodeUploadFilename(name: string): string {
    if (!/[^\x00-\x7f]/.test(name) || [...name].some(char => char.codePointAt(0)! > 255)) return name;
    try {
        // Fatal decoding preserves genuine Latin-1 names instead of introducing replacement characters.
        return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(name, 'latin1'));
    } catch {
        return name;
    }
}
