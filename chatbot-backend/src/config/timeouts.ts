import { integerSetting } from './capacity';

/** Limits for each AI call (including model loading) and database connection. */
export const TIMEOUTS = {
    embedding: integerSetting('AI_EMBEDDING_TIMEOUT_MS', 60_000, 1, 600_000),
    response: integerSetting('AI_RESPONSE_TIMEOUT_MS', 120_000, 1, 600_000),
    database: integerSetting('DB_CONNECTION_TIMEOUT_MS', 10_000, 1, 300_000),
};
