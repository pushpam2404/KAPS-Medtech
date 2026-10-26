const express = require('express');
const db = require('../db');
const { authenticateToken, requireDoctor } = require('../middleware/auth');
const { toId, toDate, requiredText, optionalText, isValidAttachment } = require('../lib/validate');
const { isHalfHour } = require('../lib/clinic');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(authenticateToken, requireDoctor);

const MAX_PRESCRIPTIONS = 20;

async function doctorIdFor(userId) {
    const { rows } = await db.query('SELECT id FROM Doctors WHERE user_id = $1', [userId]);
    return rows[0]?.id ?? null;
}

// GET /api/doctor/queue  (this doctor's booked appointments, soonest first)
router.get('/queue', async (req, res) => {
    const doctorId = await doctorIdFor(req.user.id);
    if (!doctorId) return res.status(400).json({ error: 'Doctor profile not found' });

    const { rows } = await db.query(
        `SELECT a.id, a.appointment_date, to_char(a.appointment_time, 'HH24:MI') AS appointment_time,
                a.status, a.symptom_description,
                u.name AS patient_name, u.id AS patient_id
         FROM Appointments a JOIN Users u ON a.patient_id = u.id
         WHERE a.doctor_id = $1 AND a.status = 'Booked'
         ORDER BY a.appointment_date, a.appointment_time`,
        [doctorId]
    );
    res.json(rows);
});

