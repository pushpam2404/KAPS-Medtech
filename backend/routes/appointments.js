const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Helper
function parseDurationToDays(durationStr) {
    if (!durationStr) return 0;
    const parts = durationStr.toLowerCase().split(' ');
    const val = parseInt(parts[0]);
    if (isNaN(val)) return 0;
    if (parts[1] && parts[1].startsWith('week')) return val * 7;
    if (parts[1] && parts[1].startsWith('month')) return val * 30;
    return val;
}

// GET /api/appointments/symptoms
router.get('/symptoms', async (req, res) => {
    const { q } = req.query;
    try {
        let queryText = 'SELECT * FROM Symptoms';
        let params = [];
        if (q) {
            queryText += ' WHERE name ILIKE $1';
            params.push(`%${q}%`);
        }
        const result = await db.query(queryText, params);
        res.json(result.rows);
    } catch (err) {
        console.error('[SYMPTOMS ERROR]', err.message);
        res.status(500).json({ error: 'Failed to fetch symptoms' });
    }
});

// GET /api/appointments/doctors
router.get('/doctors', authenticateToken, async (req, res) => {
    const { department } = req.query;
    try {
        let queryText = `
            SELECT d.id, u.name, d.department, d.specialty
            FROM Doctors d
            JOIN Users u ON d.user_id = u.id
        `;
        let params = [];
        if (department) {
            queryText += ' WHERE d.department = $1';
            params.push(department);
        }
        const result = await db.query(queryText, params);
        res.json(result.rows);
    } catch (err) {
        console.error('[DOCTORS ERROR]', err.message);
        res.status(500).json({ error: 'Failed to fetch doctors' });
    }
});

// GET /api/appointments/slots
router.get('/slots', authenticateToken, async (req, res) => {
    const { doctor_id, date } = req.query;
    if (!doctor_id || !date) return res.status(400).json({ error: 'Missing doctor_id or date' });

    try {
        const booked = await db.query(
            'SELECT appointment_time FROM Appointments WHERE doctor_id = $1 AND appointment_date = $2 AND status != \'Cancelled\'',
            [doctor_id, date]
        );
        const bookedTimes = booked.rows.map(r => r.appointment_time.substring(0, 5));

        const slots = [];
        let start = 9;
        while (start < 17) {
            const h = start.toString().padStart(2, '0');
            ['00', '30'].forEach(m => {
                const time = `${h}:${m}`;
                if (!bookedTimes.includes(time)) {
                    slots.push(time);
                }
            });
            start++;
        }
        res.json(slots);
    } catch (err) {
        console.error('[SLOTS ERROR]', err.message);
        res.status(500).json({ error: 'Failed to fetch available slots' });
    }
});

// POST /api/appointments/book
router.post('/book', authenticateToken, async (req, res) => {
    const { doctor_id, date, time, symptom } = req.body;

    // Validate required fields
    if (!doctor_id || !date || !time) {
        return res.status(400).json({ error: 'Missing required fields: doctor_id, date, time' });
    }

    try {
        // Check for slot conflict (race condition protection)
        const conflict = await db.query(
            `SELECT id FROM Appointments 
             WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3 AND status != 'Cancelled'`,
            [doctor_id, date, time]
        );
        if (conflict.rows.length > 0) {
            return res.status(409).json({ error: 'This time slot has already been booked' });
        }

        await db.query(
            'INSERT INTO Appointments (patient_id, doctor_id, appointment_date, appointment_time, symptom_description) VALUES ($1, $2, $3, $4, $5)',
            [req.user.id, doctor_id, date, time, symptom]
        );
        res.status(201).json({ message: 'Appointment booked' });
    } catch (err) {
        console.error('[BOOK ERROR]', err.message);
        res.status(500).json({ error: 'Failed to book appointment' });
    }
});

