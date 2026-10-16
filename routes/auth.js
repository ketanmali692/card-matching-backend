// ============================================================
//  AUTHENTICATION ROUTES - Email Only
// ============================================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { authLimiter } = require('../middleware/rateLimit');
const auth = require('../middleware/auth');
const { sendEmail } = require('../utils/notify');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const generateToken = (userId) => {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
};

const isEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

const pendingSignups = new Map();

// ============================================================
//  SEND OTP (SIGNUP)
// ============================================================
router.post('/send-otp', authLimiter, [
    body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
    body('identifier').trim().isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        let { name, identifier, password } = req.body;
        identifier = identifier.toLowerCase().trim();

        if (!isEmail(identifier)) {
            return res.status(400).json({ error: 'Please enter a valid email address' });
        }

        // ✅ EMAIL ALREADY REGISTERED CHECK
        const existingUser = await User.findOne({ identifier });
        if (existingUser) {
            return res.status(400).json({
                error: 'This email is already registered. Please login instead.'
            });
        }

        await Otp.deleteMany({ identifier, purpose: 'signup' });

        const otp = generateOTP();

        await Otp.create({
            identifier,
            otp,
            purpose: 'signup'
        });

        pendingSignups.set(identifier, {
            name,
            password,
            createdAt: Date.now()
        });

        console.log('=================================');
        console.log(`📧 Signup OTP for ${identifier}: ${otp}`);
        console.log('=================================');

        let emailSent = false;
        let emailError = null;

        try {
            await sendEmail(
                identifier,
                'Verify Your Account - Card Matching Game',
                'Your OTP is: ' + otp + '\n\nValid for 5 minutes.\n\n- Card Matching Game'
            );
            emailSent = true;
            console.log(`✅ SIGNUP EMAIL SENT to ${identifier}`);
        } catch (emailErr) {
            emailError = emailErr.message;
            console.error(`❌ EMAIL FAILED: ${emailErr.message}`);
        }

        res.json({
            success: true,
            message: emailSent
                ? 'OTP sent successfully to your email'
                : 'OTP generated. Email may be delayed. Please check spam.',
            identifier: identifier,
            emailSent: emailSent
        });

    } catch (err) {
        console.error('❌ Send OTP route error:', err);
        res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }
});

