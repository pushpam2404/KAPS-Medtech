// Pure helpers for scheduling, prescriptions and symptom matching.
// Nothing here touches the database, so it can be unit-tested directly.

const DEPARTMENTS = [
    'General Medicine', 'Cardiology', 'Pulmonology', 'Gastroenterology',
    'Neurology', 'Orthopedics', 'Dermatology', 'Psychiatry', 'ENT',
    'Ophthalmology', 'Endocrinology', 'Nephrology', 'Dentistry',
];

const DAY_START_HOUR = 9;
const DAY_END_HOUR = 17;

/** Half-hour slots from 09:00 up to the last one starting before 17:00. */
function generateSlots() {
    const slots = [];
    for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
        const hh = String(h).padStart(2, '0');
        slots.push(`${hh}:00`, `${hh}:30`);
    }
    return slots;
}

function isValidSlot(time) {
    return generateSlots().includes(time);
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
    isValidSlot,
    parseDurationToDays,
    isMedicineActive,
    matchSymptoms,
    addDays,
};
