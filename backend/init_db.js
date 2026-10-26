// Creates the tables and demo data. schema.sql drops existing tables first.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const db = require('./db');

(async () => {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL is not set');
        process.exit(1);
    }
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await db.pool.query(sql);
        console.log('Schema and demo data loaded.');
        await db.pool.end();
    } catch (err) {
        console.error('Failed to load schema:', err.message);
        process.exit(1);
    }
})();
