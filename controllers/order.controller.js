const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');
const orderService = require('../services/order.service');
const Order = require('../models/Order');

// ✅ Create new order (Confirm with ≥ 50% payment)
exports.createOrder = async (req, res, next) => {
  try {
    const {
      cartId,
      shippingAddress,
      billingAddress,
      paymentMethod,
      paymentDetails,
      notes,
      useShippingAsBilling,
    } = req.body;

    const order = await orderService.createOrder({
      userId: req.user?.id,
      cartId,
      shippingAddress,
      billingAddress: useShippingAsBilling ? shippingAddress : billingAddress,
      paymentInfo: {
        method: paymentMethod,
        details: paymentDetails,
      },
      notes,
      protocol: req.protocol,
      host: req.get('host'),
    });

    res.status(201).json({
      success: true,
      order,
    });
  } catch (error) {
    logger.error(`Create order error: ${error}`);
    next(new AppError(error.message, error.statusCode || 500));
  }
};

// ✅ Cancel an order within 24hrs (with 2% refund deduction)
exports.cancelOrder = async (req, res, next) => {
  try {
    const result = await orderService.cancelOrder(req.user.id, req.params.orderId);

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    logger.error(`Cancel order error: ${error}`);
    next(new AppError(error.message, error.statusCode || 500));
  }
};

// ✅ Complete payment (final 50% during delivery)
exports.completePayment = async (req, res, next) => {
  try {
    const result = await orderService.completePayment(req.user.id, req.params.orderId);

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    logger.error(`Complete payment error: ${error}`);
    next(new AppError(error.message, error.statusCode || 500));
  }
};

// ✅ Get single order (admin or owner only)
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('paymentRef')
      .populate('user', 'name email');

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (req.user.role !== 'admin' && order.user._id.toString() !== req.user.id) {
      return next(new AppError('You are not authorized to view this order', 403));
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    logger.error(`Get single order error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// ✅ Get logged-in user's orders
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await orderService.getUserOrders(req.user.id);
    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    logger.error(`Get my orders error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// ✅ Get all orders (admin only)
exports.getAllOrders = async (req, res, next) => {
  try {
    const { orders, totalSales } = await orderService.getAllOrders();
    res.status(200).json({
      success: true,
      count: orders.length,
      totalSales,
      orders,
    });
  } catch (error) {
    logger.error(`Get all orders error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// ✅ Update order status (admin only)
exports.updateOrder = async (req, res, next) => {
  try {
    const order = await orderService.updateOrderStatus({
      orderId: req.params.id,
      status: req.body.status,
      protocol: req.protocol,
      host: req.get('host'),
    });

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    logger.error(`Update order error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// ✅ Delete order (admin only)
exports.deleteOrder = async (req, res, next) => {
  try {
    await orderService.deleteOrder(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error) {
    logger.error(`Delete order error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// ✅ Get monthly sales (admin only)
exports.getMonthlySales = async (req, res, next) => {
  try {
    const monthlySales = await orderService.getMonthlySales();
    res.status(200).json({
      success: true,
      monthlySales,
    });
  } catch (error) {
    logger.error(`Get monthly sales error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// ✅ Get payments — admin gets all, user gets own only
exports.getPayments = async (req, res, next) => {
  try {
    const payments = await orderService.getPayments(req.user);
    res.status(200).json({
      success: true,
      payments,
    });
  } catch (error) {
    logger.error(`Get payments error: ${error}`);
    next(new AppError(error.message, 500));
  }
};
