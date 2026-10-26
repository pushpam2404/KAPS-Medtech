const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveSsl } = require('../../backend/lib/ssl');

const NEON = 'postgresql://u:p@ep-x-123.us-east-2.aws.neon.tech/db?sslmode=require';

test('a local database gets no SSL', () => {
    assert.equal(resolveSsl('postgresql://u:p@localhost:5432/db', {}).ssl, false);
});

test('a Neon URL verifies certificates and loses sslmode', () => {
    const r = resolveSsl(NEON, {});
    assert.deepEqual(r.ssl, { rejectUnauthorized: true });
    assert.equal(r.connectionString, 'postgresql://u:p@ep-x-123.us-east-2.aws.neon.tech/db');
});

test('other URL parameters survive', () => {
    const r = resolveSsl('postgresql://u:p@h.neon.tech/db?sslmode=require&application_name=kaps&connect_timeout=5', {});
    assert.equal(r.connectionString, 'postgresql://u:p@h.neon.tech/db?application_name=kaps&connect_timeout=5');
    const r2 = resolveSsl('postgresql://u:p@h.neon.tech/db?application_name=kaps&sslmode=require', {});
    assert.equal(r2.connectionString, 'postgresql://u:p@h.neon.tech/db?application_name=kaps');
});

test('DATABASE_SSL=relaxed turns verification off and off turns SSL off', () => {
    assert.deepEqual(resolveSsl(NEON, { DATABASE_SSL: 'relaxed' }).ssl, { rejectUnauthorized: false });
    assert.equal(resolveSsl(NEON, { DATABASE_SSL: 'off' }).ssl, false);
});

test('sslmode in the URL is honoured when DATABASE_SSL is not set', () => {
    assert.equal(resolveSsl('postgresql://u:p@db.example.com/x?sslmode=disable', {}).ssl, false);
    assert.deepEqual(resolveSsl('postgresql://u:p@db.example.com/x?sslmode=no-verify', {}).ssl, { rejectUnauthorized: false });
    assert.deepEqual(resolveSsl('postgresql://u:p@db.example.com/x?sslmode=require', {}).ssl, { rejectUnauthorized: true });
});

test('production and DB_SSL=true switch SSL on; a custom CA is passed along', () => {
    assert.deepEqual(resolveSsl('postgresql://u:p@db.example.com/x', { NODE_ENV: 'production' }).ssl, { rejectUnauthorized: true });
    assert.deepEqual(resolveSsl('postgresql://u:p@db.example.com/x', { DB_SSL: 'true' }).ssl, { rejectUnauthorized: true });
    assert.deepEqual(resolveSsl(NEON, { DATABASE_CA: 'PEM' }).ssl, { rejectUnauthorized: true, ca: 'PEM' });
});
