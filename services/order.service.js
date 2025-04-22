const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const { AppError } = require('../utils/AppError');

class OrderService {
  // ✅ Create Order (supporting cart-based or direct)
  async createOrder({
    userId,
    products = [],
    cartId,
    shippingAddress,
    paymentInfo,
    protocol,
    host,
  }) {
    // 🛒 If cartId is provided, build products array from it
    if ((!products || products.length === 0) && cartId) {
      const cart = await Cart.findById(cartId).populate('items.productId');

      if (!cart || cart.items.length === 0) {
        throw new AppError('Cart is empty or not found', 404);
      }

      products = cart.items.map(item => {
        const product = item.productId;
        if (!product || !product.isActive) {
          throw new AppError(`Product not available: ${item.productId?.name || 'Unknown'}`, 400);
        }

        if (product.stock < item.quantity) {
          throw new AppError(
            `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
            400
          );
        }

        return {
          product: product._id,
          name: product.name,
          quantity: item.quantity,
          price: item.priceAtAddition,
        };
      });
    }

    if (!products || products.length === 0) {
      throw new AppError('No products provided', 400);
    }

    // ✅ Calculate total and initial payment
    const totalAmount = products.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const initialPaymentAmount = totalAmount * 0.5;

    // ✅ Create payment entry
    const payment = await Payment.create({
      user: userId,
      amount: initialPaymentAmount,
      status: 'paid',
      type: 'initial',
    });

    // ✅ Create order
    const order = await Order.create({
      user: userId,
      orderItems: products,
      shippingInfo: shippingAddress,
      orderStatus: 'pending',
      isConfirmed: true,
      paymentRef: payment._id,
      paymentInfo: {
        id: payment._id.toString(),
        method: 'card',
        status: 'paid',
        amount: initialPaymentAmount,
        paidAmount: initialPaymentAmount,
      },
      itemsPrice: totalAmount,
      totalPrice: totalAmount,
      paymentDue: totalAmount - initialPaymentAmount,
    });

    // ✅ Update product stock and sold count
    for (const item of products) {
      const product = await Product.findById(item.product);
      if (!product || !product.isActive) {
        throw new AppError(`Product not available: ${product.name || 'Unknown'}`, 400);
      }

      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity, sold: item.quantity },
      });
    }

    // ✅ Link payment to order
    payment.order = order._id;
    await payment.save();

    // ✅ Clear cart if order was created from cart
    if (cartId) {
      await Cart.findByIdAndDelete(cartId);
    }

    return order;
  }

  // ✅ Cancel Order within 24 hours and refund 98%
  async cancelOrder(userId, orderId) {
    const order = await Order.findOne({ _id: orderId, user: userId });

    if (!order) throw new AppError('Order not found', 404);
    if (order.orderStatus === 'cancelled') throw new AppError('Order already cancelled', 400);

    const timeElapsed = Date.now() - new Date(order.createdAt).getTime();
    const hoursElapsed = timeElapsed / (1000 * 60 * 60);

    if (hoursElapsed > 24) {
      throw new AppError('Order cancellation period has expired', 403);
    }

    order.orderStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.isCancelled = true;
    await order.save();

    const refundAmount = order.paymentInfo.amount * 0.98;

    await Payment.create({
      user: userId,
      order: orderId,
      amount: refundAmount,
      status: 'refunded',
      type: 'refund',
    });

    return { message: 'Order cancelled and 98% refunded', refundAmount };
  }

  // ✅ Complete Final Payment (only when delivered)
  async completePayment(userId, orderId) {
    const order = await Order.findOne({ _id: orderId, user: userId });

    if (!order) throw new AppError('Order not found', 404);
    if (order.orderStatus !== 'delivered') throw new AppError('Order not delivered yet', 400);
    if (order.paymentDue === 0) throw new AppError('Already fully paid', 400);

    const remaining = order.paymentDue;

    order.paymentDue = 0;
    order.paymentInfo.paidAmount += remaining;
    await order.save();

    await Payment.create({
      user: userId,
      order: orderId,
      amount: remaining,
      status: 'paid',
      type: 'final',
    });

    return { message: 'Final payment completed', amount: remaining };
  }

  // ✅ Get logged-in user's orders
  async getUserOrders(userId) {
    return await Order.find({ user: userId }).sort({ createdAt: -1 });
  }

  // ✅ Get payments (admin vs user view)
  async getPayments(user) {
    if (user.role === 'admin') {
      return await Payment.find().populate('user order');
    } else {
      return await Payment.find({ user: user._id }).populate('order');
    }
  }

  // ✅ Admin only — get all orders and total sales
  async getAllOrders() {
    const orders = await Order.find().sort({ createdAt: -1 });

    const totalSales = orders.reduce((sum, order) => {
      if (order.paymentDue === 0) {
        return sum + order.totalPrice;
      }
      return sum;
    }, 0);

    return { orders, totalSales };
  }

  // ✅ Admin — update order status
  async updateOrderStatus({ orderId, status }) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);

    order.orderStatus = status;

    if (status === 'delivered') {
      order.deliveredAt = new Date();
    }

    await order.save();
    return order;
  }

  // ✅ Admin — delete order
  async deleteOrder(orderId) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);

    await order.deleteOne();
  }

  // ✅ Admin — monthly sales data
  async getMonthlySales() {
    const monthlySales = await Order.aggregate([
      {
        $match: { paymentDue: 0 },
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          total: { $sum: '$totalPrice' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    return monthlySales;
  }
}

module.exports = new OrderService();
