import { ENV } from '../../config/env';
import { integerSetting } from '../../config/capacity';
import { TIMEOUTS } from '../../config/timeouts';
import { OllamaResponse } from './ai.types';

export const OLLAMA_URL = ENV.OLLAMA_URL;

export const DEFAULT_MODEL = 'gemma3:4b';
export const OLLAMA_CONTEXT_TOKENS = integerSetting('OLLAMA_CONTEXT_TOKENS', 32_768, 2048, 262_144);
export const OLLAMA_OUTPUT_TOKENS = integerSetting('OLLAMA_OUTPUT_TOKENS', 2048, 128, 32_768);

export class AiBusyError extends Error {
    constructor() { super('AI is busy. Please try again shortly.'); }
}

const maxRequests = integerSetting('AI_MAX_CONCURRENCY', 1, 1, 32);
let activeRequests = 0;

export class AiTimeoutError extends Error {
    constructor() { super('AI request timed out.'); }
}

/** Keep the deadline active until the response body has been consumed. */
export async function requestAiJson<T>(url: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal): Promise<{ res: Response; data: T }> {
    const caller = signal ?? init.signal ?? undefined;
    caller?.throwIfAborted();
    if (activeRequests >= maxRequests) throw new AiBusyError();
    activeRequests++;
    const controller = new AbortController();
    let timedOut = false;
    const onAbort = () => controller.abort(caller?.reason);
    caller?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        const data = await res.json() as T;
        caller?.throwIfAborted();
        if (timedOut) throw new AiTimeoutError();
        if (!res.ok) throw new Error(`AI provider returned HTTP ${res.status}.`);
        return { res, data };
    } catch (error) {
        if (caller?.aborted) throw caller.reason;
        if (timedOut) throw new AiTimeoutError();
        throw error;
    } finally {
        activeRequests--;
        clearTimeout(timer);
        caller?.removeEventListener('abort', onAbort);
    }
}

export function aiFailure(error: unknown): { status: 'failed' | 'timeout' } {
    return {
        status: error instanceof AiTimeoutError ? 'timeout' : 'failed',
    };
}

export const OLLAMA_KEEP_ALIVE = '30m';
/** Ollama loads the requested model as part of this call; there is no warmup or waiting queue. */
export async function generateJson<T>(body: Record<string, unknown>, signal?: AbortSignal) {
    return requestAiJson<T>(`${OLLAMA_URL}/api/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, keep_alive: OLLAMA_KEEP_ALIVE }),
    }, TIMEOUTS.response, signal);
}

export async function callOllama(systemPrompt: string, userPrompt: string, model: string,
    schema?: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    const { data } = await generateJson<OllamaResponse>({
        model: model || DEFAULT_MODEL,
        system: systemPrompt,
        prompt: userPrompt,
        stream: false,
        ...(schema ? { format: schema } : {}),
        options: { temperature: 0.2, top_p: 0.95, num_ctx: OLLAMA_CONTEXT_TOKENS,
            num_predict: OLLAMA_OUTPUT_TOKENS, repeat_penalty: 1.1 },
    }, signal);
    if (typeof data?.response !== 'string' || !data.response.trim()) throw new Error('Empty Ollama response.');
    return data.response.trim();
}

const MODEL = 'nomic-embed-text';
const validVector = (value: unknown): value is number[] => Array.isArray(value) && value.length === 768
    && value.every(item => typeof item === 'number' && Number.isFinite(item));

/** Keep the same embedding model so stored documents and questions remain comparable. */
export const getEmbedding = async (text: string, signal?: AbortSignal): Promise<number[]> => {
    signal?.throwIfAborted();
    const request = { model: MODEL, input: text, truncate: false, keep_alive: OLLAMA_KEEP_ALIVE };
    const { data } = await requestAiJson<{ embeddings?: number[][] }>(`${OLLAMA_URL}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
    }, TIMEOUTS.embedding, signal);
    const vector = data?.embeddings?.[0];
    if (!validVector(vector)) {
        throw new Error('Invalid embedding: expected 768 finite numbers.');
    }
    signal?.throwIfAborted();
    return vector;
};
