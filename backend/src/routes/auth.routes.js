const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  loginRules,
  registerRules,
  changePasswordRules,
  forgotPasswordRules,
  resetPasswordRules,
} = require('../validators/auth.validators');

const usernameLoginRules = [
  body('identifier').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];
const aadhaarCheckRules = [
  body('aadhaarLast4').trim().matches(/^[0-9]{4}$/).withMessage('Enter exactly 4 digits'),
];
const aadhaarPasswordRules = [
  body('aadhaarLast4').trim().matches(/^[0-9]{4}$/).withMessage('Enter exactly 4 digits'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const router = express.Router();

// Stricter limiter for brute-force-sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

router.post('/register', authLimiter, registerRules, validate, authController.register);
router.post('/login', authLimiter, loginRules, validate, authController.login);
router.post('/login-username', authLimiter, usernameLoginRules, validate, authController.loginUsername);
router.post('/check-aadhaar', authLimiter, aadhaarCheckRules, validate, authController.checkAadhaar);
router.post('/set-password-aadhaar', authLimiter, aadhaarPasswordRules, validate, authController.setPasswordAadhaar);
router.post('/login-aadhaar', authLimiter, aadhaarPasswordRules, validate, authController.loginAadhaar);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/forgot-password', authLimiter, forgotPasswordRules, validate, authController.forgotPassword);
router.post('/reset-password', authLimiter, resetPasswordRules, validate, authController.resetPassword);

router.get('/me', authenticate, authController.me);
router.post('/change-password', authenticate, changePasswordRules, validate, authController.changePassword);

module.exports = router;
