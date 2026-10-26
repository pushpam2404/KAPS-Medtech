const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { DEPARTMENTS } = require('../lib/clinic');
const { isEmail, requiredText, optionalText } = require('../lib/validate');

const router = express.Router();

const ROLES = ['student', 'staff', 'doctor'];
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72; // bcrypt ignores everything past 72 bytes
// Compared against when the email is unknown, so both failures take similar time.
const PLACEHOLDER_HASH = '$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK';

function codeMatches(given) {
    const expected = process.env.DOCTOR_SIGNUP_CODE;
    if (!expected || typeof given !== 'string') return false;
    const a = crypto.createHash('sha256').update(given).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(a, b);
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
    const body = req.body || {};
    const name = requiredText(body.name, 100);
    const identifier = optionalText(body.identifier, 50);
    const phone = optionalText(body.phone, 20);
    const { password, role } = body;

    if (!name || !isEmail(body.email) || typeof password !== 'string' || !ROLES.includes(role)) {
        return res.status(400).json({ error: 'Name, a valid email, password and role are required' });
    }
    if (password.length < MIN_PASSWORD || Buffer.byteLength(password) > MAX_PASSWORD) {
        return res.status(400).json({ error: `Password must be ${MIN_PASSWORD} to ${MAX_PASSWORD} characters` });
    }
    if (identifier === null || phone === null) {
        return res.status(400).json({ error: 'Identifier or phone is too long' });
    }

    let department = null;
    let specialty = '';
    if (role === 'doctor') {
        // Doctor accounts can read patient details, so they are invitation-only.
        if (!process.env.DOCTOR_SIGNUP_CODE) {
            return res.status(403).json({ error: 'Doctor registration is disabled on this server' });
        }
        if (!codeMatches(body.doctor_code)) {
            return res.status(403).json({ error: 'Invalid doctor registration code' });
        }
        if (!DEPARTMENTS.includes(body.department)) {
            return res.status(400).json({ error: 'Choose a valid department' });
        }
        specialty = optionalText(body.specialty, 100);
        if (specialty === null) return res.status(400).json({ error: 'Specialty is too long' });
        department = body.department;
    }

    const email = body.email.trim().toLowerCase();
    const hash = await bcrypt.hash(password, 10);
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            'INSERT INTO Users (name, email, password_hash, role, identifier, phone) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
            [name, email, hash, role, identifier, phone]
        );
        if (role === 'doctor') {
            await client.query(
                'INSERT INTO Doctors (user_id, department, specialty) VALUES ($1,$2,$3)',
                [rows[0].id, department, specialty]
            );
        }
        await client.query('COMMIT');
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
        throw err;
    } finally {
        client.release();
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const { rows } = await db.query('SELECT id, name, role, password_hash FROM Users WHERE email = $1', [
        email.trim().toLowerCase(),
    ]);
    const user = rows[0];
    const match = await bcrypt.compare(password, user ? user.password_hash : PLACEHOLDER_HASH);
    if (!user || !match) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, process.env.JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '1h',
    });
    res.json({ token, role: user.role, name: user.name, id: user.id });
});

module.exports = router;
