const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
const hasNeonUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech');
const hasSupabaseUrl = process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('supabase.co') || process.env.DATABASE_URL.includes('supabase.com'));
const sslConfig = isProduction || hasNeonUrl || hasSupabaseUrl || process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false;

// Create the connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};