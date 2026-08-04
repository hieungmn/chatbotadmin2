import { RAG_CONTEXT_MAX_CHARS, RAG_MAX_CHUNKS, CANDIDATE_POOL_SIZE, FAQ_EMBED_SIMILARITY_THRESHOLD, FAQ_EMBED_TOP_K, RAG_SIMILARITY_THRESHOLD, RAG_TOP_K } from './chat.config';
import pool from '../../config/db';
const STOP_WORDS = new Set(`the a an is are was were be can could do does to of for in on at how what when which please tell me about
    は の が を に と で も か です ます でき できます できる あり あります ある する し した して ください
    何 いつ どう どの どれ それ その これ この について 教えて 確認 情報 必要 可能
    tôi bạn là có không được thể gì nào bao nhiêu`.split(/\s+/));
const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
export const normalizeSearchText = (text: string) => text.normalize('NFKC').toLowerCase();

/** Built-in Unicode segmentation keeps Japanese terms; it requires no tokenizer server or Python runtime. */
export function searchTerms(text: string): string[] {
    const normalized = normalizeSearchText(text);
    const words = [...segmenter.segment(normalized)].filter(word => word.isWordLike);
    const terms = new Set<string>();
    for (let index = 0; index < words.length; index++) {
        const word = words[index]!;
        if (word.segment.length < 2 || STOP_WORDS.has(word.segment)) continue;
        terms.add(word.segment);
        const next = words[index + 1];
        if (next && !STOP_WORDS.has(next.segment) && next.index === word.index + word.segment.length
            && /^[\p{Script=Han}\p{Script=Katakana}ー]+$/u.test(word.segment + next.segment)) {
            terms.add(word.segment + next.segment);
        }
    }
    return [...terms].slice(-32);
}

export const searchPatterns = (terms: string[]) => terms.map(term => `%${term.replace(/[\\%_]/g, '\\$&')}%`);

export function rankLexical<T extends { content_text: string }>(rows: T[], terms: string[]): T[] {
    const normalized = rows.map(row => normalizeSearchText(row.content_text));
    const weights = terms.map(term => Math.min(term.length, 12) * Math.log(1 + (rows.length + 1) / (1 + normalized.filter(text => text.includes(term)).length)));
    return rows.map((row, index) => ({ row, score: terms.reduce((sum, term, termIndex) => sum + (normalized[index]!.includes(term) ? weights[termIndex]! : 0), 0) }))
        .sort((a, b) => b.score - a.score).map(item => item.row);
}

/** Reciprocal-rank fusion, with two lexical anchors so a rare exact term cannot be drowned out by generic vectors. */
export function fuseKnowledge<T extends { id: number }>(semantic: T[], lexical: T[], limit: number): T[] {
    const scores = new Map<number, { row: T; score: number }>();
    for (const list of [semantic, lexical]) list.forEach((row, rank) => {
        const current = scores.get(row.id);
        if (current) current.score += 1 / (60 + rank + 1);
        else scores.set(row.id, { row, score: 1 / (60 + rank + 1) });
    });
    const selected = new Map<number, T>();
    for (const row of lexical.slice(0, Math.min(2, limit))) selected.set(row.id, scores.get(row.id)!.row);
    for (const { row } of [...scores.values()].sort((a, b) => b.score - a.score)) {
        if (selected.size >= limit) break;
        selected.set(row.id, row);
    }
    return [...selected.values()];
}

export interface RetrievedKnowledgeRow {
    id: number; file_id: number; chunk_index: number; content_text: string; similarity: number | null;
    file_name: string; section_id?: string | null;
}

