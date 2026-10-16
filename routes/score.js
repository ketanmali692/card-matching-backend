// ============================================================
//  SCORE ROUTES
// ============================================================

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const User = require('../models/User');

// ============================================================
//  UPDATE SCORE
//  POST /api/score/update
// ============================================================
router.post('/update', auth, [
    body('level').isInt({ min: 1, max: 10000 }).withMessage('Invalid level'),
    body('score').isInt({ min: 0, max: 100000 }).withMessage('Invalid score')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { level, score, completed, matches } = req.body;
        const user = req.user;

        const currentBest = user.levelBestScores.get(String(level)) || 0;
        if (score > currentBest) {
            user.levelBestScores.set(String(level), score);
        }

        if (completed) {
            if (!user.completedLevels.includes(level)) {
                user.completedLevels.push(level);
                user.totalScore += score;
            }
            if (level + 1 > user.unlockedLevel) {
                user.unlockedLevel = level + 1;
            }
            if (level > user.bestLevel) {
                user.bestLevel = level;
            }
        }

        if (matches) {
            user.totalMatches += matches;
        }

        await user.save();

        res.json({
            success: true,
            message: 'Score updated',
            stats: {
                bestLevel: user.bestLevel,
                totalScore: user.totalScore,
                totalMatches: user.totalMatches,
                unlockedLevel: user.unlockedLevel,
                completedLevels: user.completedLevels
            }
        });

    } catch (err) {
        console.error('Score update error:', err);
        res.status(500).json({ error: 'Failed to update score' });
    }
});

// ============================================================
//  GET LEADERBOARD
//  GET /api/score/leaderboard
// ============================================================
router.get('/leaderboard', async (req, res) => {
    try {
        const top = await User.find({ verified: true })
            .sort({ totalScore: -1 })
            .limit(50)
            .select('name bestLevel totalScore totalMatches');

        res.json({
            success: true,
            leaderboard: top.map((u, i) => ({
                rank: i + 1,
                name: u.name,
                bestLevel: u.bestLevel,
                totalScore: u.totalScore,
                totalMatches: u.totalMatches
            }))
        });
    } catch (err) {
        console.error('Leaderboard error:', err);
        res.status(500).json({ error: 'Failed to load leaderboard' });
    }
});

module.exports = router;
