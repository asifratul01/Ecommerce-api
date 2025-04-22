const Order = require('../models/Order');
const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');

class PaymentService {
  constructor() {
    // Mock payment processor
    this.mockPaymentProcessor = {
      processPayment: async (order, paymentMethod) => {
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 80% success rate for demo purposes
        const isSuccess = Math.random() > 0.2;

        return {
          success: isSuccess,
          transactionId: `mock_${Date.now()}`,
          message: isSuccess ? 'Payment processed successfully' : 'Payment failed - card declined',
        };
      },
    };
  }

  /**
   * Process payment for an order
   */
  async processPayment(orderId, userId, paymentMethod) {
    // Validate input
    if (!orderId || !paymentMethod) {
      throw new AppError('Order ID and payment method are required', 400);
    }

    // Get order
    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Verify ownership
    if (order.user?.toString() !== userId) {
      throw new AppError('Not authorized to pay for this order', 403);
    }

    // Check if already paid
    if (order.paymentInfo.status === 'paid') {
      throw new AppError('Order already paid', 400);
    }

    // Process payment
    const paymentResult = await this.mockPaymentProcessor.processPayment(order, paymentMethod);

    if (!paymentResult.success) {
      throw new AppError(paymentResult.message, 402);
    }

    // Update order status
    order.paymentInfo = {
      id: paymentResult.transactionId,
      status: 'paid',
      method: paymentMethod.type || 'card',
    };
    order.orderStatus = 'processing';
    await order.save();

    return {
      message: paymentResult.message,
      order,
    };
  }

  /**
   * Get payment status for an order
   */
  async getPaymentStatus(orderId, userId, userRole) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Verify ownership
    if (order.user?.toString() !== userId && userRole !== 'admin') {
      throw new AppError('Not authorized to view this payment', 403);
    }

    return {
      paymentStatus: order.paymentInfo.status,
      paymentDetails: order.paymentInfo,
    };
  }

  /**
   * Process refund for an order (Admin only)
   */
  async processRefund(orderId) {
    const order = await Order.findById(orderId);

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Check refund eligibility
    if (order.paymentInfo.status !== 'paid') {
      throw new AppError('Only paid orders can be refunded', 400);
    }

    if (order.orderStatus === 'refunded') {
      throw new AppError('Order already refunded', 400);
    }

    // Simulate refund processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update order
    order.orderStatus = 'refunded';
    order.paymentInfo.status = 'refunded';
    await order.save();

    return {
      message: 'Refund processed successfully',
      order,
    };
  }
}

module.exports = new PaymentService();