/** Prioritize matches, then their neighbors; cap the entire prompt context including labels. */
export function buildKnowledgeContext(matches: RetrievedKnowledgeRow[], neighbors: RetrievedKnowledgeRow[], maxChars = RAG_CONTEXT_MAX_CHARS, maxChunks = RAG_MAX_CHUNKS, question = '') {
    const selected: RetrievedKnowledgeRow[] = [];
    const ids = new Set<number>();
    const focusBudget = question ? Math.min(1200, Math.floor(maxChars / 4)) : 0;
    let remaining = maxChars - focusBudget;
    for (const row of [...matches, ...neighbors]) {
        if (ids.has(row.id) || selected.length >= maxChunks || !row.content_text?.trim()) continue;
        const labelBudget = 200;
        if (remaining < labelBudget + 100) break;
        // Legacy rows can exceed current chunk limits; keep their context bounded too.
        const text = row.content_text.slice(0, remaining - labelBudget).replace(/[\uD800-\uDBFF]$/, '');
        selected.push({ ...row, content_text: text }); ids.add(row.id);
        remaining -= text.length + labelBudget;
    }
    const fileOrder = [...new Set(selected.map(row => row.file_id))];
    selected.sort((a, b) => fileOrder.indexOf(a.file_id) - fileOrder.indexOf(b.file_id) || a.chunk_index - b.chunk_index);
    const documentTitles = fileOrder.map(fileId => {
        const row = selected.find(item => item.file_id === fileId)!;
        return String(row.file_name || 'Document').slice(0, 160);
    });
    const fullText = selected.map(row => `[Source ${fileOrder.indexOf(row.file_id) + 1}: ${documentTitles[fileOrder.indexOf(row.file_id)]}]\n${row.content_text}`).join('\n\n---\n\n');
    const terms = searchTerms(question);
    const passages = selected.flatMap(row => {
        const heading = row.content_text.split('\n').find(text => /^\[[^\]]+\s>\s[^\]]+\]$/.test(text.trim()))?.trim();
        const headingNames = new Set(heading?.slice(1, -1).split(/\s*>\s*/).map(text => text.normalize('NFKC').toLowerCase()) || []);
        const headingMatches = heading && terms.some(term => heading.normalize('NFKC').toLowerCase().includes(term));
        // Image/heading-only chunks are navigation context, not the facts to highlight for generation.
        const sentences = row.content_text.split(/(?<=[。！？.!?])\s*|\n+/u).map(text => text.trim()).filter(text => text
            && !/^\[[^\]]+\]$/.test(text) && !headingNames.has(text.normalize('NFKC').toLowerCase()));
        return sentences.flatMap((sentence, index) => {
            const body = [sentence, sentences[index + 1] || ''].join(' ').trim();
            const text = headingMatches ? `${heading} ${body}` : body;
            return text.length <= 420 && (headingMatches || terms.some(term => body.normalize('NFKC').toLowerCase().includes(term)))
                ? [{ content_text: text, file_id: row.file_id }] : [];
        });
    });
    const focused: string[] = [];
    let used = 50;
    for (const passage of rankLexical(passages, terms)) {
        if (focused.length >= 3) break;
        const text = `[Source ${fileOrder.indexOf(passage.file_id) + 1}] ${passage.content_text}`;
        if (focused.some(item => item.includes(passage.content_text)) || used + text.length + 1 > focusBudget) continue;
        focused.push(text); used += text.length + 1;
    }
    const contextText = focused.length ? `${fullText}\n\nQUESTION-RELEVANT EXCERPTS (verbatim):\n${focused.join('\n')}` : fullText;
    return { contextText };
}

export interface FaqMatch { id: number; question: string; answer_text: string; redirect_url: string | null; category?: string; keywords?: string; site_id?: string; category_match?: boolean; category_match_count?: number | string; question_match?: boolean; question_match_count?: number | string; }

export async function searchFaqByKeywords(cleanSiteId: string, effectiveMsg: string): Promise<FaqMatch[]> {
    const faqCandidateQuery = `
            SELECT f.id, f.question, f.answer_text, f.redirect_url, f.category, f.keywords, f.site_id,
                (LOWER(f.category) = LOWER($2)) AS category_match,
                COUNT(*) FILTER (WHERE LOWER(f.category) = LOWER($2)) OVER () AS category_match_count,
                (LOWER(TRIM(f.question)) = LOWER($2)) AS question_match,
                COUNT(*) FILTER (WHERE LOWER(TRIM(f.question)) = LOWER($2)) OVER () AS question_match_count,
                COALESCE((
                    SELECT MAX(LENGTH(TRIM(kw)))
                    FROM unnest(string_to_array(f.keywords, ',')) AS kw
                    WHERE LENGTH(TRIM(kw)) > 0 AND POSITION(LOWER(TRIM(kw)) IN LOWER($2)) > 0
                ), 0) AS keyword_match_len
            FROM public.faq_master f
            WHERE LOWER(f.site_id) = $1 AND f.is_draft = FALSE AND f.approval_status = 'approved'
              AND NOT EXISTS (SELECT 1 FROM public.faq_import_batches b WHERE b.id = f.import_batch_id AND b.approval_status = 'rejected')
              AND NOT (length(f.question) > 500 AND trim(f.question) = trim(f.answer_text))
              AND (
                LOWER(f.category) = LOWER($2) OR LOWER(TRIM(f.question)) = LOWER($2)
                OR EXISTS (
                    SELECT 1 FROM unnest(string_to_array(f.keywords, ',')) AS kw
                    WHERE LENGTH(TRIM(kw)) > 0 AND POSITION(LOWER(TRIM(kw)) IN LOWER($2)) > 0
                )
              )
            ORDER BY question_match DESC, category_match DESC, keyword_match_len DESC, f.id
            LIMIT ${CANDIDATE_POOL_SIZE};
        `;
    const keywordCandidatesRes = await pool.query(faqCandidateQuery, [cleanSiteId, effectiveMsg]);
    const keywordCandidates = keywordCandidatesRes.rows;

    return keywordCandidates;
}

