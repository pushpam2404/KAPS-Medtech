// Pure helpers for scheduling, prescriptions and symptom matching.
// Nothing here touches the database, so it can be unit-tested directly.

const DEPARTMENTS = [
    'General Medicine', 'Cardiology', 'Pulmonology', 'Gastroenterology',
    'Neurology', 'Orthopedics', 'Dermatology', 'Psychiatry', 'ENT',
    'Ophthalmology', 'Endocrinology', 'Nephrology', 'Dentistry',
];

const DEFAULT_START = '09:00';
const DEFAULT_END = '17:00';
const DEFAULT_DAYS = [1, 2, 3, 4, 5]; // ISO weekdays: 1 = Monday ... 7 = Sunday

const toMinutes = (t) => {
    const [h, m] = String(t).slice(0, 5).split(':').map(Number);
    return h * 60 + m;
};
const fromMinutes = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

/** Half-hour slots that start at or after `start` and finish by `end`. */
function generateSlots(start = DEFAULT_START, end = DEFAULT_END) {
    const slots = [];
    for (let m = toMinutes(start); m + 30 <= toMinutes(end); m += 30) slots.push(fromMinutes(m));
    return slots;
}

/** HH:MM on a half-hour boundary. */
function isHalfHour(t) {
    return typeof t === 'string' && /^([01]\d|2[0-3]):(00|30)$/.test(t);
}

function isoWeekday(isoDate) {
    const d = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
    return d === 0 ? 7 : d;
}

/**
 * Slots a doctor offers on one date: nothing on a non-working weekday or
 * inside a day-off block; otherwise the half-hours of their working hours.
 * daysOff rows look like { start_date, end_date } (YYYY-MM-DD, inclusive).
 */
function offeredSlots({ start, end, workingDays }, isoDate, daysOff = []) {
    if (!workingDays.includes(isoWeekday(isoDate))) return [];
    if (daysOff.some((o) => o.start_date <= isoDate && isoDate <= o.end_date)) return [];
    return generateSlots(start, end);
}

/** "5 days" -> 5, "2 weeks" -> 14, "1 month" -> 30, "ongoing" -> 0 (no end). */
function parseDurationToDays(text) {
    if (typeof text !== 'string') return 0;
    const m = text.trim().toLowerCase().match(/^(\d+)\s*(day|week|month)?/);
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    if (m[2] === 'week') return n * 7;
    if (m[2] === 'month') return n * 30;
    return n;
}

function addDays(isoDate, days) {
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/**
 * A prescription is active from the visit date for `duration`. Anything we
 * cannot read as a number of days (e.g. "ongoing") stays active.
 * Dates are YYYY-MM-DD strings, compared as UTC calendar days.
 */
function isMedicineActive(visitDate, duration, today) {
    const days = parseDurationToDays(duration);
    if (days === 0) return true;
    return today < addDays(visitDate, days);
}

// Words that appear in many symptom names and say nothing about the department.
const GENERIC_WORDS = new Set([
    'pain', 'issue', 'issues', 'problem', 'problems', 'disorder', 'symptoms',
    'symptom', 'severe', 'with', 'and', 'the', 'have', 'has', 'for', 'from',
    'feel', 'feeling', 'since', 'very', 'bad', 'little', 'some', 'too', 'not',
    'my', 'in', 'on', 'of', 'at', 'a', 'i', 'am', 'is', 'it', 'to', 'loss',
]);

function tokens(text) {
    return String(text)
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((w) => w.length >= 3 && !GENERIC_WORDS.has(w));
}

/**
 * Rank symptom rows ({ name, department }) against free text.
 * A whole-phrase hit beats shared words; rows with no overlap are dropped.
 * This is keyword matching, not a diagnosis.
 */
function matchSymptoms(text, symptoms) {
    const query = String(text).trim().toLowerCase();
    if (query.length < 3) return [];
    const queryTokens = new Set(tokens(query));
    if (queryTokens.size === 0) return []; // only filler words such as "pain"

    const scored = [];
    symptoms.forEach((row, index) => {
        const name = row.name.toLowerCase();
        let score = 0;
        if (name.includes(query) || query.includes(name)) score += 10;
        for (const t of tokens(name)) {
            if (queryTokens.has(t)) score += 1;
        }
        if (score > 0) scored.push({ row, score, index });
    });

    return scored
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map((s) => s.row);
}

module.exports = {
    DEPARTMENTS,
    generateSlots,
    isHalfHour,
    isoWeekday,
    offeredSlots,
    DEFAULT_DAYS,
    parseDurationToDays,
    isMedicineActive,
    matchSymptoms,
    addDays,
};
