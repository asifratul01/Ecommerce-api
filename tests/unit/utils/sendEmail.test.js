const emailSender = require('../../../server/utils/sendEmail');
const nodemailer = require('nodemailer');
const AppError = require('../../../server/utils/AppError');
const logger = require('../../../server/utils/logger');

// Mock nodemailer
jest.mock('nodemailer');
jest.mock('../../../server/utils/logger');

describe('EmailSender', () => {
  const mockSendMail = jest.fn();
  const mockTransporter = {
    use: jest.fn(),
    sendMail: mockSendMail,
  };

  beforeAll(() => {
    nodemailer.createTransport.mockReturnValue(mockTransporter);
    process.env.EMAIL_FROM_NAME = 'Test Shop';
    process.env.EMAIL_FROM_ADDRESS = 'noreply@testshop.com';
    process.env.FRONTEND_URL = 'https://testshop.com';
    process.env.SUPPORT_EMAIL = 'support@testshop.com';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail.mockReset();
  });

  describe('sendEmail', () => {
    it('should send basic email successfully', async () => {
      mockSendMail.mockResolvedValueOnce({ messageId: 'test123' });

      const result = await emailSender.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test content',
      });

      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"Test Shop" <noreply@testshop.com>',
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test content',
        html: undefined,
      });
      expect(logger.info).toHaveBeenCalledWith('Email sent to test@example.com: test123');
      expect(result.messageId).toBe('test123');
    });

    it('should handle email sending failure', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));

      await expect(
        emailSender.sendEmail({
          to: 'test@example.com',
          subject: 'Test Subject',
          text: 'Test content',
        })
      ).rejects.toThrow(AppError);

      expect(logger.error).toHaveBeenCalledWith('Email sending failed:', expect.any(Error));
    });
  });

  describe('sendTemplateEmail', () => {
    it('should send template email successfully', async () => {
      mockSendMail.mockResolvedValueOnce({ messageId: 'template123' });

      const result = await emailSender.sendTemplateEmail({
        to: 'user@example.com',
        subject: 'Template Test',
        template: 'testTemplate',
        context: { name: 'Test User' },
      });

      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"Test Shop" <noreply@testshop.com>',
        to: 'user@example.com',
        subject: 'Template Test',
        template: 'testTemplate',
        context: { name: 'Test User' },
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Templated email sent to user@example.com: template123'
      );
    });
  });

  describe('sendVerificationEmail', () => {
    it('should send verification email with correct context', async () => {
      mockSendMail.mockResolvedValueOnce({ messageId: 'verify123' });

      await emailSender.sendVerificationEmail(
        'newuser@example.com',
        'verificationToken123',
        'John Doe'
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'newuser@example.com',
          subject: 'Verify Your Email Address',
          template: 'verifyEmail',
          context: {
            name: 'John Doe',
            verificationUrl: 'https://testshop.com/verify-email?token=verificationToken123',
            supportEmail: 'support@testshop.com',
          },
        })
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with correct context', async () => {
      mockSendMail.mockResolvedValueOnce({ messageId: 'reset123' });

      await emailSender.sendPasswordResetEmail('user@example.com', 'resetToken456', 'Jane Smith');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Password Reset Request',
          template: 'passwordReset',
          context: {
            name: 'Jane Smith',
            resetUrl: 'https://testshop.com/reset-password?token=resetToken456',
            supportEmail: 'support@testshop.com',
            expiryHours: 24,
          },
        })
      );
    });
  });

  describe('sendOrderConfirmationEmail', () => {
    it('should send order confirmation email', async () => {
      mockSendMail.mockResolvedValueOnce({ messageId: 'order123' });

      const order = {
        orderNumber: 'ORDER123',
        items: [{ name: 'Test Product', quantity: 1, price: 19.99 }],
        total: 19.99,
      };

      await emailSender.sendOrderConfirmationEmail('customer@example.com', order, 'Customer Name');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          subject: 'Order Confirmation #ORDER123',
          template: 'orderConfirmation',
          context: {
            name: 'Customer Name',
            order,
            supportEmail: 'support@testshop.com',
          },
        })
      );
    });
  });
});
