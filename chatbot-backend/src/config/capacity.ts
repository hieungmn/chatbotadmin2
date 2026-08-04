import './env';

/** Runtime capacity settings; zero disables a limit only where explicitly supported. */
export function integerSetting(name: string, fallback: number, min = 1, max = 1_000_000): number {
    const raw = process.env[name];
    if (raw == null || !raw.trim()) return fallback;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value >= min && value <= max ? value : fallback;
}

export const CAPACITY = {
    knowledgeMaxChunks: integerSetting('KNOWLEDGE_MAX_CHUNKS', 0, 0),
    knowledgeFileBytes: integerSetting('KNOWLEDGE_FILE_MAX_MB', 25, 1, 500) * 1024 * 1024,
    chatSessionPerMinute: integerSetting('CHAT_SESSION_RATE_LIMIT', 60, 0),
    chatIpPerMinute: integerSetting('CHAT_IP_RATE_LIMIT', 1200, 0),
    chatApiIpPerMinute: integerSetting('CHAT_API_IP_RATE_LIMIT', 6000, 0),
    knowledgePerWindow: integerSetting('KNOWLEDGE_IMPORT_RATE_LIMIT', 60, 0),
};
