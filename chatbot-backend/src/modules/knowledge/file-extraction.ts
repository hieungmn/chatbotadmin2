import fs from 'fs';
import path from 'node:path';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { decodeTextFile, splitText } from './text-extraction';
import type { KnowledgeChunk } from './knowledge-chunk';
import { extractExcelWorkbook } from './excel-extraction';
import { extractPdfFile } from './pdf-extraction';
import { KnowledgeFileReadError } from './file-extraction-error';

export async function extractKnowledgeDocument(filePath: string, originalName: string, fileType: string): Promise<{ chunks: KnowledgeChunk[]; warnings: string[] }> {
    const extension = path.extname(originalName).toLowerCase();
    if (extension === '.pdf' || fileType === 'pdf') return extractPdfFile(filePath, originalName);
    if (['.xlsx', '.xls'].includes(extension) || fileType === 'excel') {
        try {
            const workbook = XLSX.readFile(filePath, { cellDates: true });
            return { chunks: extractExcelWorkbook(workbook), warnings: [] };
        } catch {
            throw new KnowledgeFileReadError('Excelファイルを読み取れません。破損やパスワード保護を確認してください。');
        }
    }
    const text = extension === '.docx' || fileType === 'word'
        ? (await mammoth.extractRawText({ path: filePath })).value
        : decodeTextFile(fs.readFileSync(filePath));
    return { chunks: splitText(text.replace(/\0/g, ''), 500).map(text => ({ text })), warnings: [] };
}