// ============================================================
//  VERIFY OTP (SIGNUP)
// ============================================================
router.post('/verify-otp', authLimiter, [
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('identifier').trim().notEmpty().withMessage('Email required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { otp } = req.body;
        let { identifier } = req.body;
        identifier = identifier.toLowerCase().trim();

        const otpRecord = await Otp.findOne({
            identifier,
            purpose: 'signup'
        });

        if (!otpRecord) {
            return res.status(400).json({ error: 'OTP expired. Please request new one.' });
        }

        if (otpRecord.attempts >= 5) {
            await Otp.deleteOne({ _id: otpRecord._id });
            return res.status(400).json({ error: 'Too many wrong attempts. Please start over.' });
        }

        if (otpRecord.otp !== otp) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
        }

        const pending = pendingSignups.get(identifier);

        if (!pending) {
            return res.status(400).json({ error: 'Signup session expired. Please start over.' });
        }

        const user = await User.create({
            name: pending.name,
            identifier: identifier,
            type: 'email',
            password: pending.password,
            verified: true
        });

        await Otp.deleteOne({ _id: otpRecord._id });
        pendingSignups.delete(identifier);

        const token = generateToken(user._id);

        res.json({
            success: true,
            message: 'Account created successfully',
            token,
            user: {
                id: user._id,
                name: user.name,
                identifier: user.identifier,
                type: user.type,
                bestLevel: user.bestLevel,
                totalScore: user.totalScore,
                totalMatches: user.totalMatches,
                unlockedLevel: user.unlockedLevel,
                completedLevels: user.completedLevels,
                levelBestScores: user.levelBestScores,
                loginTime: Date.now(),
                loggedIn: true
            }
        });

    } catch (err) {
        console.error('Verify OTP error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// ============================================================
//  LOGIN
// ============================================================
router.post('/login', authLimiter, [
    body('identifier').trim().isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        let { identifier, password } = req.body;
        identifier = identifier.toLowerCase().trim();

        const user = await User.findOne({ identifier }).select('+password');

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (user.isLocked()) {
            return res.status(423).json({
                error: 'Account locked due to multiple failed attempts. Try after 2 hours.'
            });
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            await user.incLoginAttempts();
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (user.loginAttempts > 0) {
            await user.updateOne({
                $set: { loginAttempts: 0 },
                $unset: { lockUntil: 1 }
            });
        }

        user.lastLogin = Date.now();
        await user.save();

        const token = generateToken(user._id);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                identifier: user.identifier,
                type: user.type,
                bestLevel: user.bestLevel,
                totalScore: user.totalScore,
                totalMatches: user.totalMatches,
                unlockedLevel: user.unlockedLevel,
                completedLevels: user.completedLevels,
                levelBestScores: user.levelBestScores,
                loginTime: Date.now(),
                loggedIn: true
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// ============================================================
//  FORGOT PASSWORD - STEP 1: Send OTP
// ============================================================
router.post('/forgot-password', authLimiter, [
    body('identifier').trim().isEmail().withMessage('Valid email required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        let { identifier } = req.body;
        identifier = identifier.toLowerCase().trim();

        // ✅ Check karo user exist karta hai ya nahi
        const user = await User.findOne({ identifier });

        if (!user) {
            return res.status(404).json({
                error: 'This email is not registered. Please create an account.'
            });
        }

        // Purane reset OTP delete karo
        await Otp.deleteMany({ identifier, purpose: 'reset' });

        const otp = generateOTP();

        await Otp.create({
            identifier,
            otp,
            purpose: 'reset'
        });

        console.log('=================================');
        console.log(`🔐 Reset Password OTP for ${identifier}: ${otp}`);
        console.log('=================================');

        let emailSent = false;

        try {
            await sendEmail(
                identifier,
                'Reset Your Password - Card Matching Game',
                'Your password reset OTP is: ' + otp + '\n\nValid for 5 minutes.\n\nIf you did not request this, please ignore this email.\n\n- Card Matching Game'
            );
            emailSent = true;
            console.log(`✅ RESET EMAIL SENT to ${identifier}`);
        } catch (emailErr) {
            console.error(`❌ EMAIL FAILED: ${emailErr.message}`);
            return res.status(500).json({
                error: 'Failed to send OTP email. Please try again.'
            });
        }

        res.json({
            success: true,
            message: 'Password reset OTP sent to your email',
            identifier: identifier
        });

    } catch (err) {
        console.error('❌ Forgot password error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// ============================================================
//  RESET PASSWORD - STEP 2: Verify OTP + Set New Password
// ============================================================
router.post('/reset-password', authLimiter, [
    body('identifier').trim().isEmail().withMessage('Valid email required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        let { identifier, otp, newPassword } = req.body;
        identifier = identifier.toLowerCase().trim();

        // OTP check karo
        const otpRecord = await Otp.findOne({
            identifier,
            purpose: 'reset'
        });

        if (!otpRecord) {
            return res.status(400).json({
                error: 'OTP expired. Please request a new one.'
            });
        }

        if (otpRecord.attempts >= 5) {
            await Otp.deleteOne({ _id: otpRecord._id });
            return res.status(400).json({
                error: 'Too many wrong attempts. Please start over.'
            });
        }

        if (otpRecord.otp !== otp) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
        }

        // ✅ User dhundho
        const user = await User.findOne({ identifier });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // ✅ Naya password set karo
        user.password = newPassword;
        await user.save();

        // OTP delete karo
        await Otp.deleteOne({ _id: otpRecord._id });

        console.log(`✅ Password reset successful for ${identifier}`);

        res.json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.'
        });

    } catch (err) {
        console.error('❌ Reset password error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// ============================================================
//  GET CURRENT USER
// ============================================================
router.get('/me', auth, async (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user._id,
            name: req.user.name,
            identifier: req.user.identifier,
            type: req.user.type,
            bestLevel: req.user.bestLevel,
            totalScore: req.user.totalScore,
            totalMatches: req.user.totalMatches,
            unlockedLevel: req.user.unlockedLevel,
            completedLevels: req.user.completedLevels,
            levelBestScores: req.user.levelBestScores
        }
    });
});

module.exports = router;0
