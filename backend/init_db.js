const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./db');

(async () => {
    try {
        console.log('📜 Reading schema.sql...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('🔌 Connecting to DB to run schema...');
        await db.pool.query(schemaSql);

        console.log('✅ Schema Executed Successfully! Tables created.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to run schema:', err);
        process.exit(1);
    }
})();
