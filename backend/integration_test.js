// backend/integration_test.js
// Automated Integration Test for KAPS MedTech API

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const API_BASE = `http://localhost:${process.env.PORT || 3001}/api`;

async function runTests() {
    console.log('🧪 Starting KAPS MedTech API Integration Tests...\n');
    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`✅ PASSED: ${message}`);
            passed++;
        } else {
            console.error(`❌ FAILED: ${message}`);
            failed++;
        }
    }

    try {
        // --- 1. Test Auth Signup Validation ---
        console.log('--- Test 1: Signup Input Validation ---');
        const invalidSignupRes = await fetch(`${API_BASE}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Student',
                email: 'invalid-email',
                password: '123',
                role: 'student'
            })
        });
        const invalidSignupData = await invalidSignupRes.json();
        assert(invalidSignupRes.status === 400, 'Signup blocks invalid email format');
        assert(invalidSignupData.error.includes('email') || invalidSignupData.error.includes('Password'), 'Signup returns correct validation error message');

        // --- 2. Test Successful Student Signup ---
        console.log('\n--- Test 2: Successful Student Signup ---');
        const studentEmail = `student_${Date.now()}@university.edu`;
        const signupRes = await fetch(`${API_BASE}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'John Test Student',
                email: studentEmail,
                password: 'password123',
                role: 'student',
                phone: '555-4321',
                identifier: 'STU999'
            })
        });
        const signupData = await signupRes.json();
        assert(signupRes.status === 201, 'Student signs up successfully');
        assert(signupData.message.includes('successfully'), 'Signup returns success message');

        // --- 3. Test Signup Email Duplication ---
        console.log('\n--- Test 3: Email Duplication Check ---');
        const duplicateRes = await fetch(`${API_BASE}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Another Student',
                email: studentEmail,
                password: 'password123',
                role: 'student'
            })
        });
        assert(duplicateRes.status === 409, 'Signup blocks duplicate email registration');

        // --- 4. Test Student Login ---
        console.log('\n--- Test 4: Student Login ---');
        const loginRes = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: studentEmail,
                password: 'password123'
            })
        });
        const loginData = await loginRes.json();
        assert(loginRes.status === 200, 'Student logs in successfully');
        assert(loginData.token !== undefined, 'Login returns JWT token');
        const studentToken = loginData.token;
        const studentId = loginData.id;

        // --- 5. Test Fetch Doctors ---
        console.log('\n--- Test 5: Fetch Doctors (Authenticated) ---');
        const doctorsRes = await fetch(`${API_BASE}/appointments/doctors?department=Neurology`, {
            headers: { 'Authorization': `Bearer ${studentToken}` }
        });
        const doctorsData = await doctorsRes.json();
        assert(doctorsRes.status === 200, 'Authorized request retrieves doctor list');
        assert(Array.isArray(doctorsData), 'Response is an array of doctors');
        assert(doctorsData.length > 0, 'Seed neurology doctors are successfully loaded');
        // Let's grab Dr. Mohit Khanna (seeded as NEU001 / ID 21 or search by specialty)
        const doctor = doctorsData.find(d => d.name.includes('Mohit') || d.specialty === 'NEU001') || doctorsData[0];
        const doctorId = doctor.id;
        console.log(`Using Doctor ID: ${doctorId} (${doctor.name})`);

        // --- 6. Test Fetch Slots ---
        console.log('\n--- Test 6: Fetch Available Slots ---');
        const dateStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]; // Tomorrow
        const slotsRes = await fetch(`${API_BASE}/appointments/slots?doctor_id=${doctorId}&date=${dateStr}`, {
            headers: { 'Authorization': `Bearer ${studentToken}` }
        });
        const slotsData = await slotsRes.json();
        assert(slotsRes.status === 200, 'Slots fetched successfully');
        assert(Array.isArray(slotsData), 'Slots return list of strings');
        const targetTime = slotsData[0] || '10:00';

        // --- 7. Test Appointment Booking ---
        console.log('\n--- Test 7: Book Appointment ---');
        const bookRes = await fetch(`${API_BASE}/appointments/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                doctor_id: doctorId,
                date: dateStr,
                time: targetTime,
                symptom: 'Headaches and dizziness'
            })
        });
        assert(bookRes.status === 201, 'Appointment booked successfully');

        // --- 8. Test Booking Conflict (Race Condition Protection) ---
        console.log('\n--- Test 8: Booking Conflict (Race Condition Guard) ---');
        const conflictRes = await fetch(`${API_BASE}/appointments/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                doctor_id: doctorId,
                date: dateStr,
                time: targetTime,
                symptom: 'Double booking attempt'
            })
        });
        assert(conflictRes.status === 409, 'Double booking identical slot is blocked');

        // --- 9. Test Fetch My Appointments ---
        console.log('\n--- Test 9: Fetch Patient Appointments ---');
        const myApptsRes = await fetch(`${API_BASE}/appointments/my-appointments`, {
            headers: { 'Authorization': `Bearer ${studentToken}` }
        });
        const myApptsData = await myApptsRes.json();
        assert(myApptsRes.status === 200, 'Fetched patient appointments');
        assert(myApptsData.length > 0, 'Booked appointment is present in list');
        const appt = myApptsData[0];
        const apptId = appt.id;

        // --- 10. Test Reschedule Appointment ---
        console.log('\n--- Test 10: Reschedule Appointment ---');
        const rescheduleTime = slotsData[1] || '10:30';
        const rescheduleRes = await fetch(`${API_BASE}/appointments/${apptId}/reschedule`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                date: dateStr,
                time: rescheduleTime
            })
        });
        assert(rescheduleRes.status === 200, 'Rescheduling appointment succeeded');

        // --- 11. Test Doctor Login & Active Queue ---
        console.log('\n--- Test 11: Doctor Login & Queue Retrieval ---');
        // Let's log in as Dr. Mohit Khanna (email: neuro1@health.edu)
        const docLoginRes = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'neuro1@health.edu',
                password: 'password123'
            })
        });
        const docLoginData = await docLoginRes.json();
        assert(docLoginRes.status === 200, 'Doctor logs in successfully');
        const doctorToken = docLoginData.token;

        const docQueueRes = await fetch(`${API_BASE}/doctor/today`, {
            headers: { 'Authorization': `Bearer ${doctorToken}` }
        });
        const docQueueData = await docQueueRes.json();
        assert(docQueueRes.status === 200, 'Doctor queue fetched successfully');
        assert(docQueueData.some(a => a.id === apptId), 'Student appointment appears in doctor queue');

        // --- 12. Test Submit Clinical Record (Prescriptions & Medical Records) ---
        console.log('\n--- Test 12: Doctor Submits Treatment Record ---');
        const treatmentRes = await fetch(`${API_BASE}/doctor/record`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doctorToken}`
            },
            body: JSON.stringify({
                appointment_id: apptId,
                diagnosis: 'Tension Headache',
                advice: 'Rest in a quiet, dark room',
                follow_up_date: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0], // 10 days later
                prescriptions: [
                    {
                        name: 'Ibuprofen',
                        dosage: '400mg',
                        freq: 'Twice daily',
                        duration: '5 days'
                    }
                ],
                patient_updates: {
                    phone: '555-8888',
                    identifier: 'STU-SEEDED'
                }
            })
        });
        assert(treatmentRes.status === 200, 'Treatment record submitted successfully');

        // --- 13. Test Patient Fetching Medical Record ---
        console.log('\n--- Test 13: Patient Retrieves Records, Meds, and Reminders ---');
        const recordsRes = await fetch(`${API_BASE}/appointments/medical-records`, {
            headers: { 'Authorization': `Bearer ${studentToken}` }
        });
        const recordsData = await recordsRes.json();
        assert(recordsRes.status === 200, 'Fetched medical records');
        assert(recordsData.some(r => r.diagnosis === 'Tension Headache'), 'Diagnosis matches');

        const medsRes = await fetch(`${API_BASE}/appointments/my-medicine`, {
            headers: { 'Authorization': `Bearer ${studentToken}` }
        });
        const medsData = await medsRes.json();
        assert(medsRes.status === 200, 'Fetched active medicines');
        assert(medsData.some(m => m.medicine_name === 'Ibuprofen'), 'Medicine listed correctly');

        const remindersRes = await fetch(`${API_BASE}/appointments/reminders`, {
            headers: { 'Authorization': `Bearer ${studentToken}` }
        });
        const remindersData = await remindersRes.json();
        assert(remindersRes.status === 200, 'Fetched follow-up reminders');
        assert(remindersData.length > 0, 'Follow-up reminder correctly generated');

        // --- 14. Test Cross-User Data Access (Security Block checks) ---
        console.log('\n--- Test 14: Cross-User Resource Isolation Guards ---');
        // Let's sign up another student to act as an attacker
        const attackerEmail = `attacker_${Date.now()}@university.edu`;
        await fetch(`${API_BASE}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Attacker Student',
                email: attackerEmail,
                password: 'password123',
                role: 'student'
            })
        });
        const attackerLoginRes = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: attackerEmail,
                password: 'password123'
            })
        });
        const attackerLoginData = await attackerLoginRes.json();
        const attackerToken = attackerLoginData.token;

        // Attacker attempts to read the patient's record
        const accessBlockedRes = await fetch(`${API_BASE}/appointments/${apptId}/record`, {
            headers: { 'Authorization': `Bearer ${attackerToken}` }
        });
        assert(accessBlockedRes.status === 403, 'Blocked other users from reading patient medical record');

        // Attacker attempts to reschedule patient's appointment
        const rescheduleBlockedRes = await fetch(`${API_BASE}/appointments/${apptId}/reschedule`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${attackerToken}`
            },
            body: JSON.stringify({
                date: dateStr,
                time: rescheduleTime
            })
        });
        assert(rescheduleBlockedRes.status === 403, 'Blocked other users from rescheduling patient appointment');

        // --- Summary of results ---
        console.log('\n=======================================');
        console.log(`🏁 TESTS RUN COMPLETE.`);
        console.log(`Passed: ${passed}/${passed + failed}`);
        console.log(`Failed: ${failed}/${passed + failed}`);
        console.log('=======================================');

        if (failed > 0) {
            process.exit(1);
        } else {
            console.log('🎉 Excellent! All API endpoints and security checks are working successfully.');
            process.exit(0);
        }

    } catch (e) {
        console.error('❌ Integration test execution crashed:', e);
        process.exit(1);
    }
}

runTests();
