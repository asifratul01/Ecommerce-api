const AuthService = require('../../../server/services/auth.service');
const User = require('../../../server/models/User');
const AppError = require('../../../server/utils/AppError');
const crypto = require('crypto');
const emailService = require('../../../server/services/email.service');

// Mock dependencies
jest.mock('../../../server/models/User');
jest.mock('../../../server/services/email.service');
jest.mock('crypto');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      // Mock User.findOne to return null (no existing user)
      User.findOne.mockResolvedValue(null);

      // Mock crypto and User.create
      crypto.randomBytes.mockReturnValue({ toString: () => 'mockToken' });
      const mockUser = {
        _id: 'userId',
        name: 'Test User',
        email: 'test@example.com',
        verificationToken: 'mockToken',
      };
      User.create.mockResolvedValue(mockUser);

      const result = await AuthService.registerUser({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(User.create).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        verificationToken: 'mockToken',
        verificationTokenExpires: expect.any(Number),
      });
      expect(result.user).toEqual(mockUser);
      expect(result.verificationToken).toBe('mockToken');
    });

    it('should throw error if user already exists', async () => {
      User.findOne.mockResolvedValue({ email: 'test@example.com' });

      await expect(
        AuthService.registerUser({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(AppError);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(User.create).not.toHaveBeenCalled();
    });
  });

  describe('loginUser', () => {
    it('should login user with correct credentials', async () => {
      const mockUser = {
        _id: 'userId',
        email: 'test@example.com',
        isVerified: true,
        correctPassword: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(mockUser);

      const result = await AuthService.loginUser('test@example.com', 'password123');

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(mockUser.correctPassword).toHaveBeenCalledWith('password123');
      expect(result).toEqual(mockUser);
    });

    it('should throw error if email or password is missing', async () => {
      await expect(AuthService.loginUser('', 'password123')).rejects.toThrow(AppError);
      await expect(AuthService.loginUser('test@example.com', '')).rejects.toThrow(AppError);
    });

    it('should throw error if credentials are invalid', async () => {
      const mockUser = {
        correctPassword: jest.fn().mockResolvedValue(false),
      };
      User.findOne.mockResolvedValue(mockUser);

      await expect(AuthService.loginUser('test@example.com', 'wrongpass')).rejects.toThrow(
        AppError
      );
    });

    it('should throw error if user is not verified', async () => {
      const mockUser = {
        correctPassword: jest.fn().mockResolvedValue(true),
        isVerified: false,
      };
      User.findOne.mockResolvedValue(mockUser);

      await expect(AuthService.loginUser('test@example.com', 'password123')).rejects.toThrow(
        AppError
      );
    });
  });

  describe('forgotPassword', () => {
    it('should generate password reset token', async () => {
      const mockUser = {
        _id: 'userId',
        email: 'test@example.com',
        createPasswordResetToken: jest.fn().mockReturnValue('resetToken'),
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(mockUser);

      const result = await AuthService.forgotPassword('test@example.com');

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(mockUser.createPasswordResetToken).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalledWith({ validateBeforeSave: false });
      expect(result).toBe('resetToken');
    });

    it('should throw error if user not found', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(AuthService.forgotPassword('nonexistent@example.com')).rejects.toThrow(AppError);
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const hashedToken = 'hashedToken';
      crypto.createHash().update().digest.mockReturnValue(hashedToken);

      const mockUser = {
        _id: 'userId',
        password: 'oldPassword',
        passwordResetToken: hashedToken,
        passwordResetExpires: Date.now() + 3600000, // 1 hour in future
        save: jest.fn().mockResolvedValue(true),
        generateAuthToken: jest.fn().mockReturnValue('newToken'),
      };
      User.findOne.mockResolvedValue(mockUser);

      const result = await AuthService.resetPassword('resetToken', 'newPassword', 'newPassword');

      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
      expect(User.findOne).toHaveBeenCalledWith({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: expect.any(Number) },
      });
      expect(mockUser.password).toBe('newPassword');
      expect(mockUser.passwordResetToken).toBeUndefined();
      expect(mockUser.passwordResetExpires).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.token).toBe('newToken');
    });

    it('should throw error if passwords dont match', async () => {
      await expect(AuthService.resetPassword('token', 'password1', 'password2')).rejects.toThrow(
        AppError
      );
    });

    it('should throw error for invalid token', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        AuthService.resetPassword('invalidToken', 'newPassword', 'newPassword')
      ).rejects.toThrow(AppError);
    });
  });

  describe('updatePassword', () => {
    it('should update password with correct current password', async () => {
      const mockUser = {
        _id: 'userId',
        password: 'oldPassword',
        correctPassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
        generateAuthToken: jest.fn().mockReturnValue('newToken'),
      };
      User.findById.mockResolvedValue(mockUser);

      const result = await AuthService.updatePassword('userId', 'oldPassword', 'newPassword');

      expect(User.findById).toHaveBeenCalledWith('userId');
      expect(mockUser.correctPassword).toHaveBeenCalledWith('oldPassword');
      expect(mockUser.password).toBe('newPassword');
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.token).toBe('newToken');
    });

    it('should throw error for wrong current password', async () => {
      const mockUser = {
        correctPassword: jest.fn().mockResolvedValue(false),
      };
      User.findById.mockResolvedValue(mockUser);

      await expect(
        AuthService.updatePassword('userId', 'wrongPassword', 'newPassword')
      ).rejects.toThrow(AppError);
    });
  });

  describe('verifyEmailToken', () => {
    it('should verify email with valid token', async () => {
      const mockUser = {
        isVerified: false,
        verificationToken: 'validToken',
        verificationTokenExpires: Date.now() + 3600000,
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(mockUser);

      const result = await AuthService.verifyEmailToken('validToken');

      expect(User.findOne).toHaveBeenCalledWith({
        verificationToken: 'validToken',
        verificationTokenExpires: { $gt: expect.any(Number) },
      });
      expect(mockUser.isVerified).toBe(true);
      expect(mockUser.verificationToken).toBeUndefined();
      expect(mockUser.verificationTokenExpires).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should throw error for invalid token', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(AuthService.verifyEmailToken('invalidToken')).rejects.toThrow(AppError);
    });
  });

  // Add similar tests for updateProfile, getAllUsers, getSingleUser, updateUserRole, deleteUser
});
