/**
 * Small in-memory limiter, keyed on req.ip.
 * State lives in one process, so on a serverless host each warm instance
 * counts separately. It slows down guessing; it is not a hard guarantee.
 */
function rateLimiter({ windowMs, max, message }) {
    const hits = new Map(); // ip -> timestamps inside the window

    const sweep = setInterval(() => {
        const cutoff = Date.now() - windowMs;
        for (const [ip, times] of hits) {
            if (times[times.length - 1] <= cutoff) hits.delete(ip);
        }
    }, windowMs);
    sweep.unref();

    return (req, res, next) => {
        const now = Date.now();
        const times = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
        times.push(now);
        hits.set(req.ip, times);

        if (times.length > max) {
            res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
            return res.status(429).json({ error: message });
        }
        next();
    };
}

module.exports = { rateLimiter };
