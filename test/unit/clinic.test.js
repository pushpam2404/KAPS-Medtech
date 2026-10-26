const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    generateSlots, isValidSlot, parseDurationToDays, isMedicineActive, matchSymptoms, addDays,
} = require('../../backend/lib/clinic');

test('slots run every 30 minutes from 09:00 to 16:30', () => {
    const slots = generateSlots();
    assert.equal(slots.length, 16);
    assert.equal(slots[0], '09:00');
    assert.equal(slots[1], '09:30');
    assert.equal(slots.at(-1), '16:30');
});

test('only generated slots are valid', () => {
    assert.ok(isValidSlot('13:30'));
    for (const t of ['08:30', '17:00', '10:15', '9:00', '', undefined, null, 1000]) {
        assert.equal(isValidSlot(t), false, String(t));
    }
});

test('durations become days', () => {
    assert.equal(parseDurationToDays('5 days'), 5);
    assert.equal(parseDurationToDays('1 day'), 1);
    assert.equal(parseDurationToDays('2 weeks'), 14);
    assert.equal(parseDurationToDays('2weeks'), 14);
    assert.equal(parseDurationToDays('1 Month'), 30);
    assert.equal(parseDurationToDays('7'), 7);
    assert.equal(parseDurationToDays('ongoing'), 0);
    assert.equal(parseDurationToDays(''), 0);
    assert.equal(parseDurationToDays(undefined), 0);
});

test('addDays crosses month and year ends', () => {
    assert.equal(addDays('2026-01-30', 5), '2026-02-04');
    assert.equal(addDays('2026-12-30', 3), '2027-01-02');
    assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});

test('a medicine is active for exactly its duration', () => {
    // 5 days from the 10th: active on 10..14, finished on the 15th.
    assert.equal(isMedicineActive('2026-03-10', '5 days', '2026-03-10'), true);
    assert.equal(isMedicineActive('2026-03-10', '5 days', '2026-03-14'), true);
    assert.equal(isMedicineActive('2026-03-10', '5 days', '2026-03-15'), false);
    assert.equal(isMedicineActive('2026-03-10', '2 weeks', '2026-03-23'), true);
    assert.equal(isMedicineActive('2026-03-10', 'ongoing', '2030-01-01'), true);
});

const SYMPTOMS = [
    { name: 'Fever', department: 'General Medicine' },
    { name: 'Chest Pain', department: 'Cardiology' },
    { name: 'Knee pain', department: 'Orthopedics' },
    { name: 'Back Pain', department: 'Orthopedics' },
    { name: 'Headache / Migraine', department: 'Neurology' },
    { name: 'Stomach upset / Food poisoning', department: 'Gastroenterology' },
];

test('symptom matching: exact names win', () => {
    assert.equal(matchSymptoms('knee pain', SYMPTOMS)[0].department, 'Orthopedics');
    assert.equal(matchSymptoms('Fever', SYMPTOMS)[0].name, 'Fever');
});

test('symptom matching: picks up words inside a sentence', () => {
    assert.equal(matchSymptoms('I have had a bad headache since morning', SYMPTOMS)[0].department, 'Neurology');
    assert.equal(matchSymptoms('my stomach hurts after dinner', SYMPTOMS)[0].department, 'Gastroenterology');
});

test('symptom matching: a bare "pain" is too vague to suggest anything', () => {
    assert.deepEqual(matchSymptoms('pain', SYMPTOMS), []);
});

test('symptom matching: nothing for short or unrelated input', () => {
    assert.deepEqual(matchSymptoms('ab', SYMPTOMS), []);
    assert.deepEqual(matchSymptoms('quantum entanglement', SYMPTOMS), []);
});
