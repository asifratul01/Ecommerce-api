const { AppError } = require('../utils/AppError'); // Adjusted import
const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log unexpected errors
  if (err.statusCode >= 500) {
    logger.error(`[${req.requestTime}] ${err.stack}`);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    err = new AppError('Invalid token. Please log in again!', 401);
  }
  if (err.name === 'TokenExpiredError') {
    err = new AppError('Your token has expired! Please log in again.', 401);
  }

  // Handle MongoDB errors
  if (err.name === 'CastError') {
    const message = `Invalid ${err.path}: ${err.value}`;
    err = new AppError(message, 400);
  }
  if (err.code === 11000) {
    const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value: ${value}. Please use another value!`;
    err = new AppError(message, 400);
  }
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(el => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    err = new AppError(message, 400);
  }

  // Send response
  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  } else {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }
};
