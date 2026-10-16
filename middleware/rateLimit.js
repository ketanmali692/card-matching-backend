// ============================================================
//  RATE LIMITING MIDDLEWARE
// ============================================================

const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many attempts. Please try after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

const otpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'Too many OTP requests. Please try after 1 hour.' }
});

const scoreLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Too many score updates. Slow down!' }
});

module.exports = { authLimiter, otpLimiter, scoreLimiter };
