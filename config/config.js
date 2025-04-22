const { existsSync, readFileSync } = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Load environment variables
require('dotenv').config();

const ENV = process.env.NODE_ENV || 'development';

const loadConfig = () => {
  // Check for required environment variables
  const requiredVars = [
    'MONGO_URI',
    'JWT_SECRET',
    'JWT_EXPIRE',
    'COOKIE_EXPIRE',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_EMAIL',
    'SMTP_PASSWORD',
    'FRONTEND_URL',
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }

  // Try to load config file if exists
  const configPath = path.join(__dirname, `${ENV}.config.json`);
  let fileConfig = {};

  if (existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch (err) {
      logger.error(`Error reading config file: ${err}`);
    }
  }

  // Configuration object
  const config = {
    env: ENV,
    port: process.env.PORT || 4000,
    mongo: {
      uri: process.env.MONGO_URI,
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        autoIndex: ENV !== 'production',
      },
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRE || '30d',
      cookieExpire: parseInt(process.env.COOKIE_EXPIRE) || 30,
      issuer: process.env.JWT_ISSUER || 'ecommerce-api',
      audience: process.env.JWT_AUDIENCE || 'ecommerce-client',
    },
    email: {
      smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASSWORD,
        },
      },
      from: process.env.SMTP_FROM || `E-Commerce <${process.env.SMTP_EMAIL}>`,
    },
    client: {
      url: process.env.FRONTEND_URL,
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: ENV === 'development' ? 1000 : 100, // Limit each IP to 100 requests per window in production
    },
    ...fileConfig, // Merge with file-based config
  };

  // Validate email config
  if (!config.email.smtp.host || !config.email.smtp.port) {
    logger.warn('SMTP configuration incomplete - email functionality will be disabled');
    config.email.enabled = false;
  } else {
    config.email.enabled = true;
  }

  return config;
};

module.exports = loadConfig();
