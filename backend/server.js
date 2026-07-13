// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');

// Load environment variables from backend/.env
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Validate required environment variables
const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL'];
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`❌ FATAL: Missing required environment variable: ${key}`);
        process.exit(1);
    }
}

const db = require('./db');
const { errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const appointmentRoutes = require('./routes/appointments');
const doctorRoutes = require('./routes/doctor');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---

// CORS: restrict to known origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : undefined;
app.use(cors(allowedOrigins ? { origin: allowedOrigins } : {}));

// Body parsing with reasonable limit
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// --- Routes ---

// Health check
app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'OK', db: 'Connected' });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', error: 'Database connection failed' });
    }
});

const { rateLimiter } = require('./middleware/rateLimiter');

app.use('/api/auth', rateLimiter(15 * 60 * 1000, 30, 'Too many login attempts. Please try again after 15 minutes.'), authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctor', doctorRoutes);

// SPA fallback
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// --- Error Handling (must be last) ---
app.use(errorHandler);

// --- Server Start ---
module.exports = app;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}