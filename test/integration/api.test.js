// End-to-end checks against a real PostgreSQL database.
//   DATABASE_URL=... npm run db:init && DATABASE_URL=... npm run test:integration
// The app is started in-process on a random port, so no server needs to be running.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';
process.env.DOCTOR_SIGNUP_CODE = 'test-invite';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required for the integration tests');
    process.exit(1);
}

const app = require('../../backend/server');
const db = require('../../backend/db');
const { addDays } = require('../../backend/lib/clinic');

let server;
let base;

before(async () => {
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
    server.close();
    await db.pool.end();
});

async function api(method, path, { token, body, raw } = {}) {
    const res = await fetch(base + path, {
        method,
        headers: {
            ...(body !== undefined || raw ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    return { status: res.status, data };
}

const stamp = Date.now();
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
// A random Wednesday more than a month out: doctors work Wednesdays by default,
// the demo seed keeps its bookings within a few days of today, and the random
// pick lets the suite be re-run against the same database.
function randomWednesday() {
    for (let n = 30 + Math.floor(Math.random() * 300); ; n++) {
        const d = day(n);
        if (new Date(`${d}T00:00:00Z`).getUTCDay() === 3) return d;
    }
}
const futureDate = randomWednesday();

async function signupAndLogin(label, extra = {}) {
    const email = `${label}_${stamp}@example.edu`;
    const body = { name: `Test ${label}`, email, password: 'a-decent-password', role: 'student', ...extra };
    const s = await api('POST', '/auth/signup', { body });
    assert.equal(s.status, 201, JSON.stringify(s.data));
    const l = await api('POST', '/auth/login', { body: { email, password: body.password } });
    assert.equal(l.status, 200);
    return { email, token: l.data.token, id: l.data.id };
}

async function doctorLogin(email) {
    const l = await api('POST', '/auth/login', { body: { email, password: 'password123' } });
    assert.equal(l.status, 200, `seeded doctor ${email} should log in`);
    return l.data.token;
}

const state = {};

test('health check reports the database', async () => {
    const r = await api('GET', '/health');
    assert.equal(r.status, 200);
    assert.equal(r.data.db, 'Connected');
});

test('signup validation', async () => {
    const bad = (patch) => api('POST', '/auth/signup', {
        body: { name: 'X', email: 'x@example.edu', password: 'long-enough-1', role: 'student', ...patch },
    });
    assert.equal((await bad({ email: 'nope' })).status, 400);
    assert.equal((await bad({ password: 'short' })).status, 400);
    assert.equal((await bad({ password: 'x'.repeat(80) })).status, 400);
    assert.equal((await bad({ role: 'admin' })).status, 400);
    assert.equal((await bad({ name: { $ne: 1 } })).status, 400);
    assert.equal((await api('POST', '/auth/signup', { raw: '{not json' })).status, 400);
});

test('duplicate email is rejected whatever the casing', async () => {
    state.student = await signupAndLogin('student');
    const again = await api('POST', '/auth/signup', {
        body: { name: 'Again', email: state.student.email.toUpperCase(), password: 'a-decent-password', role: 'student' },
    });
    assert.equal(again.status, 409);
});

test('login failures are 401 and the same for unknown email and wrong password', async () => {
    const wrong = await api('POST', '/auth/login', { body: { email: state.student.email, password: 'wrong-password' } });
    const unknown = await api('POST', '/auth/login', { body: { email: 'nobody@example.edu', password: 'whatever-123' } });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.data.error, unknown.data.error);
});

test('doctor self-registration needs the invite code', async () => {
    const doc = (extra) => api('POST', '/auth/signup', {
        body: {
            name: 'Dr Test', email: `drtest_${stamp}_${Math.random()}@example.edu`, password: 'a-decent-password',
            role: 'doctor', department: 'Neurology', ...extra,
        },
    });
    assert.equal((await doc({})).status, 403);
    assert.equal((await doc({ doctor_code: 'wrong' })).status, 403);
    assert.equal((await doc({ doctor_code: 'test-invite', department: 'Astrology' })).status, 400);
    assert.equal((await doc({ doctor_code: 'test-invite' })).status, 201);
});

test('protected routes require a valid token', async () => {
    assert.equal((await api('GET', '/appointments/doctors')).status, 401);
    assert.equal((await api('GET', '/appointments/doctors', { token: 'garbage' })).status, 401);
    assert.equal((await api('GET', '/doctor/queue', { token: state.student.token })).status, 403);
});

test('symptom lookup ranks a free-text description', async () => {
    const r = await api('GET', '/appointments/symptoms?q=' + encodeURIComponent('my knee hurts when I climb stairs'));
    assert.equal(r.status, 200);
    assert.equal(r.data[0].department, 'Orthopedics');
    assert.deepEqual((await api('GET', '/appointments/symptoms?q=zzzz')).data, []);
});

test('doctors and slots', async () => {
    const t = state.student.token;
    assert.equal((await api('GET', '/appointments/doctors?department=Nope', { token: t })).status, 400);
    const docs = await api('GET', '/appointments/doctors?department=Neurology', { token: t });
    assert.equal(docs.status, 200);
    assert.ok(docs.data.length >= 2, 'seed data has several neurologists');
    state.doctors = docs.data;
    state.doctor = docs.data.find((d) => d.name.includes('Mohit'));

    const slots = await api('GET', `/appointments/slots?doctor_id=${state.doctor.id}&date=${futureDate}`, { token: t });
    assert.equal(slots.status, 200);
    assert.equal(slots.data.length, 16);
    assert.equal(slots.data[0], '09:00');
    assert.equal((await api('GET', '/appointments/slots?doctor_id=abc&date=2030-02-30', { token: t })).status, 400);
    assert.equal((await api('GET', `/appointments/slots?doctor_id=999999&date=${futureDate}`, { token: t })).status, 404);
    const sunday = addDays(futureDate, 4);
    const closed = await api('GET', `/appointments/slots?doctor_id=${state.doctor.id}&date=${sunday}`, { token: t });
    assert.deepEqual(closed.data, [], 'no slots on a non-working day');
});

test('booking rules', async () => {
    const t = state.student.token;
    const book = (patch) => api('POST', '/appointments/book', {
        token: t,
        body: { doctor_id: state.doctor.id, date: futureDate, time: '10:00', symptom: 'Headaches', ...patch },
    });

    assert.equal((await book({ doctor_id: 'x' })).status, 400);
    assert.equal((await book({ doctor_id: 999999 })).status, 400);
    assert.equal((await book({ time: '10:17' })).status, 400);
    assert.equal((await book({ time: '18:00' })).status, 400, 'outside working hours');
    assert.equal((await book({ date: day(-5) })).status, 400);
    assert.equal((await book({ symptom: 'x'.repeat(300) })).status, 400);

    assert.equal((await book({})).status, 201);
    assert.equal((await book({})).status, 409, 'same slot twice');

    const slots = await api('GET', `/appointments/slots?doctor_id=${state.doctor.id}&date=${futureDate}`, { token: t });
    assert.ok(!slots.data.includes('10:00'));
});

test('simultaneous bookings of one slot let exactly one through', async () => {
    const t = state.student.token;
    const send = () => api('POST', '/appointments/book', {
        token: t, body: { doctor_id: state.doctor.id, date: futureDate, time: '15:30', symptom: 'race' },
    });
    const results = await Promise.all([send(), send(), send(), send()]);
    const codes = results.map((r) => r.status).sort();
    assert.deepEqual(codes, [201, 409, 409, 409]);
});

test('patient lists, reschedules and is stopped from touching others', async () => {
    const t = state.student.token;
    const mine = await api('GET', '/appointments/my-appointments', { token: t });
    assert.equal(mine.status, 200);
    const apt = mine.data.find((a) => a.appointment_time === '10:00');
    assert.ok(apt);
    state.apt = apt;

    const byReason = await api('GET', '/appointments/my-appointments?filter=reason&q=head', { token: t });
    assert.ok(byReason.data.some((a) => a.id === apt.id));
    assert.equal((await api('GET', '/appointments/my-appointments?filter=date&start=bad&end=bad', { token: t })).status, 400);

    assert.equal((await api('PUT', `/appointments/${apt.id}/reschedule`, { token: t, body: { date: futureDate, time: '15:30' } })).status, 409);
    assert.equal((await api('PUT', `/appointments/${apt.id}/reschedule`, { token: t, body: { date: futureDate, time: '11:00' } })).status, 200);
    assert.equal((await api('PUT', `/appointments/${apt.id}/reschedule`, { token: t, body: { date: 'tomorrow', time: '11:00' } })).status, 400);

    const other = await signupAndLogin('other');
    state.other = other;
    assert.equal((await api('PUT', `/appointments/${apt.id}/reschedule`, { token: other.token, body: { date: futureDate, time: '12:00' } })).status, 403);
    assert.equal((await api('GET', `/appointments/${apt.id}/record`, { token: other.token })).status, 403);
    assert.equal((await api('GET', '/appointments/abc/record', { token: other.token })).status, 404);
});

test('doctor sees only their own patients and appointments', async () => {
    state.docToken = await doctorLogin('neuro1@health.edu');
    const outsider = state.doctors.find((d) => d.id !== state.doctor.id && !d.name.startsWith('Dr Test'));
    const outsiderRow = await db.query('SELECT u.email FROM Doctors d JOIN Users u ON u.id = d.user_id WHERE d.id = $1', [outsider.id]);
    state.otherDocToken = await doctorLogin(outsiderRow.rows[0].email);

    const queue = await api('GET', '/doctor/queue', { token: state.docToken });
    assert.equal(queue.status, 200);
    assert.ok(queue.data.some((a) => a.id === state.apt.id));
    assert.ok(queue.data.every((a) => a.status === 'Booked'));

    const otherQueue = await api('GET', '/doctor/queue', { token: state.otherDocToken });
    assert.ok(!otherQueue.data.some((a) => a.id === state.apt.id));

    const patientId = queue.data.find((a) => a.id === state.apt.id).patient_id;
    state.patientId = patientId;
    assert.equal((await api('GET', `/doctor/patient/${patientId}`, { token: state.docToken })).status, 200);
    assert.equal((await api('GET', `/doctor/patient/${patientId}`, { token: state.otherDocToken })).status, 404);
    assert.equal((await api('GET', `/doctor/patient/${state.other.id}`, { token: state.docToken })).status, 404);
});

test('treatment record: scoping, validation and the happy path', async () => {
    const record = (token, patch = {}) => api('POST', '/doctor/record', {
        token,
        body: {
            appointment_id: state.apt.id,
            diagnosis: 'Tension headache',
            advice: 'Rest, fluids',
            follow_up_date: day(10),
            prescriptions: [{ name: 'Ibuprofen', dosage: '400mg', freq: 'Twice daily', duration: '5 days' }, { name: '' }],
            patient_updates: { phone: '555-0100', identifier: 'STU-1' },
            ...patch,
        },
    });

    assert.equal((await record(state.otherDocToken)).status, 404, 'another doctor cannot complete it');
    assert.equal((await record(state.docToken, { diagnosis: '' })).status, 400);
    assert.equal((await record(state.docToken, { attached_reports: 'javascript:alert(1)' })).status, 400);
    assert.equal((await record(state.docToken, { attached_reports: 'data:image/svg+xml;base64,PHN2Zz4=' })).status, 400);
    assert.equal((await record(state.docToken, { follow_up_date: 'soon' })).status, 400);

    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    assert.equal((await record(state.docToken, { attached_reports: tinyPng })).status, 200);
    assert.equal((await record(state.docToken)).status, 404, 'a completed visit cannot be completed twice');
});

test('patient sees the record, active medicine and the reminder', async () => {
    const t = state.student.token;
    const records = await api('GET', '/appointments/medical-records', { token: t });
    assert.equal(records.data.length, 1);
    assert.equal(records.data[0].diagnosis, 'Tension headache');
    assert.equal(records.data[0].prescriptions[0].medicine, 'Ibuprofen');
    assert.equal(records.data[0].follow_up_date, day(10), 'dates are plain YYYY-MM-DD');

    const full = await api('GET', `/appointments/${state.apt.id}/record`, { token: t });
    assert.equal(full.status, 200);
    assert.equal((await api('GET', `/appointments/${state.apt.id}/record`, { token: state.docToken })).status, 200);

    const meds = await api('GET', '/appointments/my-medicine', { token: t });
    assert.ok(meds.data.some((m) => m.medicine_name === 'Ibuprofen'));
    const reminders = await api('GET', '/appointments/reminders', { token: t });
    assert.equal(reminders.data.length, 1);

    const phone = await db.query('SELECT phone, identifier FROM Users WHERE id = $1', [state.patientId]);
    assert.deepEqual(phone.rows[0], { phone: '555-0100', identifier: 'STU-1' });
});

test('doctor can cancel only their own booked appointment', async () => {
    const t = state.student.token;
    const slot = '12:00';
    await api('POST', '/appointments/book', { token: t, body: { doctor_id: state.doctor.id, date: futureDate, time: slot, symptom: 'to cancel' } });
    const apt = (await api('GET', '/appointments/my-appointments', { token: t })).data.find((a) => a.appointment_time === slot);

    assert.equal((await api('POST', '/doctor/cancel', { token: state.otherDocToken, body: { appointment_id: apt.id } })).status, 404);
    assert.equal((await api('POST', '/doctor/cancel', { token: state.docToken, body: { appointment_id: 'x' } })).status, 400);
    assert.equal((await api('POST', '/doctor/cancel', { token: state.docToken, body: { appointment_id: apt.id } })).status, 200);

    const queue = await api('GET', '/doctor/queue', { token: state.docToken });
    assert.ok(!queue.data.some((a) => a.id === apt.id), 'cancelled visits leave the queue');

    const freed = await api('POST', '/appointments/book', { token: t, body: { doctor_id: state.doctor.id, date: futureDate, time: slot, symptom: 'again' } });
    assert.equal(freed.status, 201, 'a cancelled slot can be booked again');
});

test('patients can cancel their own booked appointment, once', async () => {
    const t = state.student.token;
    const book = (time) => api('POST', '/appointments/book', { token: t, body: { doctor_id: state.doctor.id, date: futureDate, time, symptom: 'cancel me' } });
    assert.equal((await book('13:00')).status, 201);
    const apt = (await api('GET', '/appointments/my-appointments', { token: t })).data.find((a) => a.appointment_time === '13:00');
    assert.equal(apt.doctor_id, state.doctor.id);

    assert.equal((await api('POST', `/appointments/${apt.id}/cancel`, { token: state.other.token })).status, 403);
    assert.equal((await api('POST', '/appointments/abc/cancel', { token: t })).status, 404);
    assert.equal((await api('POST', `/appointments/${apt.id}/cancel`, { token: t })).status, 200);
    assert.equal((await api('POST', `/appointments/${apt.id}/cancel`, { token: t })).status, 400, 'already cancelled');
    assert.equal((await api('PUT', `/appointments/${apt.id}/reschedule`, { token: t, body: { date: futureDate, time: '13:30' } })).status, 400);

    const slots = await api('GET', `/appointments/slots?doctor_id=${state.doctor.id}&date=${futureDate}`, { token: t });
    assert.ok(slots.data.includes('13:00'), 'the freed slot can be booked again');
});

test('reschedule respects the doctor\'s hours', async () => {
    const t = state.student.token;
    assert.equal((await api('POST', '/appointments/book', { token: t, body: { doctor_id: state.doctor.id, date: futureDate, time: '14:00', symptom: 'move me' } })).status, 201);
    const apt = (await api('GET', '/appointments/my-appointments', { token: t })).data.find((a) => a.appointment_time === '14:00');
    assert.equal((await api('PUT', `/appointments/${apt.id}/reschedule`, { token: t, body: { date: futureDate, time: '20:00' } })).status, 400);
    assert.equal((await api('PUT', `/appointments/${apt.id}/reschedule`, { token: t, body: { date: futureDate, time: '14:30' } })).status, 200);
});

test('a doctor sets hours, working days and days off; the slot picker follows', async () => {
    const email = `avail_${stamp}@example.edu`;
    const made = await api('POST', '/auth/signup', {
        body: { name: `Avail Doc ${stamp}`, email, password: 'a-decent-password', role: 'doctor', department: 'Dermatology', doctor_code: 'test-invite' },
    });
    assert.equal(made.status, 201);
    const token = (await api('POST', '/auth/login', { body: { email, password: 'a-decent-password' } })).data.token;
    const patient = state.student.token;
    const docId = (await api('GET', '/appointments/doctors?department=Dermatology', { token: patient })).data.find((d) => d.name === `Avail Doc ${stamp}`).id;
    const slots = async (date) => (await api('GET', `/appointments/slots?doctor_id=${docId}&date=${date}`, { token: patient })).data;
    const book = (date, time) => api('POST', '/appointments/book', { token: patient, body: { doctor_id: docId, date, time, symptom: 'rash' } });

    const initial = await api('GET', '/doctor/availability', { token });
    assert.deepEqual(initial.data.working_days, [1, 2, 3, 4, 5]);
    assert.equal(initial.data.start_time, '09:00');

    assert.equal((await api('PUT', '/doctor/availability', { token, body: { start_time: '10:15', end_time: '12:00', working_days: [3] } })).status, 400);
    assert.equal((await api('PUT', '/doctor/availability', { token, body: { start_time: '12:00', end_time: '10:00', working_days: [3] } })).status, 400);
    assert.equal((await api('PUT', '/doctor/availability', { token, body: { start_time: '10:00', end_time: '12:00', working_days: [] } })).status, 400);
    assert.equal((await api('PUT', '/doctor/availability', { token, body: { start_time: '10:00', end_time: '12:00', working_days: [0, 9] } })).status, 400);
    assert.equal((await api('PUT', '/doctor/availability', { token: patient, body: { start_time: '10:00', end_time: '12:00', working_days: [3] } })).status, 403);

    const saved = await api('PUT', '/doctor/availability', { token, body: { start_time: '10:00', end_time: '12:00', working_days: [3] } });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.data.working_days, [3]);

    assert.deepEqual(await slots(futureDate), ['10:00', '10:30', '11:00', '11:30']);
    const thursday = addDays(futureDate, 1);
    assert.deepEqual(await slots(thursday), [], 'Wednesday only');
    assert.equal((await book(futureDate, '09:30')).status, 400);
    assert.equal((await book(futureDate, '12:00')).status, 400, 'a slot that would end after closing');
    assert.equal((await book(thursday, '10:00')).status, 400);
    assert.equal((await book(futureDate, '11:30')).status, 201);

    // A day off removes the date from the picker and from booking, and warns about existing bookings.
    assert.equal((await api('POST', '/doctor/days-off', { token, body: { start_date: futureDate, end_date: day(-1) } })).status, 400);
    assert.equal((await api('POST', '/doctor/days-off', { token, body: { start_date: day(-30), end_date: day(-29) } })).status, 400, 'not in the past');
    const off = await api('POST', '/doctor/days-off', { token, body: { start_date: futureDate, end_date: futureDate, reason: 'Conference' } });
    assert.equal(off.status, 201);
    assert.equal(off.data.booked_in_range, 1);
    assert.deepEqual(await slots(futureDate), []);
    const blocked = await book(futureDate, '10:00');
    assert.equal(blocked.status, 400);
    assert.match(blocked.data.error, /away/);

    assert.equal((await api('DELETE', `/doctor/days-off/${off.data.id}`, { token: state.otherDocToken })).status, 404, "not another doctor's block");
    assert.equal((await api('DELETE', `/doctor/days-off/${off.data.id}`, { token })).status, 200);
    assert.deepEqual(await slots(futureDate), ['10:00', '10:30', '11:00']); // 11:30 is still booked

    const listed = await api('GET', '/doctor/availability', { token });
    assert.equal(listed.data.days_off.length, 0);
});

test('the sign-in page can fetch demo accounts, and a switch turns them off', async () => {
    const on = await api('GET', '/demo-accounts');
    assert.equal(on.status, 200);
    assert.ok(on.data.accounts.some((a) => a.role === 'student'));
    assert.ok(on.data.accounts.some((a) => a.role === 'staff'));
    assert.ok(on.data.accounts.filter((a) => a.role === 'doctor').length >= 2);
    process.env.DEMO_MODE = 'off';
    try {
        assert.deepEqual((await api('GET', '/demo-accounts')).data.accounts, []);
    } finally {
        delete process.env.DEMO_MODE;
    }
});
