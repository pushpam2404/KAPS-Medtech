/**
 * Centralized error handling middleware.
 * Catches all errors thrown in async route handlers.
 */

/**
 * Wraps an async route handler to catch errors and pass them to Express error middleware.
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Express error middleware. Must be registered LAST with app.use().
 * Logs the full error server-side, returns a sanitized message to the client.
 */
function errorHandler(err, req, res, _next) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
    if (process.env.NODE_ENV !== 'production') {
        console.error(err.stack);
    }

    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? 'Internal server error' : err.message;

    res.status(statusCode).json({ error: message });
}

module.exports = { asyncHandler, errorHandler };