// GET /api/doctor/patient/:id  (only patients who have booked with this doctor)
router.get('/patient/:id', async (req, res) => {
    const patientId = toId(req.params.id);
    if (!patientId) return res.status(404).json({ error: 'Patient not found' });

    const { rows } = await db.query(
        `SELECT u.name, u.email, u.phone, u.identifier
         FROM Users u
         WHERE u.id = $1 AND EXISTS (
             SELECT 1 FROM Appointments a JOIN Doctors d ON a.doctor_id = d.id
             WHERE a.patient_id = u.id AND d.user_id = $2)`,
        [patientId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Patient not found' });

    await audit(req.user.id, 'patient_view', 'user', patientId);
    const history = await db.query(
        `SELECT mr.id, mr.diagnosis, mr.advice, mr.follow_up_date, a.appointment_date
         FROM MedicalRecords mr JOIN Appointments a ON mr.appointment_id = a.id
         WHERE a.patient_id = $1
         ORDER BY a.appointment_date DESC, mr.id DESC`,
        [patientId]
    );
    res.json({ patient: rows[0], history: history.rows });
});

// Returns { value } with cleaned fields, or { error }.
function parseRecord(body) {
    const appointmentId = toId(body.appointment_id);
    const diagnosis = requiredText(body.diagnosis, 2000);
    const advice = optionalText(body.advice, 5000);
    const followUp = body.follow_up_date ? toDate(body.follow_up_date) : null;

    if (!appointmentId) return { error: 'A valid appointment_id is required' };
    if (!diagnosis) return { error: 'Diagnosis is required (2000 characters at most)' };
    if (advice === null) return { error: 'Advice is too long' };
    if (body.follow_up_date && !followUp) return { error: 'follow_up_date must be YYYY-MM-DD' };
    if (!isValidAttachment(body.attached_reports)) {
        return { error: 'Report must be a PNG, JPEG, WebP, GIF or PDF under 2 MB' };
    }

    const list = body.prescriptions ?? [];
    if (!Array.isArray(list) || list.length > MAX_PRESCRIPTIONS) {
        return { error: `At most ${MAX_PRESCRIPTIONS} prescriptions are allowed` };
    }
    const prescriptions = [];
    for (const p of list) {
        if (!p || (p.name ?? '') === '') continue; // blank rows from the form
        const row = {
            name: requiredText(p.name, 100),
            dosage: optionalText(p.dosage, 50),
            freq: optionalText(p.freq, 50),
            duration: optionalText(p.duration, 50),
        };
        if (Object.values(row).includes(null)) return { error: 'A prescription field is invalid or too long' };
        prescriptions.push(row);
    }

    const updates = body.patient_updates || {};
    const phone = optionalText(updates.phone, 20);
    const identifier = optionalText(updates.identifier, 50);
    if (phone === null || identifier === null) return { error: 'Phone or ID is too long' };

    return {
        value: {
            appointmentId, diagnosis, advice, followUp, prescriptions, phone, identifier,
            attachment: body.attached_reports || null,
        },
    };
}

// POST /api/doctor/record
router.post('/record', async (req, res) => {
    const { value: r, error } = parseRecord(req.body || {});
    if (error) return res.status(400).json({ error });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Lock the row so two submissions cannot both complete the same visit.
        const { rows } = await client.query(
            `SELECT a.patient_id FROM Appointments a JOIN Doctors d ON a.doctor_id = d.id
             WHERE a.id = $1 AND d.user_id = $2 AND a.status = 'Booked' FOR UPDATE OF a`,
            [r.appointmentId, req.user.id]
        );
        if (!rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'No booked appointment of yours with that id' });
        }

        const record = await client.query(
            `INSERT INTO MedicalRecords (appointment_id, diagnosis, advice, attached_reports, follow_up_date)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [r.appointmentId, r.diagnosis, r.advice, r.attachment, r.followUp]
        );

        for (const p of r.prescriptions) {
            await client.query(
                `INSERT INTO Prescriptions (record_id, medicine_name, dosage, frequency, duration) VALUES ($1,$2,$3,$4,$5)`,
                [record.rows[0].id, p.name, p.dosage, p.freq, p.duration]
            );
        }

        await client.query(`UPDATE Appointments SET status = 'Completed' WHERE id = $1`, [r.appointmentId]);

        if (r.phone || r.identifier) {
            await client.query(
                'UPDATE Users SET phone = COALESCE(NULLIF($1, \'\'), phone), identifier = COALESCE(NULLIF($2, \'\'), identifier) WHERE id = $3',
                [r.phone, r.identifier, rows[0].patient_id]
            );
        }

        await client.query('COMMIT');
        await audit(req.user.id, 'record_create', 'appointment', r.appointmentId);
        res.json({ message: 'Record saved' });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
});

// POST /api/doctor/cancel
router.post('/cancel', async (req, res) => {
    const appointmentId = toId(req.body?.appointment_id);
    if (!appointmentId) return res.status(400).json({ error: 'A valid appointment_id is required' });

    const { rowCount } = await db.query(
        `UPDATE Appointments a SET status = 'Cancelled'
         FROM Doctors d
         WHERE a.id = $1 AND a.doctor_id = d.id AND d.user_id = $2 AND a.status = 'Booked'`,
        [appointmentId, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Appointment not found or already processed' });
    await audit(req.user.id, 'appointment_cancel', 'appointment', appointmentId);
    res.json({ message: 'Appointment cancelled' });
});

// ---------- Availability ----------

async function availabilityFor(doctorId) {
    const doc = await db.query(
        `SELECT to_char(availability_start, 'HH24:MI') AS start_time, to_char(availability_end, 'HH24:MI') AS end_time, working_days
         FROM Doctors WHERE id = $1`,
        [doctorId]
    );
    const off = await db.query(
        `SELECT id, start_date, end_date, reason FROM DoctorDaysOff
         WHERE doctor_id = $1 AND end_date >= CURRENT_DATE - 1 ORDER BY start_date`,
        [doctorId]
    );
    return { ...doc.rows[0], days_off: off.rows };
}

// GET /api/doctor/availability
router.get('/availability', async (req, res) => {
    const doctorId = await doctorIdFor(req.user.id);
    if (!doctorId) return res.status(400).json({ error: 'Doctor profile not found' });
    res.json(await availabilityFor(doctorId));
});

// PUT /api/doctor/availability  { start_time, end_time, working_days }
router.put('/availability', async (req, res) => {
    const doctorId = await doctorIdFor(req.user.id);
    if (!doctorId) return res.status(400).json({ error: 'Doctor profile not found' });

    const { start_time: start, end_time: end, working_days: days } = req.body || {};
    if (!isHalfHour(start) || !isHalfHour(end) || start < '06:00' || end > '22:00' || end <= start) {
        return res.status(400).json({ error: 'Hours must be on the half hour, between 06:00 and 22:00, with the end after the start' });
    }
    const valid = Array.isArray(days) && days.length > 0 && days.length <= 7 && days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7);
    if (!valid) return res.status(400).json({ error: 'Choose at least one working day' });

    await db.query(
        'UPDATE Doctors SET availability_start = $1, availability_end = $2, working_days = $3 WHERE id = $4',
        [start, end, [...new Set(days)].sort(), doctorId]
    );
    // Changing hours does not touch appointments that are already booked.
    const stranded = await db.query(
        `SELECT count(*)::int AS n FROM Appointments
         WHERE doctor_id = $1 AND status = 'Booked' AND appointment_date >= CURRENT_DATE
           AND (appointment_time < $2 OR appointment_time + interval '30 minutes' > $3
                OR NOT (EXTRACT(ISODOW FROM appointment_date)::int = ANY($4)))`,
        [doctorId, start, end, [...new Set(days)]]
    );
    res.json({ ...(await availabilityFor(doctorId)), outside_new_hours: stranded.rows[0].n });
});

// POST /api/doctor/days-off  { start_date, end_date, reason }
router.post('/days-off', async (req, res) => {
    const doctorId = await doctorIdFor(req.user.id);
    if (!doctorId) return res.status(400).json({ error: 'Doctor profile not found' });

    const start = toDate(req.body?.start_date);
    const end = toDate(req.body?.end_date || req.body?.start_date);
    const reason = optionalText(req.body?.reason, 100);
    if (!start || !end || end < start) return res.status(400).json({ error: 'Give a start date and an end date that is not before it' });
    if (reason === null) return res.status(400).json({ error: 'Reason is too long' });

    const { rows: today } = await db.query('SELECT $1::date >= CURRENT_DATE - 1 AS ok, ($2::date - $1::date) <= 366 AS short', [start, end]);
    if (!today[0].ok) return res.status(400).json({ error: 'Days off cannot start in the past' });
    if (!today[0].short) return res.status(400).json({ error: 'A block can cover at most a year' });

    const created = await db.query(
        'INSERT INTO DoctorDaysOff (doctor_id, start_date, end_date, reason) VALUES ($1,$2,$3,$4) RETURNING id',
        [doctorId, start, end, reason]
    );
    // Existing bookings stay; the doctor can cancel them from the queue.
    const booked = await db.query(
        `SELECT count(*)::int AS n FROM Appointments WHERE doctor_id = $1 AND status = 'Booked' AND appointment_date BETWEEN $2 AND $3`,
        [doctorId, start, end]
    );
    res.status(201).json({ id: created.rows[0].id, booked_in_range: booked.rows[0].n });
});

// DELETE /api/doctor/days-off/:id
router.delete('/days-off/:id', async (req, res) => {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Not found' });
    const { rowCount } = await db.query(
        'DELETE FROM DoctorDaysOff o USING Doctors d WHERE o.id = $1 AND o.doctor_id = d.id AND d.user_id = $2',
        [id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Removed' });
});

module.exports = router;
