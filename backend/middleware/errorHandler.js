// Express 5 forwards rejected promises from async handlers here on its own.
function errorHandler(err, req, res, _next) {
    const status = err.status || err.statusCode || 500;
    console.error(`[error] ${req.method} ${req.path}: ${err.message}`);
    if (status === 500 && process.env.NODE_ENV !== 'production') console.error(err.stack);

    // Client errors raised by body-parser (bad JSON, too large) are safe to echo as 400/413.
    const message = status === 413 ? 'Request too large'
        : status >= 500 ? 'Internal server error'
        : status === 400 ? 'Malformed request'
        : err.message;
    res.status(status).json({ error: message });
}

module.exports = { errorHandler };
