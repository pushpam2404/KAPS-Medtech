const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Login required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, (err, payload) => {
        if (err) return res.status(401).json({ error: 'Session expired, please log in again' });
        req.user = payload;
        next();
    });
}

function requireDoctor(req, res, next) {
    if (req.user.role !== 'doctor') return res.status(403).json({ error: 'Doctors only' });
    next();
}

module.exports = { authenticateToken, requireDoctor };