// GET /api/appointments/my-appointments
router.get('/my-appointments', authenticateToken, async (req, res) => {
    const { filter, start, end, q } = req.query;
    try {
        let sql = `
            SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.symptom_description,
                   u.name as doctor_name, d.department, u.phone as doctor_phone
            FROM Appointments a
            JOIN Doctors d ON a.doctor_id = d.id
            JOIN Users u ON d.user_id = u.id
            WHERE a.patient_id = $1
        `;
        let params = [req.user.id];
        let idx = 2;

        if (filter === 'date' && start && end) {
            sql += ` AND a.appointment_date BETWEEN $${idx++} AND $${idx++}`;
            params.push(start, end);
        } else if (filter === 'reason' && q) {
            sql += ` AND a.symptom_description ILIKE $${idx++}`;
            params.push(`%${q}%`);
        } else {
            sql += ` AND a.status = 'Booked'`;
        }

        sql += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC`;

        const result = await db.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('[APPOINTMENTS ERROR]', err.message);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

// GET /api/appointments/medical-records
router.get('/medical-records', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT mr.id, mr.diagnosis, mr.advice, mr.follow_up_date, mr.attached_reports,
                   a.appointment_date, u.name as doctor_name,
                   (SELECT json_agg(json_build_object('medicine', p.medicine_name, 'dosage', p.dosage, 'frequency', p.frequency, 'duration', p.duration)) 
                    FROM Prescriptions p WHERE p.record_id = mr.id) as prescriptions
            FROM MedicalRecords mr
            JOIN Appointments a ON mr.appointment_id = a.id
            JOIN Doctors d ON a.doctor_id = d.id
            JOIN Users u ON d.user_id = u.id
            WHERE a.patient_id = $1
            ORDER BY a.appointment_date DESC
        `, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error('[RECORDS ERROR]', err.message);
        res.status(500).json({ error: 'Failed to fetch medical records' });
    }
});

// GET /api/appointments/:id/record
router.get('/:id/record', authenticateToken, async (req, res) => {
    try {
        // Verify ownership: patient or treating doctor
        const aptCheck = await db.query(
            `SELECT a.patient_id, d.user_id as doctor_user_id
             FROM Appointments a
             JOIN Doctors d ON a.doctor_id = d.id
             WHERE a.id = $1`, [req.params.id]
        );
        if (aptCheck.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
        const apt = aptCheck.rows[0];
        if (apt.patient_id !== req.user.id && apt.doctor_user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await db.query(`
            SELECT mr.diagnosis, mr.advice, mr.follow_up_date, mr.attached_reports,
                   (SELECT json_agg(json_build_object('medicine', p.medicine_name, 'dosage', p.dosage, 'frequency', p.frequency, 'duration', p.duration)) 
                    FROM Prescriptions p WHERE p.record_id = mr.id) as prescriptions
            FROM MedicalRecords mr
            WHERE mr.appointment_id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch record' });
    }
});

// GET /api/appointments/my-medicine
router.get('/my-medicine', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.id, p.medicine_name, p.dosage, p.frequency, p.duration, u.name as doctor_name, a.appointment_date
            FROM Prescriptions p
            JOIN MedicalRecords mr ON p.record_id = mr.id
            JOIN Appointments a ON mr.appointment_id = a.id
            JOIN Doctors d ON a.doctor_id = d.id
            JOIN Users u ON d.user_id = u.id
            WHERE a.patient_id = $1
            ORDER BY a.appointment_date DESC
        `, [req.user.id]);

        const activeMeds = result.rows.filter(m => {
            const days = parseDurationToDays(m.duration);
            if (days === 0) return true;

            const prescribedDate = new Date(m.appointment_date);
            const expiryDate = new Date(prescribedDate);
            expiryDate.setDate(prescribedDate.getDate() + days);

            return new Date() <= expiryDate;
        });

        res.json(activeMeds);
    } catch (err) {
        console.error('[MEDICINE ERROR]', err.message);
        res.status(500).json({ error: 'Failed to fetch medicines' });
    }
});

// GET /api/appointments/reminders
router.get('/reminders', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT mr.follow_up_date, mr.advice, u.name as doctor_name
            FROM MedicalRecords mr
            JOIN Appointments a ON mr.appointment_id = a.id
            JOIN Doctors d ON a.doctor_id = d.id
            JOIN Users u ON d.user_id = u.id
            WHERE a.patient_id = $1 AND mr.follow_up_date >= CURRENT_DATE
            ORDER BY mr.follow_up_date ASC
        `, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error('[REMINDERS ERROR]', err.message);
        res.status(500).json({ error: 'Failed to fetch reminders' });
    }
});

// PUT /api/appointments/:id/reschedule
router.put('/:id/reschedule', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { date, time } = req.body;

    try {
        const apt = await db.query('SELECT * FROM Appointments WHERE id = $1', [id]);
        if (apt.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        // Verify ownership
        if (apt.rows[0].patient_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (apt.rows[0].status !== 'Booked') {
            return res.status(400).json({ error: 'Cannot reschedule completed/cancelled appointment' });
        }

        await db.query(
            'UPDATE Appointments SET appointment_date = $1, appointment_time = $2 WHERE id = $3',
            [date, time, id]
        );
        res.json({ message: 'Rescheduled' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to reschedule appointment' });
    }
});

module.exports = router;
