import { integerSetting } from '../../config/capacity';
import { ConversationTurn } from './ai.types';

// A conservative UTF-8 estimate, not a model-specific tokenizer. No tokenizer runtime required.
export const estimateTokens = (text: string) => Math.ceil(Buffer.byteLength(text, 'utf8') / 2);
export const HISTORY_TOKEN_BUDGET = integerSetting('AI_HISTORY_TOKEN_BUDGET', 8192, 512, 65536);

/** Prefer recent complete turns. Never slice each stored message or the retry question. */
export function selectHistory(history: ConversationTurn[], tokenBudget = HISTORY_TOKEN_BUDGET): ConversationTurn[] {
    const selected: ConversationTurn[] = [];
    let used = 0;
    for (let index = history.length - 1; index >= 0; index--) {
        const turn = history[index];
        const cost = estimateTokens(turn.content) + 8;
        if (used + cost > tokenBudget) break;
        selected.unshift(turn); used += cost;
    }
    return selected;
}

export function generationHistory(history: ConversationTurn[], context: string, question: string, rules: string, contextWindow: number, outputTokens: number) {
    const available = contextWindow - outputTokens - estimateTokens(context + question + rules) - 1600;
    return selectHistory(history, Math.max(0, Math.min(HISTORY_TOKEN_BUDGET, available)));
}

export function retrievalQuestion(question: string, history: ConversationTurn[]): string {
    const budget = Math.max(0, 6500 - estimateTokens(question));
    const recent = selectHistory(history.slice(-4), budget).map(turn => turn.content).join(' ');
    return recent ? `${recent} ${question}` : question;
}
