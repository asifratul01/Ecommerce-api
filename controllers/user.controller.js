const User = require('../models/User');
const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');

// Get all users - Admin only
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password');

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    logger.error(`Get all users error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Get single user - Admin only
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    logger.error(`Get user error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Get current user profile
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    logger.error(`Get profile error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Update user profile
exports.updateProfile = async (req, res, next) => {
  try {
    const fieldsToUpdate = {
      name: req.body.name,
      email: req.body.email,
    };

    // Handle avatar upload if present
    if (req.body.avatar) {
      fieldsToUpdate.avatar = req.body.avatar;
    }

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    }).select('-password');

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    logger.error(`Update profile error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Update user password
exports.updatePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(req.body.currentPassword);
    if (!isMatch) {
      return next(new AppError('Current password is incorrect', 401));
    }

    user.password = req.body.newPassword;
    await user.save();

    // Send password changed email
    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Changed',
        html: `<p>Your password has been successfully changed.</p>`,
      });
    } catch (emailError) {
      logger.error(`Password change email error: ${emailError}`);
    }

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    logger.error(`Update password error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Update user - Admin only
exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Prevent updating admin's own role
    if (req.user.id === req.params.id && req.body.role) {
      return next(new AppError('Cannot change your own role', 400));
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name,
        email: req.body.email,
        role: req.body.role,
      },
      {
        new: true,
        runValidators: true,
      }
    ).select('-password');

    res.status(200).json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    logger.error(`Update user error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Delete user - Admin only
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Prevent self-deletion
    if (req.user.id === req.params.id) {
      return next(new AppError('Cannot delete your own account', 400));
    }

    await user.remove();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    logger.error(`Delete user error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Forgot password
exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return next(new AppError('No user found with that email', 404));
    }

    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/reset-password/${resetToken}`;

    // Send email
    try {
      await sendEmail({
        email: user.email,
        subject: 'Your password reset token (valid for 10 min)',
        html: `
          <p>You requested a password reset. Click the link below to set a new password:</p>
          <a href="${resetUrl}">Reset Password</a>
          <p>This link will expire in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `,
      });

      res.status(200).json({
        success: true,
        message: 'Password reset token sent to email',
      });
    } catch (error) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      logger.error(`Send password reset email error: ${error}`);
      return next(new AppError('There was an error sending the email. Try again later.', 500));
    }
  } catch (error) {
    logger.error(`Forgot password error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Reset password
exports.resetPassword = async (req, res, next) => {
  try {
    // Get hashed token
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return next(new AppError('Token is invalid or has expired', 400));
    }

    if (req.body.password !== req.body.passwordConfirm) {
      return next(new AppError('Passwords do not match', 400));
    }

    // Set new password
    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Send confirmation email
    try {
      await sendEmail({
        email: user.email,
        subject: 'Your password has been reset',
        html: `<p>Your password has been successfully updated.</p>`,
      });
    } catch (emailError) {
      logger.error(`Password reset confirmation email error: ${emailError}`);
    }

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    logger.error(`Reset password error: ${error}`);
    next(new AppError(error.message, 500));
  }
};
