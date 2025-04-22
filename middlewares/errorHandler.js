const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Custom error handling middleware for Express
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const errorHandler = (err, req, res, next) => {
  // Default values for unexpected errors
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Handle specific error types
  let error = { ...err };
  error.message = err.message;

  // Log the error with contextual information
  logger.error({
    message: error.message,
    statusCode: error.statusCode,
    path: req.originalUrl,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    user: req.user ? req.user.id : 'anonymous',
    body: process.env.NODE_ENV === 'development' ? req.body : undefined,
  });

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    error = new AppError(`Invalid input data: ${messages.join('. ')}`, 400);
  }

  // Handle Mongoose duplicate field errors (e.g., duplicate email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = new AppError(`${field} already exists. Please use another value.`, 400);
  }

  // Handle invalid JWT tokens
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token. Please log in again!', 401);
  }

  // Handle expired JWT tokens
  if (err.name === 'TokenExpiredError') {
    error = new AppError('Your token has expired! Please log in again.', 401);
  }

  // Handle CastError (invalid MongoDB ID)
  if (err.name === 'CastError') {
    error = new AppError(`Invalid ${err.path}: ${err.value}`, 400);
  }

  // E-commerce specific error handling
  if (err.name === 'InventoryError') {
    error = new AppError(err.message, 400);
  }

  if (err.name === 'PaymentError') {
    error = new AppError(err.message, 402); // 402 Payment Required
  }

  // Development vs Production error response
  if (process.env.NODE_ENV === 'development') {
    res.status(error.statusCode).json({
      status: error.status,
      message: error.message,
      error: error,
      stack: error.stack,
    });
  } else {
    // Production response (don't leak error details)
    if (error.isOperational) {
      // Trusted operational errors: send message to client
      res.status(error.statusCode).json({
        status: error.status,
        message: error.message,
      });
    } else {
      // Programming or unknown errors: don't leak details
      logger.error('UNHANDLED ERROR:', error);
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong!',
      });
    }
  }
};

module.exports = errorHandler;
