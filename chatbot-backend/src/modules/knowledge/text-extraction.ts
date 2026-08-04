import iconv from "iconv-lite";
import { chunkText } from './text-chunking';

/**
 * テキストファイルの文字コードを自動判定する。UTF-8 BOMがあれば確実にUTF-8。
 * それ以外はバイト列がUTF-8として妥当か検証し、妥当でなければ Shift-JIS
 * （日本語Windows環境でよく使われる）として読み込む。
 */
export const decodeTextFile = (buffer: Buffer): string => {
    // UTF-8 BOM (EF BB BF)
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return buffer.subarray(3).toString('utf8');
    }

    if (isValidUtf8(buffer)) {
        return buffer.toString('utf8');
    }

    return iconv.decode(buffer, 'Shift_JIS');
};

/** バイト列がUTF-8として妥当かどうかを検証する（外部ライブラリ不使用） */
export const isValidUtf8 = (buffer: Buffer): boolean => {
    let i = 0;
    while (i < buffer.length) {
        const byte = buffer[i];
        let extraBytes = 0;
        if (byte <= 0x7F) { i++; continue; }
        else if ((byte & 0xE0) === 0xC0) extraBytes = 1;
        else if ((byte & 0xF0) === 0xE0) extraBytes = 2;
        else if ((byte & 0xF8) === 0xF0) extraBytes = 3;
        else return false;

        for (let j = 1; j <= extraBytes; j++) {
            if (i + j >= buffer.length || (buffer[i + j] & 0xC0) !== 0x80) return false;
        }
        i += extraBytes + 1;
    }
    return true;
};

/** 文章を指定サイズごとの断片（チャンク）に分割する */
export const splitText = (text: string, size = 500) => {
    return chunkText(text, size, Math.min(60, Math.floor(size / 5)));
};

