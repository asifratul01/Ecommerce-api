const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/AppError');
const User = require('../models/User');
const Order = require('../models/Order');
const logger = require('../utils/logger');

// Protect routes - requires authentication
exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(new AppError('User recently changed password! Please log in again.', 401));
    }

    if (!currentUser.isEmailVerified && process.env.REQUIRE_EMAIL_VERIFICATION === 'true') {
      return next(new AppError('Please verify your email address to access this resource.', 403));
    }

    req.user = currentUser;
    res.locals.user = currentUser;
    next();
  } catch (error) {
    logger.error(`Authentication error: ${error}`);
    next(new AppError('Invalid or expired token. Please log in again.', 401));
  }
};

// Role-based authorization
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    try {
      if (!roles.includes(req.user.role)) {
        return next(new AppError('You do not have permission to perform this action', 403));
      }
      next();
    } catch (error) {
      logger.error(`Authorization error: ${error}`);
      next(new AppError('Authorization failed', 403));
    }
  };
};

// Check if user is logged in (for frontend)
exports.isLoggedIn = async (req, res, next) => {
  try {
    if (req.cookies.token) {
      const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
      const currentUser = await User.findById(decoded.id);

      if (!currentUser || currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      res.locals.user = currentUser;
    }
    next();
  } catch (err) {
    next();
  }
};

// Ownership verification middleware
exports.checkOwnership = model => {
  return async (req, res, next) => {
    try {
      const doc = await model.findById(req.params.id);
      if (!doc) {
        return next(new AppError('No document found with that ID', 404));
      }

      if (doc.user.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new AppError('You are not authorized to perform this action', 403));
      }

      next();
    } catch (error) {
      logger.error(`Ownership check error: ${error}`);
      next(new AppError('Authorization failed', 403));
    }
  };
};

// ✅ NEW: Payment visibility control
exports.canViewPayment = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return next();
    }

    req.query.user = req.user._id.toString(); // Only allow filtering payments for own ID
    next();
  } catch (error) {
    logger.error(`canViewPayment error: ${error}`);
    next(new AppError('Payment access control failed', 403));
  }
};

// ✅ NEW: Order cancellation control (within 24 hours only)
exports.canCancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new AppError('You are not authorized to cancel this order', 403));
    }

    const createdAt = new Date(order.createdAt);
    const now = new Date();

    const hoursPassed = (now - createdAt) / (1000 * 60 * 60);
    if (hoursPassed > 24) {
      return next(new AppError('You can only cancel the order within 24 hours', 403));
    }

    req.order = order;
    next();
  } catch (error) {
    logger.error(`canCancelOrder error: ${error}`);
    next(new AppError('Cancel check failed', 500));
  }
};

// CSRF protection middleware
exports.csrfProtection = (req, res, next) => {
  try {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
    if (!csrfToken || csrfToken !== req.csrfToken()) {
      return next(new AppError('Invalid CSRF token', 403));
    }

    next();
  } catch (error) {
    logger.error(`CSRF protection error: ${error}`);
    next(new AppError('CSRF verification failed', 403));
  }
};

// Rate limiting middleware
exports.limitRequests = (windowMs, max, message) => {
  return (req, res, next) => {
    const key = `rate_limit_${req.ip}_${req.route.path}`;
    const current = req.rateLimit[key] || 0;

    if (current >= max) {
      return next(
        new AppError(message || 'Too many requests from this IP, please try again later', 429)
      );
    }

    req.rateLimit[key] = current + 1;
    setTimeout(() => {
      req.rateLimit[key] = Math.max(0, (req.rateLimit[key] || 0) - 1);
    }, windowMs);

    next();
  };
};
