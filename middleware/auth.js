// ============================================================
//  JWT AUTHENTICATION MIDDLEWARE
// ============================================================

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'No token provided. Please login.'
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                error: 'User not found. Please login again.'
            });
        }

        req.user = user;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Session expired. Please login again.'
            });
        }
        return res.status(401).json({
            error: 'Invalid token. Please login.'
        });
    }
};

module.exports = auth;
