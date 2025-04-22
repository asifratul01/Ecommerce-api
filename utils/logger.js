const winston = require('winston');
const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, colorize, json } = format;
const path = require('path');
const fs = require('fs');
const DailyRotateFile = require('winston-daily-rotate-file');
const { AppError } = require('./AppError'); // Import AppError classes

// Ensure log directory exists
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Base logger configuration
const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    process.env.NODE_ENV === 'production' ? json() : combine(colorize(), logFormat)
  ),
  transports: [
    // Console transport for development
    new transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
    // Daily rotating file transport for errors
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    }),
    // Combined log for all levels
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    }),
  ],
  exitOnError: false,
});

// Custom stream for Express morgan middleware
logger.morganStream = {
  write: message => {
    logger.info(message.trim());
  },
};

/**
 * Logs API request details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} error - Optional error object
 */
logger.logApiRequest = (req, res, error = null) => {
  const meta = {
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    responseTime: res.responseTime,
    ip: req.ip,
    user: req.user ? req.user.id : 'anonymous',
  };

  if (error) {
    // If the error is an instance of AppError or its subclasses, log the specific details
    if (error instanceof AppError) {
      logger.error(`${req.method} ${req.originalUrl}`, {
        ...meta,
        error: {
          message: error.message,
          statusCode: error.statusCode,
          status: error.status,
          stack: error.stack,
        },
      });
    } else {
      // Log generic errors
      logger.error(`${req.method} ${req.originalUrl}`, {
        ...meta,
        error: error.stack || error.message,
      });
    }
  } else {
    logger.info(`${req.method} ${req.originalUrl}`, meta);
  }
};

/**
 * Logs database query
 * @param {string} collection - Collection name
 * @param {string} operation - Operation type
 * @param {Object} query - Query object
 * @param {number} duration - Execution time in ms
 */
logger.logDatabaseQuery = (collection, operation, query, duration) => {
  logger.debug(`DB ${operation} on ${collection}`, {
    collection,
    operation,
    query,
    duration: `${duration}ms`,
  });
};

/**
 * Logs unhandled exceptions and rejections
 */
process.on('unhandledRejection', reason => {
  throw reason;
});

process.on('uncaughtException', error => {
  if (error instanceof AppError) {
    logger.error('Uncaught AppError:', {
      message: error.message,
      statusCode: error.statusCode,
      status: error.status,
      stack: error.stack,
    });
  } else {
    logger.error('Uncaught Exception:', error);
  }
  process.exit(1);
});

module.exports = logger;
