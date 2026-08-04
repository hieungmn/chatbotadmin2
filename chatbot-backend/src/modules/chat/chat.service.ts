import pool from '../../config/db';
import { saveSearch, saveMessage, stripReferenceFooter, loadChatSiteConfig, needsConversationContext, startChat } from './chat.repository';
import { GenerateAnswerResult } from '../ai/ai.types';
import { FaqMatch, searchFaqByKeywords, searchFaqByVector, retrieveKnowledge } from './chat-retrieval.service';
import { generateAnswer } from '../ai/answer.service';
import { getEmbedding, AiBusyError } from '../ai/ollama.service';
import { selectFaq } from '../ai/faq-selection.service';
import { retrievalQuestion } from '../ai/conversation-context';
import { buildClarificationMessage, buildContactFallbackMessage, buildProviderErrorMessage } from '../ai/contact-message';
export async function replyWithFaq(finalSessionId: string, cleanSiteId: string, effectiveMsg: string, faq: FaqMatch) {

    const faqImages = await pool.query(
        'SELECT image_path FROM public.faq_images,WHERE faq_id = $1 ORDER BY display_order ASC, id ASC',
        [faq.id]
    );
    const imagePaths = faqImages.rows.map((r: any) => r.image_path);
    await saveMessage({ sessionId: finalSessionId, role: "assistant", content: faq.answer_text, images: imagePaths });
    await saveSearch({
        sessionId: finalSessionId, siteId: cleanSiteId, queryText: effectiveMsg,
        matchedFaqId: faq.id, responseSource: "faq",
    });
    return {
        success: true, answer: faq.answer_text, redirect_url: faq.redirect_url,
        faq_id: faq.id, is_fallback: false, session_id: finalSessionId,
        source: "faq", answer_status: 'answered', images: imagePaths,
    };

}

interface AiReplyInput {
    finalSessionId: string; cleanSiteId: string; effectiveMsg: string; modelName: string;
    aiResult: GenerateAnswerResult;
    isFallback: boolean; responseSource: 'ai' | 'escalated';
}
export async function replyWithAi(input: AiReplyInput) {
    const { finalSessionId, cleanSiteId, effectiveMsg, modelName, aiResult, isFallback, responseSource } = input;
    const answer = stripReferenceFooter(aiResult.text);
    // 画像はFAQにのみ添付される（RAG回答には画像を付けない — 誤った画像が
    // 添付されるのを防ぐため。画像を確実に紐付けたい場合はFAQ化して運用する）
    await saveMessage({
        sessionId: finalSessionId, role: "assistant", content: answer, modelName,
    });

    await saveSearch({
        sessionId: finalSessionId, siteId: cleanSiteId, queryText: effectiveMsg,
        matchedFaqId: null, responseSource,
    });

    return {
        success: true, answer, faq_id: isFallback ? -1 : 999,
        is_fallback: isFallback, session_id: finalSessionId,
        source: responseSource,
        answer_status: aiResult.outcome ?? (isFallback ? 'provider_error' : 'answered'),
    };

}

export interface ChatQueryInput {
    site_id: unknown; message: unknown; session_id?: string | null; signal?: AbortSignal;
}

