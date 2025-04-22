const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const auth = require('../middlewares/auth');
const { validate } = require('../validations/auth.validation');

// Public routes
router.post('/register', validate('registerSchema'), authController.registerUser);

router.post('/login', validate('loginSchema'), authController.loginUser);

router.post('/forgot-password', validate('forgotPasswordSchema'), authController.forgotPassword);

router.put('/reset-password/:token', validate('resetPasswordSchema'), authController.resetPassword);

// Verify email route
router.get('/verify-email/:token', validate('verifyEmailSchema'), authController.verifyEmail);

// Protected routes (require authentication)
router.use(auth.protect);

router.get('/me', authController.getUserProfile);
router.put('/update-password', validate('updatePasswordSchema'), authController.updatePassword);
router.post('/logout', authController.logout);

// Admin-only routes
router.use(auth.restrictTo('admin'));

router.get('/admin/users', authController.getAllUsers);
router.get('/admin/users/:id', validate('objectIdSchema'), authController.getUser);
router.put(
  '/admin/users/:id',
  validate('objectIdSchema'),
  validate('adminUpdateUserSchema'),
  authController.updateUser
);
router.delete('/admin/users/:id', validate('objectIdSchema'), authController.deleteUser);

module.exports = router;
