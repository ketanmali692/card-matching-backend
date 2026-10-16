// ============================================================
//  CARD MATCHING GAME - MAIN SERVER
// ============================================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

// ⚠️ NOTIFY.JS LOAD KARO SHURU ME HI
require('./utils/notify');

const authRoutes = require('./routes/auth');
const scoreRoutes = require('./routes/score');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.get('/', (req, res) => {
    res.json({
        message: 'Card Matching Game Backend is running! 🎮',
        database: mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Not connected ❌',
        time: new Date().toISOString()
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/score', scoreRoutes);

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB connected successfully!');
        app.listen(PORT, () => {
            console.log(`
    ════════════════════════════════════════
    🎮 BACKEND SERVER STARTED
    ════════════════════════════════════════
    🌐 http://localhost:${PORT}
    🗄️  MongoDB: Connected
    📡 API Endpoints:
       POST /api/auth/send-otp
       POST /api/auth/verify-otp
       POST /api/auth/login
       GET  /api/auth/me
       POST /api/score/update
       GET  /api/score/leaderboard
    ════════════════════════════════════════
            `);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    });