export async function answerQuestion(input: ChatQueryInput, clientIp: string) {
    input.signal?.throwIfAborted();

    const { site_id, message, session_id } = input;

    const cleanSiteId = String(site_id).trim().toLowerCase();
    const cleanMsg = String(message).trim();

    const { contactUrl, modelName, customRules } = await loadChatSiteConfig(cleanSiteId);

    const { finalSessionId, conversationHistory } =
        await startChat(cleanSiteId, cleanMsg, session_id, clientIp);
    const effectiveMsg = cleanMsg;
    input.signal?.throwIfAborted();

    const escalatedMsg = buildContactFallbackMessage(contactUrl);
    const clarificationMsg = buildClarificationMessage();
    const lastAssistant = [...conversationHistory].reverse().find(h => h.role === 'assistant');
    const canClarify = lastAssistant?.content !== clarificationMsg;
    const clarify = async () => {
        await saveMessage({ sessionId: finalSessionId, role: 'assistant', content: clarificationMsg });
        await saveSearch({
            sessionId: finalSessionId, siteId: cleanSiteId, queryText: effectiveMsg,
            matchedFaqId: null, responseSource: 'fallback',
        });
        return {
            success: true, answer: clarificationMsg, faq_id: -1, is_fallback: true,
            session_id: finalSessionId, source: 'fallback', response_kind: 'clarification', answer_status: 'insufficient_context'
        };
    };

    if (cleanMsg.length < 2) {
        if (canClarify) return clarify();
        const fallbackMsg = escalatedMsg;
        await saveMessage({ sessionId: finalSessionId, role: "assistant", content: fallbackMsg });
        await saveSearch({
            sessionId: finalSessionId, siteId: cleanSiteId, queryText: cleanMsg,
            matchedFaqId: null, responseSource: "fallback",
        });
        return {
            success: true, answer: fallbackMsg, faq_id: -1, is_fallback: true,
            session_id: finalSessionId, answer_status: 'insufficient_context',
        };
    }

    // ===== Tier 1: カテゴリ完全一致 =====
    // ===== ＋ キーワード一致候補の収集（即決ではなく、AI選定に回す）=====
    const keywordCandidates = await searchFaqByKeywords(cleanSiteId, effectiveMsg);

    const respondWithFaq = (faq: FaqMatch) => replyWithFaq(finalSessionId, cleanSiteId, effectiveMsg, faq);
    const questionMatches = keywordCandidates.filter(candidate => candidate.question_match);
    if (Number(questionMatches[0]?.question_match_count ?? questionMatches.length) === 1 && questionMatches[0]) return respondWithFaq(questionMatches[0]);

    // カテゴリ完全一致は即決（カテゴリは固定選択肢のため信頼度が高い）
    const categoryMatches = keywordCandidates.filter(c => c.category_match);
    const categoryCount = Number(categoryMatches[0]?.category_match_count ?? categoryMatches.length);
    if (categoryCount === 1 && categoryMatches[0]) return await respondWithFaq(categoryMatches[0]);
    // FAQ without an exact match: search by meaning, then consult the document.


    // ===== 検索クエリのembeddingを1回だけ算出 — Tier候補選定・RAG両方で使い回す =====
    const shouldUseContext = needsConversationContext(effectiveMsg);
    const retrievalQueryText = shouldUseContext ? retrievalQuestion(effectiveMsg, conversationHistory) : effectiveMsg;

    let embeddingFailed = false;
    let selectionFailed = false;
    let questionEmbedding: number[] = [];
    try {
        questionEmbedding = await getEmbedding(retrievalQueryText, input.signal);
    } catch (error) {
        input.signal?.throwIfAborted();
        if (error instanceof AiBusyError) throw error;
        embeddingFailed = true;
        questionEmbedding = [];
    }
    const hasEmbedding = Array.isArray(questionEmbedding) && questionEmbedding.length > 0;
    const vectorStr = hasEmbedding ? `[${questionEmbedding.join(",")}]` : null;

    // ===== キーワード候補 ＋ embedding候補 を統合し、AIに選定させる =====
    let arbitrationPool: FaqMatch[] = [];
    const poolIds = new Set<number>();
    for (const c of keywordCandidates) {
        if (!poolIds.has(c.id)) { poolIds.add(c.id); arbitrationPool.push(c); }
    }

    arbitrationPool = await searchFaqByVector(cleanSiteId, vectorStr, arbitrationPool);

    if (arbitrationPool.length > 0) {
        try {
            const chooseResult = await selectFaq(effectiveMsg, arbitrationPool, modelName,
                shouldUseContext ? conversationHistory : [], input.signal);
            selectionFailed = chooseResult.status === 'failed' || chooseResult.status === 'timeout';

            if (chooseResult.chosenId !== null) {
                const chosen = arbitrationPool.find(r => r.id === chooseResult.chosenId);
                if (chosen) return await respondWithFaq(chosen);
            }
        } catch (err) {
            input.signal?.throwIfAborted();
            if (err instanceof AiBusyError) throw err;
            selectionFailed = true;
            console.error("⚠️ FAQ選定でエラー（RAGへフォールバック）:", err);
        }
    }

    // ===== RAG: 既に算出済みのembeddingをそのまま再利用 =====
    const knowledge = await retrieveKnowledge(cleanSiteId, vectorStr, retrievalQueryText);
    const { contextText } = knowledge;
    input.signal?.throwIfAborted();

    // ===== 十分なナレッジが見つからない → AI生成せず即座に担当窓口へ案内 =====
    if (!contextText) {
        const lookupFailed = embeddingFailed || selectionFailed || ('searchFailed' in knowledge && knowledge.searchFailed);
        if (!lookupFailed && canClarify && hasEmbedding && (shouldUseContext || categoryCount > 1)) return clarify();
        const reply = lookupFailed ? buildProviderErrorMessage(contactUrl) : escalatedMsg;
        await saveMessage({ sessionId: finalSessionId, role: "assistant", content: reply });
        await saveSearch({
            sessionId: finalSessionId, siteId: cleanSiteId, queryText: effectiveMsg,
            matchedFaqId: null, responseSource: "escalated",
        });
        return {
            success: true, answer: reply, faq_id: -1, is_fallback: true,
            session_id: finalSessionId, source: "escalated", answer_status: lookupFailed ? 'provider_error' : 'insufficient_context',
        };
    }

    // ===== ナレッジが見つかった → AIが回答を生成（会話履歴も加味）=====
    const aiResult = await generateAnswer(effectiveMsg, contextText, contactUrl, modelName, conversationHistory, customRules, input.signal);

    const isFallback = aiResult.outcome === 'insufficient_context' || aiResult.outcome === 'provider_error'
        || aiResult.status === 'failed' || aiResult.status === 'timeout';
    const responseSource: "ai" | "escalated" = isFallback ? "escalated" : "ai";

    return replyWithAi({
        finalSessionId, cleanSiteId, effectiveMsg, modelName, aiResult,
        isFallback, responseSource,
    });
}
