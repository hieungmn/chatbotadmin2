const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register');

let chunks, embeddingError, storageError, calls;
function stub(modulePath, exports) {
    const id = require.resolve(modulePath);
    require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub('../src/config/capacity', { CAPACITY: { knowledgeMaxChunks: 0 } });
stub('../src/config/db', { __esModule: true, default: { connect: async () => {
    calls.push(['connect']);
    return { query: async (sql, params) => {
        calls.push([sql, params]);
        if (sql.includes('INSERT INTO public.site_knowledge_files')) return { rows: [{ id: 42 }] };
        if (storageError && sql.includes('INSERT INTO public.site_knowledge_chunks')) throw storageError;
        return { rows: [] };
    }, release: () => calls.push(['release']) };
} } });
stub('../src/modules/knowledge/file-extraction', {
    extractKnowledgeDocument: async () => ({ chunks, warnings: ['A page was skipped.'] }),
});
stub('../src/modules/ai/ollama.service', { getEmbedding: async () => {
    if (embeddingError) throw embeddingError;
    return Array(768).fill(0.1);
} });
const { importKnowledgeFile } = require('../src/modules/knowledge/knowledge-import.service');
const input = { siteId: 'demo', name: 'manual.pdf', type: 'pdf', path: 'temp-file', userId: 1, approval: 'pending' };
function reset() {
    chunks = [{ text: 'Supported answer', pageNumber: 2, sectionId: 'section-1' }];
    embeddingError = null; storageError = null; calls = [];
}

test('direct knowledge upload', async t => {
    await t.test('publishes complete content and preserves approval, source location and warnings', async () => {
        reset();
        const result = await importKnowledgeFile(input);
        assert.deepEqual(result, { file_id: 42, chunk_count: 1, warnings: ['A page was skipped.'] });
        const fileInsert = calls.find(([sql]) => sql.includes('INSERT INTO public.site_knowledge_files'));
        assert.equal(fileInsert[1][3], 'pending');
        const chunkInsert = calls.find(([sql]) => sql.includes('INSERT INTO public.site_knowledge_chunks'));
        const values = chunkInsert[1];
        assert.equal(values[2], 0);
        assert.equal(values[5], 'section-1');
        assert.equal(values[7], 2);
        assert.equal(JSON.parse(values[4]).length, 768);
        assert.deepEqual(calls.slice(-2).map(([sql]) => sql), ['COMMIT', 'release']);
    });
    await t.test('empty documents are rejected without creating database records', async () => {
        reset(); chunks = [];
        await assert.rejects(importKnowledgeFile(input), /読み取れる本文/);
        assert.equal(calls.length, 0);
    });
    await t.test('embedding failure leaves no file or chunks in the database', async () => {
        reset(); embeddingError = new Error('Ollama unavailable');
        await assert.rejects(importKnowledgeFile(input), /Ollama unavailable/);
        assert.equal(calls.length, 0);
    });
    await t.test('storage failure rolls back the file and chunks together', async () => {
        reset(); storageError = new Error('Storage failed');
        await assert.rejects(importKnowledgeFile(input), /Storage failed/);
        assert.ok(!calls.some(([sql]) => sql === 'COMMIT'));
        assert.deepEqual(calls.slice(-2).map(([sql]) => sql), ['ROLLBACK', 'release']);
    });
});
