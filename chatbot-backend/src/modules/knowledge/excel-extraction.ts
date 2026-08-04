import * as XLSX from 'xlsx';
import { chunkWithHeading } from './text-chunking';
import type { KnowledgeChunk } from './knowledge-chunk';

type Row = { index: number; cells: Map<number, string> };
const normalized = (value: string) => value.normalize('NFKC').trim().toLowerCase().replace(/[\s_-]+/g, '');

function display(cell: XLSX.CellObject | undefined): string {
    if (!cell) return '';
    if (cell.v == null) return cell.f ? `[Formula without stored result: =${cell.f}]` : '';
    return String(cell.w ?? XLSX.utils.format_cell(cell)).replace(/\r\n?/g, '\n').replace(/\0/g, '').trim();
}

/** Walk stored cells, not every address in !ref (which can span a nearly empty sheet). */
function readRows(sheet: XLSX.WorkSheet): Row[] {
    const rows = new Map<number, Map<number, string>>();
    for (const address of Object.keys(sheet)) {
        if (!/^[A-Z]+[1-9]\d*$/.test(address)) continue;
        const text = display(sheet[address]);
        if (!text) continue;
        const { r, c } = XLSX.utils.decode_cell(address);
        if (!rows.has(r)) rows.set(r, new Map());
        rows.get(r)!.set(c, text);
    }
    return [...rows].sort(([a], [b]) => a - b).map(([index, cells]) => ({ index, cells }));
}

function mergedValue(sheet: XLSX.WorkSheet, row: number, column: number): string {
    const direct = display(sheet[XLSX.utils.encode_cell({ r: row, c: column })]);
    if (direct) return direct;
    const merge = sheet['!merges']?.find(m => m.s.r <= row && row <= m.e.r && m.s.c <= column && column <= m.e.c);
    return merge ? display(sheet[XLSX.utils.encode_cell(merge.s)]) : '';
}

function looksLikeHeader(row: Row): boolean {
    const values = [...row.cells.values()];
    return values.length >= 2 && values.every(v => v.length <= 100 && !v.includes('\n'))
        && values.filter(v => /\p{L}/u.test(v) && !/^https?:/i.test(v)).length >= Math.ceil(values.length * 0.6);
}

function questionAnswerColumns(header: Map<number, string>) {
    const find = (names: string[]) => [...header].find(([, value]) => names.includes(normalized(value)))?.[0];
    return {
        question: find(['question', '質問', 'câuhỏi', 'cauhoi']),
        answer: find(['answertext', 'answer', '回答', 'câutrảlời', 'cautraloi']),
        category: find(['category', 'カテゴリ']), keywords: find(['keywords', 'keyword']),
        url: find(['redirecturl']),
    };
}

export function extractExcelWorkbook(workbook: XLSX.WorkBook): KnowledgeChunk[] {
    const chunks: KnowledgeChunk[] = [];
    for (const [sheetIndex, name] of workbook.SheetNames.entries()) {
        const sheet = workbook.Sheets[name];
        const rows = readRows(sheet);
        let header = new Map<number, string>();
        let section = 0;
        const titles: string[] = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]!;
            const entries = [...row.cells].sort(([a], [b]) => a - b);
            // A singleton line with more content below is a title/note, not an empty record.
            const startsSection = !header.size || (i > 0 && row.index > rows[i - 1]!.index + 1)
                || sheet['!merges']?.some(m => m.s.r === row.index && m.e.c > m.s.c);
            const singleton = entries.length === 1 && startsSection && i < rows.length - 1;
            if (singleton) {
                header.clear(); section++;
                const text = entries[0]![1];
                titles.push(text); if (titles.length > 2) titles.shift();
                for (const part of chunkWithHeading(text, [name, `Row ${row.index + 1}`])) {
                    chunks.push({ text: part, headingPath: [name], sectionId: `sheet-${sheetIndex}-table-${section}`, sheetName: name, rowNumber: row.index + 1 });
                }
                continue;
            }
            if (!header.size && i < rows.length - 1 && looksLikeHeader(row)) {
                header = new Map(entries); section++;
                // A merged parent header above short child headers contributes to each column name.
                const next = rows[i + 1];
                if (sheet['!merges']?.some(m => m.s.r === row.index && m.e.c > m.s.c)
                    && next?.index === row.index + 1 && looksLikeHeader(next)) {
                    header = new Map([...next.cells].map(([column, child]) => {
                        const parent = mergedValue(sheet, row.index, column);
                        return [column, parent && parent !== child ? `${parent} / ${child}` : child];
                    }));
                    i++;
                }
                continue;
            }
            // Repeated print headers should not become knowledge records.
            if (header.size && entries.length === header.size && entries.every(([c, v]) => normalized(header.get(c) || '') === normalized(v))) continue;
            const cells = new Map(row.cells);
            for (const merge of sheet['!merges'] || []) {
                if (merge.s.r < row.index && row.index <= merge.e.r && !cells.has(merge.s.c)) {
                    const text = display(sheet[XLSX.utils.encode_cell(merge.s)]);
                    if (text) cells.set(merge.s.c, text);
                }
            }
            const qa = questionAnswerColumns(header);
            const question = qa.question === undefined ? '' : cells.get(qa.question) || '';
            const answer = qa.answer === undefined ? '' : cells.get(qa.answer) || '';
            const heading = [name, ...titles, `Row ${row.index + 1}`];
            let text: string;
            if (qa.question !== undefined && qa.answer !== undefined && (question || answer)) {
                text = `[Question]: ${question}\n[Answer]: ${answer}`;
                if (qa.category !== undefined && cells.has(qa.category)) text += `\n[Category]: ${cells.get(qa.category)}`;
                if (qa.keywords !== undefined && cells.has(qa.keywords)) text += `\n[Keywords]: ${cells.get(qa.keywords)}`;
                if (qa.url !== undefined && cells.has(qa.url)) text += `\n[Redirect URL]: ${cells.get(qa.url)}`;
                // Preserve additional business columns even on a question/answer sheet.
                for (const [column, value] of cells) if (![qa.question, qa.answer, qa.category, qa.keywords, qa.url].includes(column)) {
                    text += `\n${header.get(column) || `Column ${XLSX.utils.encode_col(column)}`}: ${value}`;
                }
                if (question) heading.push(question.slice(0, 120));
            } else {
                text = [...cells].sort(([a], [b]) => a - b).map(([column, value]) => `${header.get(column) || `Column ${XLSX.utils.encode_col(column)}`}: ${value}`).join('\n');
                // Repeat the row identifier when a long row splits across multiple chunks.
                if (entries.length > 1) heading.push(entries[0]![1].slice(0, 120));
            }
            for (const part of chunkWithHeading(text, heading)) chunks.push({
                text: part, headingPath: heading, sectionId: `sheet-${sheetIndex}-table-${section}`, sheetName: name, rowNumber: row.index + 1,
            });
        }
    }
    return chunks;
}
