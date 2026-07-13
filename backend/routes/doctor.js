const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Middleware to ensure user is doctor
function requireDoctor(req, res, next) {
    if (req.user.role !== 'doctor') return res.sendStatus(403);
    next();
}

// GET /api/doctor/today
router.get('/today', authenticateToken, requireDoctor, async (req, res) => {
    try {
        // Find doctor_id for this user
        const docRes = await db.query('SELECT id FROM Doctors WHERE user_id = $1', [req.user.id]);
        if (docRes.rows.length === 0) return res.status(400).json({ error: 'Doctor profile not found' });
        const doctorId = docRes.rows[0].id;

        const result = await db.query(`
            SELECT a.id, a.appointment_time, a.status, a.symptom_description,
                   u.name as patient_name, u.id as patient_id, u.phone as patient_phone, u.email as patient_email
            FROM Appointments a
            JOIN Users u ON a.patient_id = u.id
            WHERE a.doctor_id = $1 AND a.status != 'Completed'
            ORDER BY a.appointment_time ASC
        `, [doctorId]);

        // Note: Removed 'AND a.appointment_date = CURRENT_DATE' to make demo easier (shows all active)

        res.json(result.rows);
    } catch (err) {
        console.error('[DOCTOR TODAY ERROR]', err.message);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

// GET /api/doctor/patient/:id
router.get('/patient/:id', authenticateToken, requireDoctor, async (req, res) => {
    const { id } = req.params; // Patient User ID
    try {
        const userRes = await db.query('SELECT name, email, phone, identifier, role FROM Users WHERE id = $1', [id]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });

        // Get history
        const historyRes = await db.query(`
            SELECT mr.id, mr.diagnosis, mr.advice, mr.follow_up_date, a.appointment_date,
             (SELECT json_agg(json_build_object('medicine', p.medicine_name)) FROM Prescriptions p WHERE p.record_id = mr.id) as meds
            FROM MedicalRecords mr
            JOIN Appointments a ON mr.appointment_id = a.id
            WHERE a.patient_id = $1
            ORDER BY a.appointment_date DESC
        `, [id]);

        res.json({
            patient: userRes.rows[0],
            history: historyRes.rows
        });
    } catch (err) {
        console.error('[PATIENT ERROR]', err.message);
        res.status(500).json({ error: 'Failed to fetch patient details' });
    }
});

// POST /api/doctor/record
router.post('/record', authenticateToken, requireDoctor, async (req, res) => {
    const { appointment_id, diagnosis, advice, attached_reports, follow_up_date, prescriptions, patient_updates } = req.body;

    // Validate required fields
    if (!appointment_id || !diagnosis) {
        return res.status(400).json({ error: 'Appointment ID and diagnosis are required' });
    }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Insert Medical Record
        const mrRes = await client.query(
            'INSERT INTO MedicalRecords (appointment_id, diagnosis, advice, attached_reports, follow_up_date) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [appointment_id, diagnosis, advice, attached_reports, follow_up_date]
        );
        const recordId = mrRes.rows[0].id;

        // 2. Batch Insert Prescriptions
        if (prescriptions && prescriptions.length > 0) {
            const values = [];
            const params = [];
            let idx = 1;
            for (const p of prescriptions) {
                if (p.name) {
                    values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
                    params.push(recordId, p.name, p.dosage || '', p.freq || '', p.duration || '');
                }
            }
            if (values.length > 0) {
                await client.query(
                    `INSERT INTO Prescriptions (record_id, medicine_name, dosage, frequency, duration) VALUES ${values.join(', ')}`,
                    params
                );
            }
        }

        // 3. Mark Appointment as Completed
        await client.query('UPDATE Appointments SET status = \'Completed\' WHERE id = $1', [appointment_id]);

        // 4. Update Patient Details
        if (patient_updates) {
            const aptRes = await client.query('SELECT patient_id FROM Appointments WHERE id = $1', [appointment_id]);
            if (aptRes.rows.length > 0) {
                const patientId = aptRes.rows[0].patient_id;
                let updateFields = [];
                let params = [];
                let idx = 1;

                if (patient_updates.phone) { updateFields.push(`phone = $${idx++}`); params.push(patient_updates.phone); }
                if (patient_updates.identifier) { updateFields.push(`identifier = $${idx++}`); params.push(patient_updates.identifier); }

                if (updateFields.length > 0) {
                    params.push(patientId);
                    await client.query(`UPDATE Users SET ${updateFields.join(', ')} WHERE id = $${idx}`, params);
                }
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Record saved' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[RECORD SAVE ERROR]', err.message);
        res.status(500).json({ error: 'Failed to save treatment record' });
    } finally {
        client.release();
    }
});

// POST /api/doctor/cancel
router.post('/cancel', authenticateToken, requireDoctor, async (req, res) => {
    const { appointment_id } = req.body;
    try {
        // Verify this doctor owns the appointment
        const docRes = await db.query('SELECT id FROM Doctors WHERE user_id = $1', [req.user.id]);
        if (docRes.rows.length === 0) return res.status(400).json({ error: 'Doctor profile not found' });

        const result = await db.query(
            'UPDATE Appointments SET status = \'Cancelled\' WHERE id = $1 AND doctor_id = $2 AND status = \'Booked\' RETURNING id',
            [appointment_id, docRes.rows[0].id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found or already processed' });
        }
        res.json({ message: 'Appointment Cancelled' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to cancel appointment' });
    }
});

module.exports = router;
