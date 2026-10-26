// Fills the database with a fictional clinic: demo patients, finished visits with
// records and prescriptions, upcoming and cancelled bookings, a busy queue for
// today, and sample report files.
//
//   npm run db:seed:demo    add or refresh the demo data (rerunnable)
//   npm run db:reset:demo   drop every table, reload the schema, then seed
//
// Both refuse to run when NODE_ENV=production unless ALLOW_DEMO_SEED=1.
// Seeding only touches the demo patients' appointments and the demo doctors'
// working hours and days off; other rows are left alone.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const db = require('./db');
const { DEMO_PASSWORD, DEMO_ACCOUNTS, EXTRA_PATIENTS } = require('./lib/demo');

const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');

// ---------- Sample report files, generated so the repo needs no binaries ----------

function crc32(buf) {
    let c, crc = 0xffffffff;
    for (const byte of buf) {
        c = (crc ^ byte) & 0xff;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 4 + body.length);
    return out;
}

/** A small bar chart as a PNG data URL. */
function samplePng(bars) {
    const w = 160, h = 90;
    const raw = Buffer.alloc((w * 3 + 1) * h, 255);
    for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0; // filter byte
    const set = (x, y, [r, g, b]) => {
        const i = y * (w * 3 + 1) + 1 + x * 3;
        raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
    };
    for (let x = 8; x < w - 8; x++) set(x, h - 10, [120, 140, 150]); // baseline
    bars.forEach((value, n) => {
        const x0 = 16 + n * 28;
        for (let x = x0; x < x0 + 20; x++) {
            for (let y = h - 11; y > h - 11 - value; y--) set(x, y, [11, 92, 122]);
        }
    });
    const header = Buffer.alloc(13);
    header.writeUInt32BE(w, 0); header.writeUInt32BE(h, 4);
    header[8] = 8; header[9] = 2; // 8-bit RGB
    const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        pngChunk('IHDR', header), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0)),
    ]);
    return `data:image/png;base64,${png.toString('base64')}`;
}

