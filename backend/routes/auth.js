const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

// Validation helpers
const VALID_ROLES = ['student', 'staff', 'doctor'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_FIELD_LENGTH = 100;

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
    const { name, email, password, role, identifier, phone, department, specialty } = req.body;

    // Input validation
    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'Missing required fields: name, email, password, role' });
    }
    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }
    if (name.length > MAX_FIELD_LENGTH || email.length > MAX_FIELD_LENGTH) {
        return res.status(400).json({ error: 'Input fields exceed maximum length' });
    }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Check Email
        const check = await client.query('SELECT id FROM Users WHERE email = $1', [email]);
        if (check.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert User
        const userRes = await client.query(
            'INSERT INTO Users (name, email, password_hash, role, identifier, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, role, name',
            [name.trim(), email.trim().toLowerCase(), hashedPassword, role, identifier, phone]
        );
        const user = userRes.rows[0];

        // If Doctor, insert into Doctors table
        if (role === 'doctor') {
            if (!department) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Doctor requires department' });
            }
            await client.query(
                'INSERT INTO Doctors (user_id, department, specialty) VALUES ($1, $2, $3)',
                [user.id, department, specialty]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[SIGNUP ERROR]', err.message);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    } finally {
        client.release();
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const result = await db.query('SELECT * FROM Users WHERE email = $1', [email.trim().toLowerCase()]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token, role: user.role, name: user.name, id: user.id });
    } catch (err) {
        console.error('[LOGIN ERROR]', err.message);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

module.exports = router;
