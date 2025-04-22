require('dotenv').config();
const nodemailer = require('nodemailer');
const path = require('path');
const { AppError } = require('./AppError');
const logger = require('./logger');

let hbs;

class EmailSender {
  constructor() {
    this.transporter = null;
    this.templatesConfigured = false;

    this.init();
  }

  async init() {
    try {
      const hbsModule = await import('nodemailer-express-handlebars');
      hbs = hbsModule.default;

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const retryVerify = async (retries = 5, delayMs = 2000) => {
        for (let i = 0; i < retries; i++) {
          try {
            await this.transporter.verify();
            logger.info('Email transporter is ready to send messages');
            return;
          } catch (error) {
            logger.warn(
              `Email transporter verification failed (attempt ${i + 1}): ${error.message}`
            );
            if (i < retries - 1) {
              await new Promise(res => setTimeout(res, delayMs));
            }
          }
        }
        logger.error('Email transporter verification failed after all retry attempts');
      };

      await retryVerify();
      this.configureTemplates();
    } catch (err) {
      logger.error('Failed to set up email transporter:', err);
    }
  }

  configureTemplates() {
    if (!hbs || !this.transporter) return;

    this.transporter.use(
      'compile',
      hbs({
        viewEngine: {
          extname: '.hbs',
          layoutsDir: path.join(__dirname, '../emails/layouts'),
          defaultLayout: 'main',
          partialsDir: path.join(__dirname, '../emails/partials'),
          helpers: {
            formatPrice: price =>
              new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              }).format(price),
            concat: (...args) => args.slice(0, -1).join(''),
            currentYear: () => new Date().getFullYear(),
            appName: () => process.env.APP_NAME || 'Your App',
            supportEmail: () => process.env.SUPPORT_EMAIL || 'support@example.com',
          },
        },
        viewPath: path.join(__dirname, '../emails/templates'),
        extName: '.hbs',
      })
    );

    this.templatesConfigured = true;
  }

  async sendEmail(options) {
    if (!this.transporter) {
      throw new AppError('Email transporter not ready', 500);
    }

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${options.to}: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error('Email sending failed:', error);
      throw new AppError('Failed to send email', 500);
    }
  }

  async sendTemplateEmail(options) {
    if (!this.transporter) {
      throw new AppError('Email transporter not ready', 500);
    }

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: options.to,
      subject: options.subject,
      template: options.template,
      context: {
        ...options.context,
        frontendUrl: process.env.FRONTEND_URL,
      },
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Templated email sent to ${options.to}: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error('Templated email sending failed:', error);
      throw new AppError('Failed to send templated email', 500);
    }
  }

  async sendVerificationEmail(to, token, name) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    return this.sendTemplateEmail({
      to,
      subject: 'Verify Your Email Address',
      template: 'verifyEmail',
      context: {
        name,
        verificationUrl,
      },
    });
  }

  async sendPasswordResetEmail(to, token, name) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    return this.sendTemplateEmail({
      to,
      subject: 'Password Reset Request',
      template: 'passwordReset',
      context: {
        name,
        resetUrl,
        expiryHours: process.env.PASSWORD_RESET_EXPIRY_HOURS || 24,
      },
    });
  }

  async sendOrderConfirmationEmail(to, order, name) {
    return this.sendTemplateEmail({
      to,
      subject: `Order Confirmation #${order.orderNumber}`,
      template: 'orderConfirmation',
      context: {
        name,
        order: {
          ...order,
          formattedDate: new Date(order.createdAt).toLocaleDateString(),
        },
      },
    });
  }
}

module.exports = new EmailSender();
