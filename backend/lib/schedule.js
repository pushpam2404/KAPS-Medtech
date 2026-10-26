// Database-backed view of when a doctor can be booked.
const db = require('../db');
const { offeredSlots } = require('./clinic');

/**
 * Slots a doctor offers on `date` (null if the doctor does not exist), and the
 * ones still free. Booked slots are those of non-cancelled appointments.
 */
async function getDoctorDay(doctorId, date) {
    const doc = await db.query(
        `SELECT to_char(availability_start, 'HH24:MI') AS start, to_char(availability_end, 'HH24:MI') AS "end", working_days
         FROM Doctors WHERE id = $1`,
        [doctorId]
    );
    if (!doc.rows.length) return null;
    const { start, end, working_days: workingDays } = doc.rows[0];

    const [off, booked] = await Promise.all([
        db.query(`SELECT start_date, end_date FROM DoctorDaysOff WHERE doctor_id = $1 AND start_date <= $2 AND end_date >= $2`, [doctorId, date]),
        db.query(
            `SELECT to_char(appointment_time, 'HH24:MI') AS t FROM Appointments
             WHERE doctor_id = $1 AND appointment_date = $2 AND status <> 'Cancelled'`,
            [doctorId, date]
        ),
    ]);

    const offered = offeredSlots({ start, end, workingDays }, date, off.rows);
    const taken = new Set(booked.rows.map((r) => r.t));
    return { offered, free: offered.filter((t) => !taken.has(t)), dayOff: off.rows.length > 0 };
}

module.exports = { getDoctorDay };
