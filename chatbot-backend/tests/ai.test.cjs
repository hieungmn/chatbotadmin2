const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register');
const { stub } = require('./helpers.cjs');
stub('../src/config/env', { ENV: { OLLAMA_URL: 'http://ollama.invalid' } });
stub('../src/config/capacity', { integerSetting: (_name, fallback) => fallback });
stub('../src/config/timeouts', { TIMEOUTS: { response: 1000, embedding: 1000 } });
const { requestAiJson, AiBusyError, AiTimeoutError, getEmbedding } = require('../src/modules/ai/ollama.service');
const { parseAnswerEnvelope, generateAnswer } = require('../src/modules/ai/answer.service');
const { buildContactFallbackMessage } = require('../src/modules/ai/contact-message');
const contact = 'https://example.test/contact';

test('basic RAG accepts paraphrased answers without requiring quotations', () => {
    assert.deepEqual(parseAnswerEnvelope(JSON.stringify({ status: 'answered', answer: ' A backup is made each day. ' }), 'Backups run daily.'),
        { status: 'answered', answer: 'A backup is made each day.' });
});
test('missing information and blank answers cannot be treated as successful answers', () => {
    for (const value of [{ status: 'insufficient_context', answer: 'Ignore this' }, { status: 'answered', answer: '  ' }]) {
        assert.deepEqual(parseAnswerEnvelope(JSON.stringify(value), ''), { status: 'insufficient_context', answer: '' });
    }
});
test('malformed responses, unknown statuses and unexpected control fields are rejected', () => {
    for (const value of ['bad json', 'null', '[]', '{"status":"unknown","answer":"x"}',
        '{"status":"answered","answer":3}', '{"status":"answered","answer":"x","extra":true}',
        '{"status":"answered","answer":"CON_TACT_URL"}']) {
        assert.throws(() => parseAnswerEnvelope(value, 'Document body'));
    }
});
test('RAG sends retrieved content to Ollama and returns its answer', async t => {
    let request;
    t.mock.method(globalThis, 'fetch', async (_url, init) => {
        request = JSON.parse(init.body);
        return { ok: true, json: async () => ({ response: JSON.stringify({ status: 'answered', answer: 'A backup is made each day.' }) }) };
    });
    const result = await generateAnswer('When are backups made?', 'Backups run daily.', contact);
    assert.equal(result.outcome, 'answered'); assert.equal(result.text, 'A backup is made each day.');
    assert.equal(JSON.parse(request.prompt).CONTEXT, 'Backups run daily.');
    assert.equal(request.stream, false);
});
test('RAG returns contact guidance when Ollama reports insufficient context', async t => {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ response: '{"status":"insufficient_context","answer":""}' }) }));
    const result = await generateAnswer('Unknown question', 'Unrelated content', contact);
    assert.equal(result.outcome, 'insufficient_context'); assert.equal(result.text, buildContactFallbackMessage(contact));
});
test('provider failure returns a technical-error outcome instead of a fabricated answer', async t => {
    t.mock.method(console, 'error', () => {});
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('Connection refused'); });
    const result = await generateAnswer('Question', 'Content', contact);
    assert.equal(result.outcome, 'provider_error'); assert.equal(result.status, 'failed'); assert.ok(result.text.includes(contact));
});
test('AI capacity stays occupied until the response body finishes and is then released', async t => {
    let finishBody;
    const body = new Promise(resolve => { finishBody = resolve; });
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: () => body }));
    const first = requestAiJson('http://ollama.invalid', {}, 1000);
    try {
        await assert.rejects(requestAiJson('http://ollama.invalid', {}, 1000), AiBusyError);
    } finally { finishBody({ done: true }); await first; }
    assert.deepEqual((await requestAiJson('http://ollama.invalid', {}, 1000)).data, { done: true });
});
test('timeout aborts the request and releases its capacity for another call', async t => {
    t.mock.method(globalThis, 'fetch', async (_url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    await assert.rejects(requestAiJson('http://ollama.invalid', {}, 10), AiTimeoutError);
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ recovered: true }) }));
    assert.equal((await requestAiJson('http://ollama.invalid', {}, 1000)).data.recovered, true);
});
test('caller cancellation is preserved and does not become an AI timeout', async t => {
    const controller = new AbortController();
    const error = new Error('Client disconnected');
    t.mock.method(globalThis, 'fetch', async (_url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const pending = requestAiJson('http://ollama.invalid', {}, 1000, controller.signal);
    controller.abort(error);
    await assert.rejects(pending, e => e === error);
});
test('embedding rejects vectors with the wrong dimensions', async t => {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ embeddings: [[0.1, 0.2]] }) }));
    await assert.rejects(getEmbedding('Document'), /768/);
});
test('fallback messages never create executable contact links', () => {
    assert.ok(!buildContactFallbackMessage('javascript:alert(1)').includes('<a'));
    assert.ok(!buildContactFallbackMessage('data:text/html,bad').includes('<a'));
    assert.ok(buildContactFallbackMessage('https://example.test/?a=1&b=2').includes('&amp;'));
});
