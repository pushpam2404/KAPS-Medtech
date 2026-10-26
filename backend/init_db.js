// Loads schema.sql (drops existing tables first) or, with --migrate,
// applies migrations.sql to an existing database without losing data.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const db = require('./db');

const migrate = process.argv.includes('--migrate');

(async () => {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL is not set');
        process.exit(1);
    }
    try {
        const file = migrate ? 'migrations.sql' : 'schema.sql';
        await db.pool.query(fs.readFileSync(path.join(__dirname, file), 'utf8'));
        console.log(migrate ? 'Migrations applied.' : 'Schema and demo data loaded.');
        await db.pool.end();
    } catch (err) {
        console.error('Failed:', err.message);
        process.exit(1);
    }
})();
