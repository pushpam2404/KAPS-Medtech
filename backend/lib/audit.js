const db = require('../db');

/** Record who did what to which row. A failure here must not break the request. */
async function audit(userId, action, targetType, targetId) {
    try {
        await db.query('INSERT INTO AuditLog (user_id, action, target_type, target_id) VALUES ($1,$2,$3,$4)', [userId, action, targetType, targetId]);
    } catch (err) {
        console.error(`[audit] ${err.message}`);
    }
}

module.exports = { audit };
