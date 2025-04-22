const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');
const Product = require('../models/Product');
const Order = require('../models/Order');

/**
 * Role Check Middleware
 * Provides flexible role-based access control and ownership checks
 */

// ✅ Basic role verification
exports.requireRoles = (...roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }

      if (!roles.includes(req.user.role)) {
        logger.warn(
          `Unauthorized role access: User ${req.user.id} with role ${req.user.role} tried ${req.method} ${req.originalUrl}`
        );
        return next(new AppError('You do not have permission to perform this action', 403));
      }

      next();
    } catch (error) {
      logger.error(`Role check error: ${error}`);
      next(new AppError('Authorization failed', 500));
    }
  };
};

// ✅ Ownership verification (works with any model)
exports.checkOwnership = (model, idParam = 'id') => {
  return async (req, res, next) => {
    try {
      if (req.user.role === 'admin') return next();

      const resourceId = req.params[idParam];
      const resource = await model.findById(resourceId);

      if (!resource) {
        return next(new AppError('Resource not found', 404));
      }

      const ownerId = resource.user?._id || resource.user;

      if (!ownerId || ownerId.toString() !== req.user.id) {
        logger.warn(
          `Ownership denied: User ${req.user.id} tried accessing ${model.modelName} ${resource._id}`
        );
        return next(new AppError('You can only access your own resources', 403));
      }

      next();
    } catch (error) {
      logger.error(`Ownership check error: ${error}`);
      next(new AppError('Authorization failed', 500));
    }
  };
};

// ✅ Permission checker (if using permission system)
exports.checkPermission = permission => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }

      if (req.user.role === 'admin') return next();

      const userPermissions = req.user.permissions || [];

      if (!userPermissions.includes(permission)) {
        logger.warn(`Permission denied: User ${req.user.id} lacks "${permission}"`);
        return next(new AppError('Insufficient permissions', 403));
      }

      next();
    } catch (error) {
      logger.error(`Permission check error: ${error}`);
      next(new AppError('Authorization failed', 500));
    }
  };
};

// ✅ Fixed role guards
exports.sellerOnly = (req, res, next) => {
  if (req.user.role !== 'seller') {
    return next(new AppError('Only sellers can access this', 403));
  }
  next();
};

exports.customerOnly = (req, res, next) => {
  if (req.user.role !== 'customer') {
    return next(new AppError('Only customers can access this', 403));
  }
  next();
};

// ✅ Composite middleware for product management
exports.productManagement = [
  exports.requireRoles('admin', 'seller'),
  exports.checkOwnership(Product, 'productId'),
];

// ✅ Composite middleware for order management
exports.orderManagement = [
  exports.requireRoles('admin', 'customer'),
  async (req, res, next) => {
    if (req.user.role === 'customer') {
      return exports.checkOwnership(Order, 'orderId')(req, res, next);
    }
    next();
  },
];

// ✅ NEW: Check if order can be canceled within 24 hours
exports.canCancelOrderWithin24h = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (req.user.role !== 'admin' && order.user.toString() !== req.user.id) {
      return next(new AppError('You are not authorized to cancel this order', 403));
    }

    const hoursPassed = (Date.now() - new Date(order.createdAt)) / (1000 * 60 * 60);
    if (hoursPassed > 24) {
      return next(new AppError('You can only cancel the order within 24 hours', 403));
    }

    req.order = order;
    next();
  } catch (error) {
    logger.error(`Cancel order check failed: ${error}`);
    next(new AppError('Order cancel validation failed', 500));
  }
};

// ✅ NEW: Payment visibility control
exports.canViewOwnPaymentOrAdmin = (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return next(); // Admin sees everything
    }

    req.query.user = req.user._id.toString(); // Filter to own payments only
    next();
  } catch (error) {
    logger.error(`Payment visibility check failed: ${error}`);
    next(new AppError('Payment access control failed', 403));
  }
};
