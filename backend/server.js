const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

for (const key of ['JWT_SECRET', 'DATABASE_URL']) {
    if (!process.env[key]) {
        console.error(`Missing required environment variable: ${key}`);
        process.exit(1);
    }
}

const express = require('express');
const cors = require('cors');
const db = require('./db');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/auth');
const appointmentRoutes = require('./routes/appointments');
const doctorRoutes = require('./routes/doctor');

const app = express();

// Behind Vercel's proxy, req.ip must come from X-Forwarded-For or every
// visitor shares one rate-limit bucket. Elsewhere that header is spoofable.
if (process.env.VERCEL || process.env.TRUST_PROXY) app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' https://fonts.googleapis.com",
            "font-src https://fonts.gstatic.com",
            "img-src 'self' data:",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "base-uri 'none'",
            "form-action 'self'",
        ].join('; '),
    });
    next();
});

// The frontend is served from this origin, so CORS is only needed when
// another site calls the API.
if (process.env.ALLOWED_ORIGINS) {
    app.use(cors({ origin: process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()) }));
}

// Reports travel as base64 inside the JSON body (2 MB file is about 2.7 MB).
app.use(express.json({ limit: '3.5mb' }));

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'OK', db: 'Connected' });
    } catch (err) {
        console.error(`[health] ${err.message}`);
        res.status(503).json({ status: 'ERROR', error: 'Database connection failed' });
    }
});

const authLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 30,
    message: 'Too many attempts. Please try again in 15 minutes.',
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use(errorHandler);

module.exports = app;

if (require.main === module) {
    const port = process.env.PORT || 3001;
    app.listen(port, () => console.log(`KAPS MedTech listening on http://localhost:${port}`));
}
