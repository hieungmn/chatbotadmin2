import type { Request, RequestHandler } from 'express';
import { CAPACITY } from '../config/capacity';

/** Process-local limiter. Use a shared gateway/store when running multiple replicas. */
export function rateLimit(options: { max: number; windowMs: number; key?: (req: Request) => string; now?: () => number }): RequestHandler {
    const buckets = new Map<string, { count: number; resetAt: number }>();
    const now = options.now ?? Date.now;
    let nextCleanup = 0;
    return (req, res, next) => {
        if (options.max === 0) { next(); return; }
        const time = now();
        if (time >= nextCleanup) {
            for (const [key, bucket] of buckets) if (bucket.resetAt <= time) buckets.delete(key);
            nextCleanup = time + Math.min(options.windowMs, 60_000);
        }
        const key = options.key?.(req) ?? req.ip ?? req.socket.remoteAddress ?? 'unknown';
        let bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= time) {
            // Bound memory without evicting active limits. Unknown clients retry after the window.
            if (!bucket && buckets.size >= 10_000) {
                res.setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
                res.status(429).json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' });
                return;
            }
            bucket = { count: 0, resetAt: time + options.windowMs };
            buckets.set(key, bucket);
        }
        if (++bucket.count > options.max) {
            res.setHeader('Retry-After', Math.max(1, Math.ceil((bucket.resetAt - time) / 1000)));
            res.status(429).json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' });
            return;
        }
        next();
    };
}

export const chatQueryLimit = rateLimit({ max: CAPACITY.chatIpPerMinute, windowMs: 60_000 });
export const chatApiLimit = rateLimit({ max: CAPACITY.chatApiIpPerMinute, windowMs: 60_000 });
const sessionLimit = rateLimit({ max: CAPACITY.chatSessionPerMinute, windowMs: 60_000,
    key: req => `${req.ip}:${String(req.body?.site_id || '').slice(0, 50).trim().toLowerCase()}:${req.body.session_id}` });
export const chatSessionLimit: RequestHandler = (req, res, next) => {
    // The first request has no session yet; shared-office users must not share its bucket.
    const session = req.body?.session_id;
    if (typeof session !== 'string' || !session.trim() || session.length > 100) { next(); return; }
    sessionLimit(req, res, next);
};
export const loginLimit = rateLimit({ max: 20, windowMs: 15 * 60_000 });
export const knowledgeImportLimit = rateLimit({ max: CAPACITY.knowledgePerWindow, windowMs: 15 * 60_000,
    key: req => String((req as any).user?.id ?? req.ip ?? 'unknown') });
