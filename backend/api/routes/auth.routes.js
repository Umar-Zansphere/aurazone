const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per `window` (here, per 15 minutes)
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 OTP requests per 15 minutes
  message: 'Too many OTP requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// Email/Password based auth
router.post('/signup',  authController.signup);
router.post('/login', loginLimiter, authController.login);
router.get('/verify-email', authController.verifyEmail);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post(
  '/change-password',
  verifyToken,
  authController.changePassword
);
router.post('/logout', verifyToken, authController.logout);
router.post('/resend-verification', authController.resendVerification);

// Phone/OTP based auth
router.post('/phone-signup', otpLimiter, authController.phoneSignup);
router.post('/phone-signup-verify', authController.phoneSignupVerify);
router.post('/phone-login', otpLimiter, authController.phoneLogin);
router.post('/phone-login-verify', authController.phoneLoginVerify);

// Phone verification for existing users
router.post('/send-phone-verification', verifyToken, authController.sendPhoneVerification);
router.post('/verify-phone-otp', verifyToken, authController.verifyPhoneOtp);

module.exports = router;
