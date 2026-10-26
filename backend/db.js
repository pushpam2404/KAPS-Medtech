const { Pool, types } = require('pg');

// Return DATE columns as plain 'YYYY-MM-DD' strings. The default parser builds a
// JS Date in the server's timezone, which shifts the day when it is serialised.
types.setTypeParser(1082, (value) => value);

const url = process.env.DATABASE_URL || '';
const isHosted = /neon\.tech|supabase\.(co|com)/.test(url);
const useSsl = process.env.NODE_ENV === 'production' || isHosted || process.env.DB_SSL === 'true';

// rejectUnauthorized is off so self-signed managed databases connect without
// extra setup. For a database with a proper certificate, turn it on.
const pool = new Pool({
    connectionString: url,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
