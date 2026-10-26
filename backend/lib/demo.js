// Demo logins. Shown on the sign-in page (unless DEMO_MODE=off) and created
// by `npm run db:seed:demo`. Doctors come from schema.sql.
const DEMO_PASSWORD = 'password123';

const DEMO_ACCOUNTS = [
    { role: 'student', label: 'Student patient', name: 'Aarav Menon', email: 'aarav.menon@example.edu' },
    { role: 'staff', label: 'Staff patient', name: 'Meera Nair', email: 'meera.nair@example.edu' },
    { role: 'doctor', label: 'Neurology doctor', name: 'Dr. Mohit Khanna', email: 'neuro1@health.edu' },
    { role: 'doctor', label: 'Cardiology doctor', name: 'Dr. Arjun Patel', email: 'cardio1@health.edu' },
    { role: 'doctor', label: 'General Medicine doctor', name: 'Dr. Anil Sharma', email: 'gp1@health.edu' },
];

// Extra patients who fill the doctors' queues. Not listed on the sign-in page.
const EXTRA_PATIENTS = [
    ['Diya Kapoor', 'diya.kapoor@example.edu', 'student'],
    ['Rohan Iyer', 'rohan.iyer@example.edu', 'student'],
    ['Sana Qureshi', 'sana.qureshi@example.edu', 'student'],
    ['Kabir Shah', 'kabir.shah@example.edu', 'student'],
    ['Ishita Rao', 'ishita.rao@example.edu', 'staff'],
    ['Vivaan Gupta', 'vivaan.gupta@example.edu', 'student'],
];

module.exports = { DEMO_PASSWORD, DEMO_ACCOUNTS, EXTRA_PATIENTS };
