const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const logger = require('../utils/logger');
const { AppError } = require('../utils/AppError');

class EmailService {
  constructor() {
    // Initialize transporter based on environment
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Verify connection configuration
    this.transporter.verify(error => {
      if (error) {
        logger.error(`Email transporter verification failed: ${error}`);
      } else {
        logger.info('Email server is ready to take our messages');
      }
    });
  }

  /**
   * Render email template using EJS
   * @param {string} templateName - Name of the template file (without extension)
   * @param {object} data - Data to pass to the template
   * @returns {Promise<string>} - Rendered HTML content
   */
  async renderTemplate(templateName, data) {
    try {
      const templatePath = path.join(__dirname, `../views/emails/${templateName}.ejs`);
      return await ejs.renderFile(templatePath, data);
    } catch (error) {
      logger.error(`Failed to render email template ${templateName}: ${error}`);
      throw new AppError('Failed to render email template', 500);
    }
  }

  /**
   * Send email
   * @param {object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML content
   * @param {string} [options.text] - Plain text content (optional)
   * @returns {Promise<object>} - Nodemailer response
   */
  async sendEmail(options) {
    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this._generateTextFromHtml(options.html),
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${options.to}: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error(`Failed to send email to ${options.to}: ${error}`);
      throw new AppError('Failed to send email', 500);
    }
  }

  /**
   * Generate plain text version from HTML (simple implementation)
   * @private
   * @param {string} html - HTML content
   * @returns {string} - Plain text version
   */
  _generateTextFromHtml(html) {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\n{2,}/g, '\n\n') // Normalize newlines
      .trim();
  }

  // Specific email methods

  /**
   * Send order confirmation email
   * @param {string} email - Recipient email
   * @param {object} order - Order details
   * @returns {Promise<object>}
   */
  async sendOrderConfirmation(email, order) {
    const html = await this.renderTemplate('order-confirmation', { order });
    return this.sendEmail({
      to: email,
      subject: `Your Order Confirmation (#${order.orderNumber})`,
      html,
    });
  }

  /**
   * Send password reset email
   * @param {string} email - Recipient email
   * @param {string} resetToken - Password reset token
   * @param {string} resetUrl - Password reset URL
   * @returns {Promise<object>}
   */
  async sendPasswordReset(email, resetToken, resetUrl) {
    const html = await this.renderTemplate('password-reset', {
      resetUrl: `${resetUrl}?token=${resetToken}`,
    });
    return this.sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html,
    });
  }

  /**
   * Send account verification email
   * @param {string} email - Recipient email
   * @param {string} verificationToken - Verification token
   * @param {string} verificationUrl - Verification URL
   * @returns {Promise<object>}
   */
  async sendVerificationEmail(email, verificationToken, verificationUrl) {
    const html = await this.renderTemplate('email-verification', {
      verificationUrl: `${verificationUrl}?token=${verificationToken}`,
    });
    return this.sendEmail({
      to: email,
      subject: 'Verify Your Email Address',
      html,
    });
  }

  /**
   * Send welcome email to new users
   * @param {string} email - Recipient email
   * @param {string} name - User's name
   * @returns {Promise<object>}
   */
  async sendWelcomeEmail(email, name) {
    const html = await this.renderTemplate('welcome', { name });
    return this.sendEmail({
      to: email,
      subject: 'Welcome to Our Platform!',
      html,
    });
  }
}

module.exports = new EmailService();