export async function searchFaqByVector(cleanSiteId: string, vectorStr: string | null, candidates: FaqMatch[]): Promise<FaqMatch[]> {
    const arbitrationPool = [...candidates];
    const poolIds = new Set(candidates.map(c => c.id));
    if (vectorStr) {
        try {
            const topFaqRes = await pool.query(`
                    SELECT id, question, answer_text, redirect_url, category, keywords, site_id, (1 - (embedding <=> $2::vector)) AS similarity
                    FROM public.faq_master f
                    WHERE site_id = $1 AND is_draft = FALSE AND approval_status = 'approved' AND embedding IS NOT NULL
                      AND NOT EXISTS (SELECT 1 FROM public.faq_import_batches b WHERE b.id = f.import_batch_id AND b.approval_status = 'rejected')
                      AND NOT (length(question) > 500 AND trim(question) = trim(answer_text))
                    ORDER BY similarity DESC LIMIT $3;
                `, [cleanSiteId, vectorStr, FAQ_EMBED_TOP_K]);

            for (const r of topFaqRes.rows) {
                if (r.similarity >= FAQ_EMBED_SIMILARITY_THRESHOLD && !poolIds.has(r.id)) {
                    poolIds.add(r.id);
                    arbitrationPool.push(r);
                }
            }
        } catch (err) {
            console.error("⚠️ FAQ embedding検索でエラー（キーワード候補のみで続行）:", err);
        }
    }

    return arbitrationPool;
}

export async function retrieveKnowledge(cleanSiteId: string, vectorStr: string | null, question = '') {
    const terms = searchTerms(question);
    const searches = await Promise.allSettled([
        vectorStr ? pool.query<RetrievedKnowledgeRow>(`
                    SELECT c.id, c.file_id, c.chunk_index, c.content_text, c.section_id,
                           f.file_name, (1 - (c.embedding <=> $2::vector)) AS similarity
                    FROM public.site_knowledge_chunks c
                    INNER JOIN public.site_knowledge_files f ON f.id = c.file_id
                    WHERE c.site_id = $1 AND f.site_id = $1 AND f.approval_status = 'approved' AND f.status = 'completed'
                      AND (1 - (c.embedding <=> $2::vector)) > $3
                    ORDER BY c.embedding <=> $2::vector ASC LIMIT $4;
                `, [cleanSiteId, vectorStr, RAG_SIMILARITY_THRESHOLD, RAG_TOP_K * 4]) : Promise.resolve({ rows: [] as RetrievedKnowledgeRow[] }),
        terms.length ? pool.query<RetrievedKnowledgeRow>(`
            SELECT c.id, c.file_id, c.chunk_index, c.content_text, c.section_id,
                   f.file_name, NULL::float AS similarity
            FROM public.site_knowledge_chunks c JOIN public.site_knowledge_files f ON f.id = c.file_id
            WHERE c.site_id = $1 AND f.site_id = $1 AND f.status = 'completed' AND f.approval_status = 'approved'
              AND lower(c.content_text) LIKE ANY($2::text[])
            ORDER BY (SELECT SUM(length(term)) FROM unnest($3::text[]) AS term WHERE POSITION(term IN lower(c.content_text)) > 0) DESC, c.id
            LIMIT $4`, [cleanSiteId, searchPatterns(terms), terms, RAG_TOP_K * 4]) : Promise.resolve({ rows: [] as RetrievedKnowledgeRow[] }),
    ]);
    for (const result of searches) if (result.status === 'rejected') console.error('Knowledge search branch failed:', result.reason);
    const semantic = searches[0]!.status === 'fulfilled' ? searches[0]!.value.rows : [];
    const lexical = searches[1]!.status === 'fulfilled' ? rankLexical(searches[1]!.value.rows, terms) : [];
    const matches = fuseKnowledge(semantic, lexical, RAG_TOP_K);
    if (matches.length) {
        try {
                const neighbors = await pool.query<RetrievedKnowledgeRow>(`
                    SELECT c.id, c.file_id, c.chunk_index, c.content_text, c.section_id,
                           f.file_name, NULL::float AS similarity,
                           array_position($2::int[], seed.id) AS seed_rank
                    FROM public.site_knowledge_chunks seed
                    INNER JOIN public.site_knowledge_chunks c ON c.file_id = seed.file_id
                      AND c.chunk_index IN (seed.chunk_index - 1, seed.chunk_index + 1)
                      AND COALESCE(c.section_id, '') = COALESCE(seed.section_id, '')
                    INNER JOIN public.site_knowledge_files f ON f.id = c.file_id
                    WHERE seed.id = ANY($2::int[]) AND seed.site_id = $1 AND c.site_id = $1
                      AND f.site_id = $1 AND f.status = 'completed' AND f.approval_status = 'approved'
                      AND NOT (c.id = ANY($3::int[]))
                    ORDER BY seed_rank, c.chunk_index LIMIT $4;
                `, [cleanSiteId, matches.map(row => row.id), matches.map(row => row.id), RAG_TOP_K * 2]);
                return buildKnowledgeContext(matches, neighbors.rows, RAG_CONTEXT_MAX_CHARS, RAG_MAX_CHUNKS, question);
        } catch (err) {
            console.error('Knowledge neighbor search failed:', err);
            return buildKnowledgeContext(matches, [], RAG_CONTEXT_MAX_CHARS, RAG_MAX_CHUNKS, question);
        }
    }

    return { ...buildKnowledgeContext([], []), searchFailed: searches.some(result => result.status === 'rejected') };
}
