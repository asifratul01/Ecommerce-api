const User = require('../models/User');
const crypto = require('crypto');
const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');
const emailService = require('./email.service');

class AuthService {
  /**
   * Register a new user
   */
  async registerUser({ name, email, password }) {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('User already exists with this email', 400);
    }

    // Create verification token
    const verificationToken = crypto.randomBytes(20).toString('hex');
    const verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      verificationToken,
      verificationTokenExpires,
    });

    return { user, verificationToken };
  }

  /**
   * Login user
   */
  async loginUser(email, password) {
    // Check if email and password exist
    if (!email || !password) {
      throw new AppError('Please provide email and password', 400);
    }

    // Check if user exists and password is correct
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.correctPassword(password))) {
      throw new AppError('Incorrect email or password', 401);
    }

    // Check if user is verified
    if (!user.isVerified) {
      throw new AppError('Please verify your email first', 401);
    }

    return user;
  }

  /**
   * Forgot password
   */
  async forgotPassword(email) {
    // Get user based on POSTed email
    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError('There is no user with that email address', 404);
    }

    // Generate the random reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    return resetToken;
  }

  /**
   * Reset password
   */
  async resetPassword(token, password, confirmPassword) {
    if (password !== confirmPassword) {
      throw new AppError('Passwords do not match', 400);
    }

    // Get user based on the token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError('Token is invalid or has expired', 400);
    }

    // Set new password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Generate JWT token
    const authToken = user.generateAuthToken();

    return { user, token: authToken };
  }

  /**
   * Update password
   */
  async updatePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');

    // Check if current password is correct
    if (!(await user.correctPassword(currentPassword))) {
      throw new AppError('Your current password is wrong', 401);
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new JWT token
    const token = user.generateAuthToken();

    return { user, token };
  }

  /**
   * Verify email token
   */
  async verifyEmailToken(token) {
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError('Token is invalid or has expired', 400);
    }

    // Mark user as verified
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, data) {
    const user = await User.findByIdAndUpdate(
      userId,
      {
        name: data.name,
        email: data.email,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    return user;
  }

  /**
   * Get all users (Admin)
   */
  async getAllUsers() {
    return await User.find();
  }

  /**
   * Get single user (Admin)
   */
  async getSingleUser(userId) {
    return await User.findById(userId);
  }

  /**
   * Update user role (Admin)
   */
  async updateUserRole(userId, role) {
    return await User.findByIdAndUpdate(
      userId,
      { role },
      {
        new: true,
        runValidators: true,
      }
    );
  }

  /**
   * Delete user (Admin)
   */
  async deleteUser(userId) {
    await User.findByIdAndDelete(userId);
  }
}

module.exports = new AuthService();
