const { Pool, types } = require('pg');
const { resolveSsl } = require('./lib/ssl');

// Return DATE columns as plain 'YYYY-MM-DD' strings. The default parser builds a
// JS Date in the server's timezone, which shifts the day when it is serialised.
types.setTypeParser(1082, (value) => value);

const pool = new Pool(resolveSsl(process.env.DATABASE_URL || ''));

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
