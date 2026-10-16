// ============================================================
//  USER MODEL
// ============================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({

    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [50, 'Name cannot exceed 50 characters']
    },

    identifier: {
        type: String,
        required: [true, 'Email or mobile is required'],
        unique: true,
        trim: true,
        lowercase: true
    },

    type: {
        type: String,
        enum: ['email', 'mobile'],
        required: true
    },

    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },

    verified: {
        type: Boolean,
        default: false
    },

    bestLevel: {
        type: Number,
        default: 1
    },

    totalScore: {
        type: Number,
        default: 0
    },

    totalMatches: {
        type: Number,
        default: 0
    },

    unlockedLevel: {
        type: Number,
        default: 1
    },

    completedLevels: {
        type: [Number],
        default: []
    },

    levelBestScores: {
        type: Map,
        of: Number,
        default: {}
    },

    loginAttempts: {
        type: Number,
        default: 0
    },

    lockUntil: {
        type: Date
    },

    lastLogin: {
        type: Date
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

// ============================================================
//  PASSWORD HASHING — FIXED VERSION
// ============================================================
userSchema.pre('save', async function() {
    // Agar password change nahi hua to kuch mat karo
    if (!this.isModified('password')) return;

    // Password encrypt karo
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

// ============================================================
//  COMPARE PASSWORD
// ============================================================
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// ============================================================
//  IS LOCKED
// ============================================================
userSchema.methods.isLocked = function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
};

// ============================================================
//  INCREMENT LOGIN ATTEMPTS
// ============================================================
userSchema.methods.incLoginAttempts = async function() {
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return await this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }

    const updates = { $inc: { loginAttempts: 1 } };

    if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
        updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
    }

    return await this.updateOne(updates);
};

module.exports = mongoose.model('User', userSchema);
