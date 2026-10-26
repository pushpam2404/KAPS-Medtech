const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    generateSlots, isHalfHour, isoWeekday, offeredSlots, parseDurationToDays, isMedicineActive, matchSymptoms, addDays,
} = require('../../backend/lib/clinic');

test('slots run every 30 minutes from 09:00 to 16:30', () => {
    const slots = generateSlots();
    assert.equal(slots.length, 16);
    assert.equal(slots[0], '09:00');
    assert.equal(slots[1], '09:30');
    assert.equal(slots.at(-1), '16:30');
});

test('slots follow the hours given', () => {
    assert.deepEqual(generateSlots('10:00', '12:00'), ['10:00', '10:30', '11:00', '11:30']);
    assert.deepEqual(generateSlots('09:00', '09:45'), ['09:00']);
    assert.deepEqual(generateSlots('12:00', '12:00'), []);
});

test('half-hour times', () => {
    assert.ok(isHalfHour('13:30'));
    for (const t of ['10:15', '9:00', '24:00', '', undefined, null, 1000]) assert.equal(isHalfHour(t), false, String(t));
});

test('weekdays are ISO numbered', () => {
    assert.equal(isoWeekday('2026-10-26'), 1); // Monday
    assert.equal(isoWeekday('2026-10-31'), 6); // Saturday
    assert.equal(isoWeekday('2026-11-01'), 7); // Sunday
});

const WEEKDAYS = { start: '09:00', end: '11:00', workingDays: [1, 2, 3, 4, 5] };

test('a doctor offers slots only on working days', () => {
    assert.deepEqual(offeredSlots(WEEKDAYS, '2026-10-26'), ['09:00', '09:30', '10:00', '10:30']);
    assert.deepEqual(offeredSlots(WEEKDAYS, '2026-10-31'), []); // Saturday
});

test('days off remove whole days, ends included', () => {
    const off = [{ start_date: '2026-10-27', end_date: '2026-10-28' }];
    assert.equal(offeredSlots(WEEKDAYS, '2026-10-26', off).length, 4);
    assert.deepEqual(offeredSlots(WEEKDAYS, '2026-10-27', off), []);
    assert.deepEqual(offeredSlots(WEEKDAYS, '2026-10-28', off), []);
    assert.equal(offeredSlots(WEEKDAYS, '2026-10-29', off).length, 4);
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
