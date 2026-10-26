// Input checks shared by the route handlers. Each returns a cleaned value or
// null/an error string, so handlers can answer 400 instead of letting
// Postgres throw a 500.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Matches the frontend limit (2 MB file -> about 2.7 MB of base64).
const MAX_ATTACHMENT_CHARS = 2_900_000;
const ATTACHMENT_REGEX = /^data:(image\/(png|jpeg|webp|gif)|application\/pdf);base64,[A-Za-z0-9+/]+={0,2}$/;

function isString(v) {
    return typeof v === 'string';
}

/** Trimmed string within [1, max] characters, else null. */
function requiredText(v, max) {
    if (!isString(v)) return null;
    const t = v.trim();
    return t.length >= 1 && t.length <= max ? t : null;
}

/** Trimmed string up to max characters; empty/undefined becomes ''. null if invalid. */
function optionalText(v, max) {
    if (v === undefined || v === null || v === '') return '';
    if (!isString(v)) return null;
    const t = v.trim();
    return t.length <= max ? t : null;
}

function isEmail(v) {
    return isString(v) && v.length <= 100 && EMAIL_REGEX.test(v.trim());
}

/** Positive integer id from a number or numeric string, else null. */
function toId(v) {
    if (typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && v < 2_147_483_648) return v;
    if (isString(v) && /^\d{1,10}$/.test(v)) {
        const n = parseInt(v, 10);
        return n > 0 && n < 2_147_483_648 ? n : null;
    }
    return null;
}

/** YYYY-MM-DD that is a real calendar date, else null. */
function toDate(v) {
    if (!isString(v) || !DATE_REGEX.test(v)) return null;
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}

/** true when the value is an acceptable attachment (or empty). */
function isValidAttachment(v) {
    if (v === undefined || v === null || v === '') return true;
    return isString(v) && v.length <= MAX_ATTACHMENT_CHARS && ATTACHMENT_REGEX.test(v);
}

/** Escape LIKE wildcards so user text is matched literally. */
function likePattern(text) {
    return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

module.exports = {
    isEmail,
    requiredText,
    optionalText,
    toId,
    toDate,
    isValidAttachment,
    likePattern,
    MAX_ATTACHMENT_CHARS,
};
