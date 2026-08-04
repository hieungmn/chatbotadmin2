import { integerSetting } from '../../config/capacity';
export const RAG_TOP_K = integerSetting('RAG_TOP_K', 8, 1, 32);
export const RAG_MAX_CHUNKS = integerSetting('RAG_MAX_CHUNKS', Math.max(24, RAG_TOP_K), RAG_TOP_K, 96);
export const RAG_CONTEXT_MAX_CHARS = integerSetting('RAG_CONTEXT_MAX_CHARS', 16_000, 1000, 100_000);

export const RAG_SIMILARITY_THRESHOLD = 0.25;

export const FAQ_EMBED_TOP_K = 5;

export const FAQ_EMBED_SIMILARITY_THRESHOLD = 0.5;

// AIに渡す候補を絞り込む類似度の下限
export const CONVERSATION_HISTORY_TURNS = 5;

export const CANDIDATE_POOL_SIZE = 5;

