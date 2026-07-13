const rateLimitStore = new Map();

/**
 * A lightweight, in-memory rate limiter middleware.
 * @param {number} windowMs - The time window in milliseconds (e.g. 15 minutes).
 * @param {number} max - The maximum number of requests allowed per IP within the window.
 * @param {string} message - The error message returned when limit is exceeded.
 */
function rateLimiter(windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests, please try again later.') {
    return (req, res, next) => {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const now = Date.now();

        if (!rateLimitStore.has(ip)) {
            rateLimitStore.set(ip, []);
        }

        const requests = rateLimitStore.get(ip);
        // Filter out requests older than the time window
        const activeRequests = requests.filter(time => now - time < windowMs);
        activeRequests.push(now);
        rateLimitStore.set(ip, activeRequests);

        if (activeRequests.length > max) {
            return res.status(429).json({ error: message });
        }

        next();
    };
}

module.exports = { rateLimiter };
