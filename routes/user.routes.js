const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const auth = require('../middlewares/auth');
const { check } = require('express-validator');

// Public routes
router.post(
  '/forgot-password',
  [check('email', 'Please provide a valid email').isEmail()],
  userController.forgotPassword
);

router.patch(
  '/reset-password/:token',
  [
    check('password', 'Password must be at least 8 characters').isLength({ min: 8 }),
    check('passwordConfirm', 'Passwords must match').custom(
      (value, { req }) => value === req.body.password
    ),
  ],
  userController.resetPassword
);

// Protected routes (require authentication)
router.use(auth.protect);

router.get('/me', userController.getMe);
router.patch(
  '/update-profile',
  [
    check('name', 'Name must be between 2-50 characters').optional().isLength({ min: 2, max: 50 }),
    check('email', 'Please provide a valid email').optional().isEmail(),
  ],
  userController.updateProfile
);
router.patch(
  '/update-password',
  [
    check('currentPassword', 'Current password is required').notEmpty(),
    check('newPassword', 'New password must be at least 8 characters').isLength({ min: 8 }),
  ],
  userController.updatePassword
);

// Admin-only routes
router.use(auth.restrictTo('admin'));

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUser);
router.patch(
  '/:id',
  [
    check('name', 'Name must be between 2-50 characters').optional().isLength({ min: 2, max: 50 }),
    check('email', 'Please provide a valid email').optional().isEmail(),
    check('role', 'Role must be either user or admin').optional().isIn(['user', 'admin']),
  ],
  userController.updateUser
);
router.delete('/:id', userController.deleteUser);

module.exports = router;
