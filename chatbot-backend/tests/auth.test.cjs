const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { stub, response } = require('./helpers.cjs');

const secret = 'test-only-secret-not-used-by-the-application';
let rows, queries;
stub('../src/config/env', { ENV: { JWT_SECRET: secret, JWT_EXPIRES_IN: '1h' } });
stub('../src/config/db', { __esModule: true, default: { query: async (sql, params) => {
    queries.push({ sql, params });
    return { rows };
} } });
const { adminLogin } = require('../src/modules/auth/auth.controller');
const { verifyToken, requireAdmin, checkSitePermission } = require('../src/middlewares/auth.middleware');
const hash = bcrypt.hashSync('correct-password', 4);
beforeEach(() => {
    queries = [];
    rows = [{ id: 7, username: 'tester', password_hash: hash, password_version: 2,
        full_name: 'Test User', role: 'staff', is_active: true }];
});
const token = (payload = {}, options = {}) => jwt.sign({ id: 7, username: 'tester', role: 'admin', password_version: 2, ...payload }, secret, options);
async function authenticate(value) {
    const req = { headers: value == null ? {} : { authorization: `Bearer ${value}` } };
    const res = response(); let next = 0;
    await verifyToken(req, res, () => next++);
    return { req, res, next };
}

test('login validates password and issues a verifiable token without leaking its hash', async () => {
    const res = response();
    await adminLogin({ body: { username: ' TESTER ', password: 'correct-password' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.role, 'staff');
    assert.equal(jwt.verify(res.body.token, secret).password_version, 2);
    assert.equal(queries[0].params[0], 'tester');
    assert.equal(res.body.password_hash, undefined);
    assert.ok(!JSON.stringify(res.body).includes(hash));
});
test('login rejects missing credentials before querying the database', async () => {
    const res = response();
    await adminLogin({ body: { username: 'tester' } }, res);
    assert.equal(res.statusCode, 400); assert.equal(queries.length, 0);
});
test('unknown users and wrong passwords do not reveal which credential failed', async () => {
    const wrong = response();
    await adminLogin({ body: { username: 'tester', password: 'wrong' } }, wrong);
    rows = [];
    const missing = response();
    await adminLogin({ body: { username: 'unknown', password: 'wrong' } }, missing);
    assert.equal(wrong.statusCode, 401); assert.equal(missing.statusCode, 401);
    assert.equal(wrong.body.message, missing.body.message);
});
test('disabled accounts cannot log in', async () => {
    rows[0].is_active = false;
    const res = response();
    await adminLogin({ body: { username: 'tester', password: 'correct-password' } }, res);
    assert.equal(res.statusCode, 401); assert.equal(res.body.token, undefined);
});
test('missing, malformed, forged and expired JWTs are rejected', async () => {
    for (const value of [undefined, 'null', 'bad.token', jwt.sign({ id: 7, username: 'tester' }, 'wrong-secret'), token({}, { expiresIn: -1 })]) {
        const result = await authenticate(value);
        assert.equal(result.res.statusCode, 401); assert.equal(result.next, 0);
    }
    assert.equal(queries.length, 0);
});
test('current database role takes precedence over an old admin claim', async () => {
    const { req, next } = await authenticate(token());
    assert.equal(next, 1); assert.equal(req.user.role, 'staff');
    const res = response();
    requireAdmin(req, res, () => assert.fail('Staff must not pass admin check'));
    assert.equal(res.statusCode, 403);
});
test('deleted accounts, disabled accounts and old password versions invalidate JWTs', async () => {
    for (const record of [[], [{ ...rows[0], is_active: false }], [{ ...rows[0], password_version: 3 }]]) {
        rows = record;
        const result = await authenticate(token());
        assert.equal(result.res.statusCode, 401); assert.equal(result.next, 0);
    }
});
test('staff cannot access a site without a grant; an existing grant allows access', async () => {
    const req = { user: { id: 7, role: 'staff' }, params: {}, body: { site_id: 'other-site' }, query: {} };
    rows = []; const denied = response(); let next = 0;
    await checkSitePermission(req, denied, () => next++);
    assert.equal(denied.statusCode, 403); assert.equal(next, 0);
    assert.deepEqual(queries[0].params, [7, 'other-site']);
    rows = [{ allowed: 1 }];
    await checkSitePermission(req, response(), () => next++);
    assert.equal(next, 1);
});
test('staff list requests receive only granted sites without modifying query parameters', async () => {
    rows = [{ site_id: 'site-a' }];
    const query = Object.freeze({});
    const req = { user: { id: 7, role: 'staff' }, params: {}, query };
    let next = 0;
    await checkSitePermission(req, response(), () => next++);
    assert.equal(next, 1); assert.deepEqual(req.allowedSiteIds, ['site-a']); assert.equal(req.query, query);
});
