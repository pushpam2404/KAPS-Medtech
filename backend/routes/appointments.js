const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { DEPARTMENTS, generateSlots, isValidSlot, isMedicineActive, matchSymptoms } = require('../lib/clinic');
const { toId, toDate, optionalText, requiredText, likePattern } = require('../lib/validate');

const router = express.Router();

const PRESCRIPTIONS_JSON = `
    (SELECT json_agg(json_build_object('medicine', p.medicine_name, 'dosage', p.dosage,
                                       'frequency', p.frequency, 'duration', p.duration) ORDER BY p.id)
     FROM Prescriptions p WHERE p.record_id = mr.id)`;

// Server and users may sit in different timezones; allow one day of slack
// rather than reject someone booking "today" late in the evening.
const NOT_IN_THE_PAST = `$1::date >= CURRENT_DATE - 1`;

// GET /api/appointments/symptoms?q=  (public: a static dictionary)
router.get('/symptoms', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 200) : '';
    const { rows } = await db.query('SELECT id, name, department FROM Symptoms ORDER BY id');
    res.json(q ? matchSymptoms(q, rows).slice(0, 10) : rows);
});

// GET /api/appointments/doctors?department=
router.get('/doctors', authenticateToken, async (req, res) => {
    const { department } = req.query;
    if (department !== undefined && !DEPARTMENTS.includes(department)) {
        return res.status(400).json({ error: 'Unknown department' });
    }
    const { rows } = await db.query(
        `SELECT d.id, u.name, d.department, d.specialty
         FROM Doctors d JOIN Users u ON d.user_id = u.id
         ${department ? 'WHERE d.department = $1' : ''}
         ORDER BY u.name`,
        department ? [department] : []
    );
    res.json(rows);
});

// GET /api/appointments/slots?doctor_id=&date=
router.get('/slots', authenticateToken, async (req, res) => {
    const doctorId = toId(req.query.doctor_id);
    const date = toDate(req.query.date);
    if (!doctorId || !date) return res.status(400).json({ error: 'A valid doctor_id and date (YYYY-MM-DD) are required' });

    const { rows } = await db.query(
        `SELECT to_char(appointment_time, 'HH24:MI') AS t FROM Appointments
         WHERE doctor_id = $1 AND appointment_date = $2 AND status <> 'Cancelled'`,
        [doctorId, date]
    );
    const taken = new Set(rows.map((r) => r.t));
    res.json(generateSlots().filter((t) => !taken.has(t)));
});

// Shared by booking and rescheduling. Returns an error string, or null when the slot is acceptable.
async function checkSlotInput(date, time) {
    if (!date || !time) return 'A valid date (YYYY-MM-DD) and time (HH:MM) are required';
    if (!isValidSlot(time)) return 'Time must be a half-hour slot between 09:00 and 16:30';
    const { rows } = await db.query(`SELECT ${NOT_IN_THE_PAST} AS ok`, [date]);
    return rows[0].ok ? null : 'Appointments cannot be in the past';
}

// POST /api/appointments/book
router.post('/book', authenticateToken, async (req, res) => {
    const doctorId = toId(req.body?.doctor_id);
    const date = toDate(req.body?.date);
    const time = req.body?.time;
    const symptom = optionalText(req.body?.symptom, 255);

    if (!doctorId) return res.status(400).json({ error: 'A valid doctor_id is required' });
    if (symptom === null) return res.status(400).json({ error: 'Reason must be 255 characters or fewer' });
    const problem = await checkSlotInput(date, time);
    if (problem) return res.status(400).json({ error: problem });

    try {
        await db.query(
            `INSERT INTO Appointments (patient_id, doctor_id, appointment_date, appointment_time, symptom_description)
             VALUES ($1, $2, $3, $4, $5)`,
            [req.user.id, doctorId, date, time, symptom]
        );
        res.status(201).json({ message: 'Appointment booked' });
    } catch (err) {
        // The partial unique index is the real guard against double booking.
        if (err.code === '23505') return res.status(409).json({ error: 'This time slot has already been booked' });
        if (err.code === '23503') return res.status(400).json({ error: 'Unknown doctor' });
        throw err;
    }
});

