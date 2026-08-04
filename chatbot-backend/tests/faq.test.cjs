const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register');
const { stub, response } = require('./helpers.cjs');
let calls, query, released;
const client = { query: async (sql, params) => { calls.push({ sql, params }); return query(sql, params); }, release: () => released++ };
stub('../src/config/db', { __esModule: true, default: { connect: async () => client, query: (...args) => client.query(...args) } });
stub('../src/modules/faq/faq-embedding', { computeFaqEmbedding: async () => '[0.1]' });
const { assertFaqChange, lockFaq } = require('../src/modules/faq/faq-permission');
const { reviewFaqBatch } = require('../src/modules/faq/faq-batch.controller');
const { importFaqRows } = require('../src/modules/faq/faq-import.service');
beforeEach(() => { calls = []; released = 0; query = async () => ({ rows: [] }); });

test('rejected import files block both editing and individual FAQ approval', () => {
    for (const review of [false, true]) {
        const res = response();
        assert.equal(assertFaqChange({ import_batch_id: 4, approval_status: 'approved', batch_approval_status: 'rejected' }, res, review), false);
        assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'FAQ_REJECTED');
    }
});
test('individually rejected FAQ must be reapproved before editing', () => {
    const faq = { import_batch_id: null, approval_status: 'rejected' };
    assert.equal(assertFaqChange(faq, response()), false);
    assert.equal(assertFaqChange(faq, response(), true), true);
    assert.equal(assertFaqChange({ ...faq, approval_status: 'approved' }, response()), true);
});
test('missing FAQ returns 404', () => {
    const res = response(); assert.equal(assertFaqChange(null, res), false); assert.equal(res.statusCode, 404);
});
test('FAQ editing locks its parent batch before locking the FAQ', async () => {
    query = async sql => ({ rows: sql.includes('SELECT import_batch_id') ? [{ import_batch_id: 4 }]
        : sql.includes('faq_import_batches') ? [{ approval_status: 'rejected' }]
            : [{ site_id: 'site-a', import_batch_id: 4, approval_status: 'approved' }] });
    const faq = await lockFaq(client, '9');
    assert.equal(faq.batch_approval_status, 'rejected');
    const locks = calls.filter(c => c.sql.includes('FOR UPDATE'));
    assert.ok(locks[0].sql.includes('faq_import_batches')); assert.ok(locks[1].sql.includes('faq_master'));
});
test('batch review updates the batch and its FAQs in one transaction', async () => {
    for (const approve of [false, true]) {
        calls = []; released = 0;
        query = async sql => ({ rows: sql.startsWith('SELECT id') ? [{ id: 4 }] : [] });
        const res = response();
        await reviewFaqBatch({ user: { id: 1 }, params: { id: '4' }, body: { approve } }, res);
        assert.equal(res.body.success, true);
        const updates = calls.filter(c => c.sql.startsWith('UPDATE'));
        assert.equal(updates.length, 2);
        for (const update of updates) assert.deepEqual(update.params, [approve ? 'approved' : 'rejected', 1, '4']);
        assert.equal(calls[0].sql, 'BEGIN'); assert.equal(calls.at(-1).sql, 'COMMIT'); assert.equal(released, 1);
    }
});
test('invalid review input is rejected without opening a transaction', async () => {
    const res = response();
    await reviewFaqBatch({ user: { id: 1 }, params: { id: '4' }, body: { approve: 'false' } }, res);
    assert.equal(res.statusCode, 400); assert.equal(calls.length, 0);
});
test('failed FAQ batch update rolls back instead of committing approval', async t => {
    t.mock.method(console, 'error', () => {});
    query = async sql => {
        if (sql.startsWith('SELECT id')) return { rows: [{ id: 4 }] };
        if (sql.startsWith('UPDATE public.faq_master')) throw new Error('Storage failure');
        return { rows: [] };
    };
    const res = response();
    await reviewFaqBatch({ user: { id: 1 }, params: { id: '4' }, body: { approve: true } }, res);
    assert.equal(res.statusCode, 500); assert.equal(calls.at(-1).sql, 'ROLLBACK');
    assert.ok(!calls.some(c => c.sql === 'COMMIT')); assert.equal(released, 1);
});
test('Excel import skips foreign sites, incomplete rows and duplicates while keeping staff approval pending', async () => {
    query = async (sql, params) => ({ rows: sql.includes('SELECT 1') ? (params[1] === 'Duplicate' ? [{}] : [])
        : sql.includes('INSERT INTO') ? (params[0] === 'existing-id' ? [] : [{ id: 9 }]) : [] });
    const base = { data_id: 'new', question: 'Valid question', answer_text: 'Valid answer' };
    const result = await importFaqRows(client, 4, 'site-a', { id: 7 }, 'pending', [
        { ...base, site_id: 'site-b' }, { ...base, data_id: '' }, { ...base, answer_text: '' },
        { ...base, question: 'Duplicate' }, { ...base, data_id: 'existing-id' }, base,
    ]);
    assert.deepEqual(result, { inserted: 1, skipped: 5 });
    const saved = calls.filter(c => c.sql.includes('INSERT INTO')).at(-1).params;
    assert.equal(saved[1], 'site-a'); assert.equal(saved[2], 4); assert.equal(saved[8], false); assert.equal(saved[9], 'pending');
});
