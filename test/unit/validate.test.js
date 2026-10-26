const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    isEmail, requiredText, optionalText, toId, toDate, isValidAttachment, likePattern,
} = require('../../backend/lib/validate');

test('emails', () => {
    assert.ok(isEmail('a@b.co'));
    assert.ok(isEmail('  a@b.co '));
    for (const v of ['a@b', 'a b@c.d', '', null, 5, {}, `${'x'.repeat(100)}@b.co`]) assert.equal(isEmail(v), false);
});

test('required and optional text', () => {
    assert.equal(requiredText('  hi ', 5), 'hi');
    assert.equal(requiredText('   ', 5), null);
    assert.equal(requiredText('toolong', 5), null);
    assert.equal(requiredText({ a: 1 }, 5), null);
    assert.equal(optionalText(undefined, 5), '');
    assert.equal(optionalText('', 5), '');
    assert.equal(optionalText('toolong', 5), null);
    assert.equal(optionalText(12, 5), null);
});

test('ids', () => {
    assert.equal(toId(5), 5);
    assert.equal(toId('42'), 42);
    for (const v of [0, -1, 1.5, '1.5', '1e3', 'abc', '', null, undefined, '99999999999', [1], { a: 1 }]) {
        assert.equal(toId(v), null, String(v));
    }
});

test('dates must be real calendar days', () => {
    assert.equal(toDate('2026-02-28'), '2026-02-28');
    assert.equal(toDate('2028-02-29'), '2028-02-29');
    for (const v of ['2026-02-30', '2026-13-01', '2026-1-1', 'tomorrow', '', null, 20260101]) {
        assert.equal(toDate(v), null, String(v));
    }
});

test('attachments: images and PDF as base64 data URLs only', () => {
    assert.ok(isValidAttachment(undefined));
    assert.ok(isValidAttachment(null));
    assert.ok(isValidAttachment('data:image/png;base64,iVBORw0KGgo='));
    assert.ok(isValidAttachment('data:application/pdf;base64,JVBERi0xLjQ='));
    for (const v of [
        'data:image/svg+xml;base64,PHN2Zz4=',
        'data:text/html;base64,PGgxPg==',
        'javascript:alert(1)',
        'https://example.com/a.png',
        'data:image/png;base64,"><script>',
        'data:image/png,notbase64',
        5,
        `data:image/png;base64,${'A'.repeat(3_000_000)}`,
    ]) assert.equal(isValidAttachment(v), false, String(v).slice(0, 40));
});

test('LIKE wildcards are escaped', () => {
    assert.equal(likePattern('100%_x'), '%100\\%\\_x%');
    assert.equal(likePattern('a\\b'), '%a\\\\b%');
});