// GET /api/appointments/my-appointments
router.get('/my-appointments', authenticateToken, async (req, res) => {
    const { filter } = req.query;
    let where = `AND a.status = 'Booked'`;
    const params = [req.user.id];

    if (filter === 'date') {
        const start = toDate(req.query.start);
        const end = toDate(req.query.end);
        if (!start || !end) return res.status(400).json({ error: 'start and end must be YYYY-MM-DD' });
        where = 'AND a.appointment_date BETWEEN $2 AND $3';
        params.push(start, end);
    } else if (filter === 'reason') {
        const q = requiredText(req.query.q, 100);
        if (!q) return res.status(400).json({ error: 'Search text is required' });
        where = `AND a.symptom_description ILIKE $2`;
        params.push(likePattern(q));
    }

    const { rows } = await db.query(
        `SELECT a.id, a.appointment_date, to_char(a.appointment_time, 'HH24:MI') AS appointment_time,
                a.status, a.symptom_description,
                u.name AS doctor_name, d.department, u.phone AS doctor_phone
         FROM Appointments a
         JOIN Doctors d ON a.doctor_id = d.id
         JOIN Users u ON d.user_id = u.id
         WHERE a.patient_id = $1 ${where}
         ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
        params
    );
    res.json(rows);
});

// GET /api/appointments/medical-records
router.get('/medical-records', authenticateToken, async (req, res) => {
    const { rows } = await db.query(
        `SELECT mr.id, mr.diagnosis, mr.advice, mr.follow_up_date, mr.attached_reports,
                a.appointment_date, u.name AS doctor_name, ${PRESCRIPTIONS_JSON} AS prescriptions
         FROM MedicalRecords mr
         JOIN Appointments a ON mr.appointment_id = a.id
         JOIN Doctors d ON a.doctor_id = d.id
         JOIN Users u ON d.user_id = u.id
         WHERE a.patient_id = $1
         ORDER BY a.appointment_date DESC, mr.id DESC`,
        [req.user.id]
    );
    res.json(rows);
});

// GET /api/appointments/my-medicine
router.get('/my-medicine', authenticateToken, async (req, res) => {
    const { rows } = await db.query(
        `SELECT p.id, p.medicine_name, p.dosage, p.frequency, p.duration, u.name AS doctor_name, a.appointment_date
         FROM Prescriptions p
         JOIN MedicalRecords mr ON p.record_id = mr.id
         JOIN Appointments a ON mr.appointment_id = a.id
         JOIN Doctors d ON a.doctor_id = d.id
         JOIN Users u ON d.user_id = u.id
         WHERE a.patient_id = $1
         ORDER BY a.appointment_date DESC, p.id`,
        [req.user.id]
    );
    const today = new Date().toISOString().slice(0, 10);
    res.json(rows.filter((m) => isMedicineActive(m.appointment_date, m.duration, today)));
});

// GET /api/appointments/reminders
router.get('/reminders', authenticateToken, async (req, res) => {
    const { rows } = await db.query(
        `SELECT mr.follow_up_date, mr.advice, u.name AS doctor_name
         FROM MedicalRecords mr
         JOIN Appointments a ON mr.appointment_id = a.id
         JOIN Doctors d ON a.doctor_id = d.id
         JOIN Users u ON d.user_id = u.id
         WHERE a.patient_id = $1 AND mr.follow_up_date >= CURRENT_DATE
         ORDER BY mr.follow_up_date ASC`,
        [req.user.id]
    );
    res.json(rows);
});

// GET /api/appointments/:id/record  (the patient or the treating doctor)
router.get('/:id/record', authenticateToken, async (req, res) => {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Appointment not found' });

    const { rows: owner } = await db.query(
        `SELECT a.patient_id, d.user_id AS doctor_user_id
         FROM Appointments a JOIN Doctors d ON a.doctor_id = d.id
         WHERE a.id = $1`,
        [id]
    );
    if (!owner.length) return res.status(404).json({ error: 'Appointment not found' });
    if (owner[0].patient_id !== req.user.id && owner[0].doctor_user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const { rows } = await db.query(
        `SELECT mr.diagnosis, mr.advice, mr.follow_up_date, mr.attached_reports, ${PRESCRIPTIONS_JSON} AS prescriptions
         FROM MedicalRecords mr WHERE mr.appointment_id = $1`,
        [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Record not found' });
    res.json(rows[0]);
});

// PUT /api/appointments/:id/reschedule
router.put('/:id/reschedule', authenticateToken, async (req, res) => {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Appointment not found' });

    const { rows } = await db.query('SELECT patient_id, status FROM Appointments WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
    if (rows[0].patient_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    if (rows[0].status !== 'Booked') {
        return res.status(400).json({ error: 'Only booked appointments can be rescheduled' });
    }

    const date = toDate(req.body?.date);
    const time = req.body?.time;
    const problem = await checkSlotInput(date, time);
    if (problem) return res.status(400).json({ error: problem });

    try {
        await db.query('UPDATE Appointments SET appointment_date = $1, appointment_time = $2 WHERE id = $3', [date, time, id]);
        res.json({ message: 'Rescheduled' });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'This time slot has already been booked' });
        throw err;
    }
});

module.exports = router;
