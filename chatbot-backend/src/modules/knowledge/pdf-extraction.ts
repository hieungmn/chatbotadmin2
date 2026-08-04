import fs from 'node:fs/promises';
import path from 'node:path';
import { extractText, getDocumentProxy } from 'unpdf';
import type { KnowledgeChunk } from './knowledge-chunk';
import { chunkWithHeading } from './text-chunking';
import { KnowledgeFileReadError } from './file-extraction-error';

export async function extractPdfFile(filePath: string, originalName: string) {
    const bytes = await fs.readFile(filePath);
    if (!bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) {
        throw new KnowledgeFileReadError('PDFファイルを読み取れません。正しいPDFファイルをアップロードしてください。');
    }
    try {
        // Local font/CMap assets are needed for common Japanese/CJK PDF fonts.
        const pdfAssets = path.dirname(require.resolve('pdfjs-dist/package.json'));
        const document = await getDocumentProxy(new Uint8Array(bytes), {
            disableFontFace: true,
            cMapUrl: path.join(pdfAssets, 'cmaps').replace(/\\/g, '/') + '/', cMapPacked: true,
            standardFontDataUrl: path.join(pdfAssets, 'standard_fonts').replace(/\\/g, '/') + '/',
        });
        try {
            const result = await extractText(document, { mergePages: false });
            const pages = Array.isArray(result.text) ? result.text : [result.text];
            const chunks: KnowledgeChunk[] = [];
            const emptyPages: number[] = [];
            for (let index = 0; index < pages.length; index++) {
                const text = pages[index]!.replace(/\0/g, '').trim();
                if (!text) { emptyPages.push(index + 1); continue; }
                const headingPath = [originalName, `Page ${index + 1}`];
                for (const part of chunkWithHeading(text, headingPath)) chunks.push({
                    text: part, headingPath, sectionId: `pdf-page-${index + 1}`, pageNumber: index + 1,
                });
            }
            if (!chunks.length) throw new KnowledgeFileReadError('PDFに読み取れるテキストがありません。画像だけのスキャンPDFには対応していません。文字を選択・コピーできるPDFを使用してください。');
            const warnings = emptyPages.length
                ? [`${emptyPages.length}ページはテキストを取得できませんでした（ページ: ${emptyPages.slice(0, 20).join(', ')}${emptyPages.length > 20 ? ', …' : ''}）。画像・スキャン部分は取り込まれていません。`]
                : [];
            return { chunks, warnings };
        } finally { await document.loadingTask.destroy(); }
    } catch (error) {
        if (error instanceof KnowledgeFileReadError) throw error;
        if (error instanceof Error && error.name === 'PasswordException') {
            throw new KnowledgeFileReadError('PDFはパスワードで保護されています。保護を解除してからアップロードしてください。');
        }
        throw new KnowledgeFileReadError('PDFを読み取れませんでした。ファイルの破損や文字情報を確認してください。');
    }
}
