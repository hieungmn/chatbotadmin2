const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register');
const { stub, response } = require('./helpers.cjs');
let answers, answer, queries, rows;
class AiBusyError extends Error {}
class ChatSessionMismatchError extends Error {}
class ChatSiteUnavailableError extends Error {}
stub('../src/config/db', { __esModule: true, default: { query: async (sql, params) => {
    queries.push({ sql, params }); return { rows };
} } });
stub('../src/modules/ai/ollama.service', { AiBusyError });
stub('../src/modules/chat/chat.repository', { ChatSessionMismatchError, ChatSiteUnavailableError, stripReferenceFooter: text => text });
stub('../src/modules/chat/chat.service', { answerQuestion: async (...args) => { answers.push(args); return answer(...args); } });
const { handleChatQuery, getChatHistory } = require('../src/modules/chat/chat.controller');
const body = { site_id: 'site-a', message: 'Question', session_id: 'session-a' };
beforeEach(() => { answers = []; queries = []; rows = []; answer = async () => ({ success: true, answer: 'Reply', answer_status: 'answered' }); });
const req = data => ({ body: data, ip: '127.0.0.1', socket: {} });

test('invalid chat input is rejected before AI processing', async () => {
    for (const input of [undefined, {}, { ...body, message: ' ' }, { ...body, message: 'x'.repeat(4001) },
        { ...body, site_id: 'x'.repeat(51) }, { ...body, session_id: 'x'.repeat(101) }, { ...body, message: 3 }]) {
        const res = response(); await handleChatQuery(req(input), res); assert.equal(res.statusCode, 400);
    }
    assert.equal(answers.length, 0);
});
test('maximum-length chat input is accepted and returns the service result', async () => {
    const res = response();
    await handleChatQuery(req({ site_id: 's'.repeat(50), message: 'q'.repeat(4000), session_id: 'a'.repeat(100) }), res);
    assert.equal(res.body.answer_status, 'answered'); assert.equal(answers.length, 1);
    assert.equal(answers[0][1], '127.0.0.1'); assert.equal(res.listenerCount('close'), 0);
});
test('AI busy returns 503 with SERVER_BUSY and a retry hint', async () => {
    answer = async () => { throw new AiBusyError(); };
    const res = response(); await handleChatQuery(req(body), res);
    assert.equal(res.statusCode, 503); assert.equal(res.body.code, 'SERVER_BUSY'); assert.equal(res.headers['Retry-After'], 5);
});
test('unavailable sites and cross-site sessions are refused', async () => {
    for (const [ErrorType, expected] of [[ChatSiteUnavailableError, 404], [ChatSessionMismatchError, 403]]) {
        answer = async () => { throw new ErrorType(); };
        const res = response(); await handleChatQuery(req(body), res); assert.equal(res.statusCode, expected);
    }
});
test('disconnect cancels processing and does not write a late response', async () => {
    const res = response();
    answer = async ({ signal }) => { res.emit('close'); assert.equal(signal.aborted, true); signal.throwIfAborted(); };
    await handleChatQuery(req(body), res);
    assert.equal(res.body, undefined); assert.equal(res.listenerCount('close'), 0);
});
test('history from another site returns no messages and never reads message bodies', async () => {
    const res = response();
    await getChatHistory({ query: { site_id: 'site-b', session_id: 'session-a' } }, res);
    assert.deepEqual(res.body, { success: true, messages: [] });
    assert.equal(queries.length, 1); assert.deepEqual(queries[0].params, ['session-a', 'site-b']);
});
