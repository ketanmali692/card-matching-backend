// ============================================================
//  EMAIL NOTIFICATION (Gmail)
// ============================================================

const nodemailer = require('nodemailer');

let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    console.log('✅ Email service ready');
} else {
    console.log('⚠️ Email not configured in .env');
}

async function sendEmail(to, subject, text) {
    if (!transporter) {
        console.log('📧 Email not configured. Would send to:', to);
        console.log('📧 OTP:', text);
        return;
    }

    try {
        const otpMatch = text.match(/\d{6}/);
        const otp = otpMatch ? otpMatch[0] : '------';

        await transporter.sendMail({
            from: '"Card Matching Game" <' + process.env.EMAIL_USER + '>',
            to: to,
            subject: subject,
            text: text,
            html: '<div style="font-family:Arial;padding:30px;background:#0a1929;color:#fff;border-radius:12px;max-width:500px;margin:auto">' +
                  '<h2 style="color:#60a5fa;text-align:center">🎮 Card Matching Game</h2>' +
                  '<hr style="border-color:#1e3a5f">' +
                  '<p style="font-size:16px;color:#fff">Your Email Verification OTP:</p>' +
                  '<h1 style="font-size:42px;letter-spacing:12px;color:#60a5fa;text-align:center;background:#0d1f38;padding:20px;border-radius:10px">' + otp + '</h1>' +
                  '<p style="color:#8aa2bf;font-size:14px">This OTP is valid for 5 minutes.</p>' +
                  '<p style="color:#8aa2bf;font-size:12px">If you did not request this OTP, please ignore this email.</p>' +
                  '<hr style="border-color:#1e3a5f">' +
                  '<p style="color:#8aa2bf;font-size:11px;text-align:center">Made with ❤️ for memory training</p>' +
                  '</div>'
        });
        console.log('✅ Email sent to:', to);
    } catch (err) {
        console.error('❌ Email error:', err.message);
        throw new Error('Failed to send email: ' + err.message);
    }
}

async function sendOTP(mobile, otp) {
    console.log('📱 SMS not configured. Would send to:', mobile);
    return true;
}

module.exports = { sendEmail, sendOTP };
