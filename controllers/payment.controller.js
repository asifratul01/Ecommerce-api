const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');
const paymentService = require('../services/payment.service');

exports.processPayment = async (req, res, next) => {
  try {
    const { orderId, paymentMethod, amount, currency, paymentDetails, savePaymentMethod } =
      req.body;

    const result = await paymentService.processPayment({
      orderId,
      userId: req.user.id,
      paymentMethod,
      amount,
      currency,
      paymentDetails,
      savePaymentMethod,
    });

    res.status(200).json({
      success: true,
      message: result.message,
      order: result.order,
      payment: result.payment,
    });
  } catch (error) {
    logger.error(`Payment processing error: ${error}`);
    next(new AppError(error.message, error.statusCode || 500));
  }
};

exports.getPaymentStatus = async (req, res, next) => {
  try {
    const result = await paymentService.getPaymentStatus({
      orderId: req.params.orderId,
      userId: req.user.id,
      userRole: req.user.role,
    });

    res.status(200).json({
      success: true,
      status: result.status,
      payment: result.payment,
      order: result.order,
    });
  } catch (error) {
    logger.error(`Payment status check error: ${error}`);
    next(new AppError(error.message, error.statusCode || 500));
  }
};

exports.processRefund = async (req, res, next) => {
  try {
    const { paymentId, amount, reason } = req.body;

    const result = await paymentService.processRefund({
      paymentId,
      amount,
      reason,
      processedBy: req.user.id,
    });

    res.status(200).json({
      success: true,
      message: result.message,
      refund: result.refund,
      order: result.order,
    });
  } catch (error) {
    logger.error(`Refund processing error: ${error}`);
    next(new AppError(error.message, error.statusCode || 500));
  }
};
