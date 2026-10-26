// The demo seed must be safe to run twice and must refuse to run in production.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const bcrypt = require('bcrypt');

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required for the integration tests');
    process.exit(1);
}
const db = require('../../backend/db');
const { seedDemo } = require('../../backend/seed_demo');
const { DEMO_ACCOUNTS, DEMO_PASSWORD, EXTRA_PATIENTS } = require('../../backend/lib/demo');

after(() => db.pool.end());

const DEMO_PATIENTS = [
    ...DEMO_ACCOUNTS.filter((a) => a.role !== 'doctor').map((a) => a.email),
    ...EXTRA_PATIENTS.map((p) => p[1]),
];

// Row counts for everything the seed owns.
const snapshot = async () => {
    const one = async (sql, params = []) => (await db.query(sql, params)).rows[0].n;
    const join = `FROM Appointments a JOIN Users u ON u.id = a.patient_id WHERE u.email = ANY($1)`;
    return {
        users: await one('SELECT count(*)::int n FROM Users WHERE email = ANY($1)', [DEMO_PATIENTS]),
        appointments: await one(`SELECT count(*)::int n ${join}`, [DEMO_PATIENTS]),
        cancelled: await one(`SELECT count(*)::int n ${join} AND a.status = 'Cancelled'`, [DEMO_PATIENTS]),
        records: await one(`SELECT count(*)::int n FROM MedicalRecords m JOIN Appointments a ON a.id = m.appointment_id JOIN Users u ON u.id = a.patient_id WHERE u.email = ANY($1)`, [DEMO_PATIENTS]),
        prescriptions: await one(`SELECT count(*)::int n FROM Prescriptions p JOIN MedicalRecords m ON m.id = p.record_id JOIN Appointments a ON a.id = m.appointment_id JOIN Users u ON u.id = a.patient_id WHERE u.email = ANY($1)`, [DEMO_PATIENTS]),
        daysOff: await one(`SELECT count(*)::int n FROM DoctorDaysOff o JOIN Doctors d ON d.id = o.doctor_id JOIN Users u ON u.id = d.user_id WHERE u.email = 'cardio1@health.edu'`),
    };
};

test('seeding twice gives the same data', async () => {
    const first = await seedDemo(db.pool);
    const a = await snapshot();
    const second = await seedDemo(db.pool);
    const b = await snapshot();
    assert.deepEqual(first, second);
    assert.deepEqual(a, b);
    assert.equal(b.users, DEMO_PATIENTS.length);
    assert.equal(b.daysOff, 1);
    assert.ok(first.records >= 5 && first.appointments >= 20);
    assert.ok(b.cancelled >= 1, 'has a cancelled appointment');
});

test('the demo has finished visits with reports, active medicines and a busy queue today', async () => {
    const reports = await db.query(`SELECT count(*)::int n FROM MedicalRecords WHERE attached_reports LIKE 'data:%'`);
    assert.ok(reports.rows[0].n >= 3);
    const queue = await db.query(
        `SELECT count(*)::int n FROM Appointments a JOIN Doctors d ON d.id = a.doctor_id JOIN Users u ON u.id = d.user_id
         WHERE u.email = 'neuro1@health.edu' AND a.appointment_date = CURRENT_DATE AND a.status = 'Booked'`
    );
    assert.ok(queue.rows[0].n >= 6);
});

test('every demo account can log in with the demo password', async () => {
    for (const a of DEMO_ACCOUNTS) {
        const { rows } = await db.query('SELECT password_hash, role FROM Users WHERE email = $1', [a.email]);
        assert.equal(rows.length, 1, a.email);
        assert.equal(rows[0].role, a.role);
        assert.ok(await bcrypt.compare(DEMO_PASSWORD, rows[0].password_hash), a.email);
    }
    assert.ok(DEMO_PASSWORD.length >= 8);
});

test('the seed script refuses to run in production without ALLOW_DEMO_SEED', () => {
    const run = (env) => spawnSync(process.execPath, [path.join(__dirname, '../../backend/seed_demo.js')], {
        env: { ...process.env, ...env }, encoding: 'utf8', timeout: 20_000,
    });
    const blocked = run({ NODE_ENV: 'production', ALLOW_DEMO_SEED: '' });
    assert.equal(blocked.status, 1);
    assert.match(blocked.stderr, /Refusing/);
    const blockedReset = spawnSync(process.execPath, [path.join(__dirname, '../../backend/seed_demo.js'), '--reset'], {
        env: { ...process.env, NODE_ENV: 'production', ALLOW_DEMO_SEED: '' }, encoding: 'utf8', timeout: 20_000,
    });
    assert.equal(blockedReset.status, 1);
});
