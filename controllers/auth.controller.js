const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');
const authService = require('../services/auth.service');
const jwtToken = require('../utils/jwtToken');
const emailService = require('../services/email.service');
const User = require('../models/User');

// Register a new user
exports.registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const { user, verificationToken } = await authService.registerUser({ name, email, password });

    // Send verification email
    const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/verify-email/${verificationToken}`;
    await emailService.sendVerificationEmail(email, verificationToken, verificationUrl);

    res.status(201).json({
      success: true,
      message: `Verification email sent to ${user.email}`,
    });
  } catch (error) {
    logger.error(`Registration error: ${error}`);
    next(new AppError(error.message, error.statusCode || 500));
  }
};

// Login user (updated version)
exports.loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Invalid email or password', 401));
    }

    jwtToken.sendToken(user, 200, res);
  } catch (error) {
    logger.error(`Login error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Logout user
exports.logout = async (req, res, next) => {
  try {
    res.cookie('token', null, {
      expires: new Date(Date.now()),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error(`Logout error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Forgot password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const resetToken = await authService.forgotPassword(email);

    const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/reset-password/${resetToken}`;
    await emailService.sendPasswordReset(email, resetToken, resetUrl);

    res.status(200).json({
      success: true,
      message: 'Password reset email sent',
    });
  } catch (error) {
    logger.error(`Forgot password error: ${error}`);
    next(new AppError(error.message, error.statusCode || 500));
  }
};

// Reset password
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    const { user, token: authToken } = await authService.resetPassword(
      token,
      password,
      confirmPassword
    );

    const options = {
      expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    };

    res.status(200).cookie('token', authToken, options).json({
      success: true,
      token: authToken,
      user,
    });
  } catch (error) {
    logger.error(`Reset password error: ${error}`);
    next(new AppError(error.message, error.statusCode || 500));
  }
};

// Get user profile
exports.getUserProfile = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    logger.error(`Get user profile error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Update password
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, newPasswordConfirm } = req.body;
    const { user, token } = await authService.updatePassword(
      req.user.id,
      currentPassword,
      newPassword,
      newPasswordConfirm
    );

    const options = {
      expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    };

    res.status(200).cookie('token', token, options).json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    logger.error(`Update password error: ${error}`);
    next(new AppError(error.message, error.statusCode || 500));
  }
};

// Verify email
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    const user = await authService.verifyEmailToken(token);

    await emailService.sendWelcomeEmail(user.email, user.name);
    jwtToken.sendToken(user, 200, res);
  } catch (error) {
    logger.error(`Verify email error: ${error}`);
    next(new AppError(error.message, error.statusCode || 500));
  }
};

// Update profile
exports.updateProfile = async (req, res, next) => {
  try {
    const user = await authService.updateProfile(req.user.id, {
      name: req.body.name,
      email: req.body.email,
    });

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    logger.error(`Update profile error: ${error}`);
    next(new AppError(error.message, error.statusCode || 500));
  }
};

// Admin: Get all users
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await authService.getAllUsers();
    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    logger.error(`Get all users error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Admin: Get single user
exports.getUser = async (req, res, next) => {
  try {
    const user = await authService.getSingleUser(req.params.id);
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    logger.error(`Get single user error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Admin: Update user
exports.updateUser = async (req, res, next) => {
  try {
    const user = await authService.updateUser(req.params.id, {
      name: req.body.name,
      email: req.body.email,
      role: req.body.role,
    });

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    logger.error(`Update user error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Admin: Delete user
exports.deleteUser = async (req, res, next) => {
  try {
    await authService.deleteUser(req.params.id);
    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    logger.error(`Delete user error: ${error}`);
    next(new AppError(error.message, 500));
  }
};
