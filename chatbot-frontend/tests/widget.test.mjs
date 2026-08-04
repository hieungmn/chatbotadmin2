import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapWidgetReply } from '../src/widget/widget-reply.ts';
import { clearAdminAuth } from '../src/api/auth-storage.ts';

test('successful replies preserve text, valid image paths and the related page', () => {
    const result = mapWidgetReply({ success: true, answer: 'Answer', images: ['/image.png', null, 42],
        redirect_url: 'https://example.test', answer_status: 'answered' }, 'Default');
    assert.deepEqual(result, { text: 'Answer', images: ['/image.png'], redirect_url: 'https://example.test', showFeedback: true });
});
test('fallback replies do not show stale FAQ images or redirect links', () => {
    const result = mapWidgetReply({ success: true, answer: 'Please clarify', is_fallback: true,
        images: ['/stale.png'], redirect_url: 'https://example.test', response_kind: 'clarification' }, 'Default');
    assert.equal(result.text, 'Please clarify'); assert.equal(result.images, undefined);
    assert.equal(result.redirect_url, null); assert.equal(result.showFeedback, false);
});
test('technical error guidance does not display feedback controls', () => {
    const result = mapWidgetReply({ success: true, answer: 'Try again later', answer_status: 'provider_error' }, 'Default');
    assert.equal(result.showFeedback, false);
});
test('failed, missing or blank answers display the default message', () => {
    for (const reply of [{}, { success: false, answer: 'Hidden' }, { success: true }, { success: true, answer: '  ' }]) {
        assert.deepEqual(mapWidgetReply(reply, 'Default'), { text: 'Default' });
    }
});
test('logout clears both current and legacy credentials but keeps unrelated storage', () => {
    const store = new Map(['admin_token', 'token', 'username', 'full_name', 'user_role', 'selected_site'].map(key => [key, 'value']));
    clearAdminAuth({ removeItem: key => store.delete(key) });
    assert.deepEqual([...store.keys()], ['selected_site']);
});
