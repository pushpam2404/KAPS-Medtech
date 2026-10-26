// Decides how to talk TLS to PostgreSQL.
//
// Verification is on whenever SSL is used. Neon's certificates chain to
// Let's Encrypt, which Node trusts, so they verify as they are. Supabase's pooler
// uses its own CA: give it as DATABASE_CA (PEM text), or set DATABASE_SSL=relaxed.
//
//   DATABASE_SSL = verify (default when SSL is used) | relaxed | off
//   DATABASE_CA  = PEM text of an extra CA to trust (optional)
//   DB_SSL=true  = older name for "use SSL"
//
// sslmode in the URL is removed and applied here, because pg lets the URL
// override the options passed in code.

const HOSTED = /neon\.tech|supabase\.(co|com)/;

function resolveSsl(connectionString = '', env = process.env) {
    const urlMode = (connectionString.match(/[?&]sslmode=([^&]*)/) || [])[1];
    const cleaned = connectionString.replace(/([?&])(sslmode|uselibpqcompat)=[^&]*&?/g, '$1').replace(/[?&]$/, '');

    let mode = (env.DATABASE_SSL || '').toLowerCase();
    if (!['verify', 'relaxed', 'off'].includes(mode)) mode = '';
    if (!mode && urlMode === 'disable') mode = 'off';
    if (!mode && urlMode === 'no-verify') mode = 'relaxed';

    const wantsSsl = Boolean(
        mode ||
        urlMode ||
        env.DB_SSL === 'true' ||
        env.NODE_ENV === 'production' ||
        HOSTED.test(cleaned)
    );

    if (mode === 'off' || !wantsSsl) return { connectionString: cleaned, ssl: false };
    if (mode === 'relaxed') return { connectionString: cleaned, ssl: { rejectUnauthorized: false } };
    return {
        connectionString: cleaned,
        ssl: env.DATABASE_CA ? { rejectUnauthorized: true, ca: env.DATABASE_CA } : { rejectUnauthorized: true },
    };
}

module.exports = { resolveSsl };
