export interface OllamaResponse {
    response?: string;
}
export interface ConversationTurn {
    role: 'user' | 'assistant';
    content: string;
}

export interface GenerateAnswerResult {
    outcome?: 'answered' | 'insufficient_context' | 'provider_error';
    status?: 'success' | 'failed' | 'timeout';
    text: string;
}

export interface FaqCandidate {
    id: number;
    question: string;
    answer_text: string;
    category?: string;
    keywords?: string;
    site_id?: string;
}

export interface ChooseFaqResult {
    status?: 'success' | 'failed' | 'timeout';
    chosenId: number | null;
}