/** A one-page PDF with a line of text, as a data URL. */
function samplePdf(text) {
    const stream = `BT /F1 14 Tf 40 100 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 360 160] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [];
    objects.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((o) => { pdf += `${String(o).padStart(10, '0')} 00000 n \n`; });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return `data:application/pdf;base64,${Buffer.from(pdf).toString('base64')}`;
}

// ---------- The story ----------

// day: offset from today. rec: finished-visit details.
const VISITS = [
    // Aarav Menon, student
    { p: 'aarav.menon@example.edu', d: 'neuro1@health.edu', day: -34, t: '10:00', why: 'Migraine with nausea', status: 'Completed',
        rec: { dx: 'Migraine without aura', advice: 'Keep a headache diary. Avoid skipping meals. Rest in a dark room during an attack.', report: () => samplePng([30, 52, 40, 64, 36, 20]),
            rx: [['Paracetamol', '650 mg', 'Twice a day when needed', '3 days']] } },
    { p: 'aarav.menon@example.edu', d: 'gp1@health.edu', day: -12, t: '09:30', why: 'Fever and body ache', status: 'Completed',
        rec: { dx: 'Viral fever', advice: 'Fluids and rest. Return if the fever lasts beyond three days.', report: () => samplePng([20, 44, 66, 40, 18]),
            rx: [['Paracetamol', '650 mg', 'Every 6 hours if feverish', '3 days']] } },
    { p: 'aarav.menon@example.edu', d: 'neuro1@health.edu', day: -3, t: '11:00', why: 'Headaches after late-night study', status: 'Completed',
        rec: { dx: 'Tension-type headache', advice: 'Screen breaks every hour, two litres of water a day, regular sleep. Come back sooner if headaches wake you at night.', follow: 9,
            report: () => samplePdf('Sample sleep diary (demo file)'),
            rx: [['Paracetamol', '500 mg', 'Up to 3 times a day', '5 days'], ['Magnesium', '250 mg', 'Once at night', '2 weeks']] } },
    { p: 'aarav.menon@example.edu', d: 'neuro1@health.edu', day: 0, t: '11:30', why: 'Headaches continuing, follow-up visit' },
    { p: 'aarav.menon@example.edu', d: 'ortho1@health.edu', day: 2, t: '14:00', why: 'Knee pain after football' },
    { p: 'aarav.menon@example.edu', d: 'gp1@health.edu', day: 1, t: '09:30', why: 'Cold and sore throat', status: 'Cancelled' },

    // Meera Nair, staff
    { p: 'meera.nair@example.edu', d: 'cardio1@health.edu', day: -10, t: '10:00', why: 'Home blood pressure readings around 150/95', status: 'Completed',
        rec: { dx: 'Stage 1 hypertension', advice: 'Less salt, 30 minutes of walking most days, check blood pressure each morning and bring the log.', follow: 4,
            report: () => samplePng([50, 54, 48, 58, 52, 56]),
            rx: [['Amlodipine', '5 mg', 'Once a day', '1 month']] } },
    { p: 'meera.nair@example.edu', d: 'gp1@health.edu', day: -2, t: '09:00', why: 'Sneezing and itchy eyes', status: 'Completed',
        rec: { dx: 'Seasonal allergic rhinitis', advice: 'Keep windows closed in the morning. Wash hands and face after being outdoors.',
            rx: [['Cetirizine', '10 mg', 'Once at night', '7 days']] } },
    { p: 'meera.nair@example.edu', d: 'cardio1@health.edu', day: 0, t: '15:00', why: 'Palpitations after exercise' },
    { p: 'meera.nair@example.edu', d: 'cardio1@health.edu', day: 4, t: '10:30', why: 'Blood pressure follow-up' },

    // Earlier visit so a doctor sees history
    { p: 'diya.kapoor@example.edu', d: 'neuro1@health.edu', day: -20, t: '14:30', why: 'Tingling in fingers', status: 'Completed',
        rec: { dx: 'Probable carpal tunnel irritation', advice: 'Wrist splint at night, avoid long stretches of typing without breaks.', follow: -6 } },

    // Dr. Khanna's busy day
    { p: 'diya.kapoor@example.edu', d: 'neuro1@health.edu', day: 0, t: '09:00', why: 'Numbness in left hand' },
    { p: 'rohan.iyer@example.edu', d: 'neuro1@health.edu', day: 0, t: '09:30', why: 'Trouble sleeping, frequent headaches' },
    { p: 'sana.qureshi@example.edu', d: 'neuro1@health.edu', day: 0, t: '10:00', why: 'Dizziness when standing up' },
    { p: 'kabir.shah@example.edu', d: 'neuro1@health.edu', day: 0, t: '10:30', why: 'Tingling in both feet' },
    { p: 'ishita.rao@example.edu', d: 'neuro1@health.edu', day: 0, t: '11:00', why: 'Migraine with sensitivity to light' },
    { p: 'vivaan.gupta@example.edu', d: 'neuro1@health.edu', day: 0, t: '14:00', why: 'Tremor in right hand' },
    { p: 'sana.qureshi@example.edu', d: 'neuro1@health.edu', day: 1, t: '09:30', why: 'Dizziness, review' },

    // Dr. Patel and Dr. Sharma, today and tomorrow
    { p: 'rohan.iyer@example.edu', d: 'cardio1@health.edu', day: 0, t: '11:00', why: 'Chest tightness on stairs' },
    { p: 'ishita.rao@example.edu', d: 'cardio1@health.edu', day: 0, t: '12:00', why: 'Heart racing at night' },
    { p: 'sana.qureshi@example.edu', d: 'gp1@health.edu', day: 0, t: '09:30', why: 'Fever since yesterday' },
    { p: 'kabir.shah@example.edu', d: 'gp1@health.edu', day: 0, t: '10:30', why: 'Stomach upset after mess food' },
    { p: 'vivaan.gupta@example.edu', d: 'gp1@health.edu', day: 0, t: '11:00', why: 'General check-up' },
    { p: 'diya.kapoor@example.edu', d: 'ortho1@health.edu', day: 1, t: '10:00', why: 'Shoulder pain when lifting' },
];

async function seedDemo(pool) {
    const client = await pool.connect();
    try {
        // Schema first, when the database is empty or from before the latest changes.
        const { rows } = await client.query("SELECT to_regclass('public.users') AS t");
        if (!rows[0].t) await client.query(read('schema.sql'));
        await client.query(read('migrations.sql'));

        await client.query('BEGIN');
        const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

        const patients = [
            ...DEMO_ACCOUNTS.filter((a) => a.role !== 'doctor').map((a) => [a.name, a.email, a.role]),
            ...EXTRA_PATIENTS,
        ];
        const ids = {};
        for (const [i, [name, email, role]] of patients.entries()) {
            const r = await client.query(
                `INSERT INTO Users (name, email, password_hash, role, identifier, phone)
                 VALUES ($1,$2,$3,$4,$5,$6)
                 ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, password_hash = EXCLUDED.password_hash
                 RETURNING id`,
                [name, email, hash, role, `${role === 'staff' ? 'EMP' : 'STU'}2024-${100 + i}`, `98765 4${String(3200 + i).padStart(4, '0')}`]
            );
            ids[email] = r.rows[0].id;
        }

        const docs = {};
        const d = await client.query(
            `SELECT d.id, u.email FROM Doctors d JOIN Users u ON u.id = d.user_id WHERE u.email = ANY($1)`,
            [['neuro1@health.edu', 'cardio1@health.edu', 'gp1@health.edu', 'ortho1@health.edu']]
        );
        d.rows.forEach((r) => { docs[r.email] = r.id; });
        if (Object.keys(docs).length < 4) throw new Error('Demo doctors are missing. Run npm run db:reset:demo.');

        // Different working patterns, and one block of days off, so the slot picker has something to respect.
        await client.query('DELETE FROM DoctorDaysOff WHERE doctor_id = ANY($1)', [Object.values(docs)]);
        await client.query(`UPDATE Doctors SET availability_start='09:00', availability_end='17:00', working_days='{1,2,3,4,5,6}' WHERE id=$1`, [docs['neuro1@health.edu']]);
        await client.query(`UPDATE Doctors SET availability_start='10:00', availability_end='16:00', working_days='{2,3,4,5,6}' WHERE id=$1`, [docs['cardio1@health.edu']]);
        await client.query(`UPDATE Doctors SET availability_start='09:00', availability_end='17:00', working_days='{1,2,3,4,5}' WHERE id=$1`, [docs['gp1@health.edu']]);
        await client.query(`UPDATE Doctors SET availability_start='09:00', availability_end='15:00', working_days='{1,3,5}' WHERE id=$1`, [docs['ortho1@health.edu']]);
        await client.query(
            `INSERT INTO DoctorDaysOff (doctor_id, start_date, end_date, reason) VALUES ($1, CURRENT_DATE + 10, CURRENT_DATE + 14, 'Conference')`,
            [docs['cardio1@health.edu']]
        );

        // Rebuild the demo patients' appointments from scratch (records and prescriptions cascade).
        await client.query('DELETE FROM Appointments WHERE patient_id = ANY($1)', [Object.values(ids)]);

        let records = 0;
        for (const v of VISITS) {
            const a = await client.query(
                `INSERT INTO Appointments (patient_id, doctor_id, appointment_date, appointment_time, status, symptom_description)
                 VALUES ($1, $2, CURRENT_DATE + $3::int, $4, $5, $6) RETURNING id`,
                [ids[v.p], docs[v.d], v.day, v.t, v.status || 'Booked', v.why]
            );
            if (!v.rec) continue;
            const m = await client.query(
                `INSERT INTO MedicalRecords (appointment_id, diagnosis, advice, attached_reports, follow_up_date)
                 VALUES ($1, $2, $3, $4, CASE WHEN $5::int IS NULL THEN NULL ELSE CURRENT_DATE + $5::int END) RETURNING id`,
                [a.rows[0].id, v.rec.dx, v.rec.advice, v.rec.report ? v.rec.report() : null, v.rec.follow ?? null]
            );
            for (const [name, dose, freq, duration] of v.rec.rx || []) {
                await client.query(
                    'INSERT INTO Prescriptions (record_id, medicine_name, dosage, frequency, duration) VALUES ($1,$2,$3,$4,$5)',
                    [m.rows[0].id, name, dose, freq, duration]
                );
            }
            records++;
        }

        await client.query('COMMIT');
        return { patients: patients.length, appointments: VISITS.length, records };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { seedDemo, samplePng, samplePdf };

if (require.main === module) {
    (async () => {
        if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== '1') {
            console.error('Refusing to seed demo data while NODE_ENV=production. Set ALLOW_DEMO_SEED=1 to override.');
            process.exit(1);
        }
        if (!process.env.DATABASE_URL) {
            console.error('DATABASE_URL is not set');
            process.exit(1);
        }
        try {
            if (process.argv.includes('--reset')) {
                await db.pool.query(read('schema.sql'));
                console.log('Schema reloaded.');
            }
            const r = await seedDemo(db.pool);
            console.log(`Demo data ready: ${r.patients} patients, ${r.appointments} appointments, ${r.records} records.`);
            console.log(`Sign in with any demo account (password ${DEMO_PASSWORD}); see README.`);
            await db.pool.end();
        } catch (err) {
            console.error('Seeding failed:', err.message);
            process.exit(1);
        }
    })();
}
