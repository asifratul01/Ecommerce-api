const mongoose = require('mongoose');
const { AppError } = require('../utils/AppError');

const paymentDetailsSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: [true, 'Transaction ID is required'],
      unique: true, // Unique ensures the index
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be at least 0.01'],
    },
    currency: {
      type: String,
      default: 'USD',
      enum: {
        values: ['USD', 'EUR', 'GBP', 'JPY'],
        message: 'Currency must be USD, EUR, GBP, or JPY',
      },
    },
    method: {
      type: String,
      required: [true, 'Payment method is required'],
      enum: {
        values: ['card', 'paypal', 'bank_transfer', 'crypto'],
        message: 'Payment method must be card, paypal, bank_transfer, or crypto',
      },
    },
    cardLast4: {
      type: String,
      validate: {
        validator: function (v) {
          return !this.method === 'card' || /^\d{4}$/.test(v);
        },
        message: 'Last 4 digits must be 4 numbers',
      },
    },
    paymentGateway: {
      type: String,
      default: 'mock_processor',
      enum: ['stripe', 'paypal', 'mock_processor', 'other'],
    },
    fee: {
      type: Number,
      default: 0,
    },
  },
  { _id: false, timestamps: true }
);

const refundDetailsSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: [true, 'Refund amount is required'],
    },
    reason: {
      type: String,
      enum: {
        values: ['requested_by_customer', 'duplicate', 'fraudulent', 'other'],
        message: 'Invalid refund reason',
      },
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['pending', 'processed', 'failed'],
      default: 'pending',
    },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Payment must belong to an order'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Payment must belong to a user'],
    },
    paymentDetails: paymentDetailsSchema,
    refundDetails: refundDetailsSchema,
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: ['pending', 'processing', 'paid', 'failed', 'refunded', 'disputed'],
        message: 'Invalid payment status',
      },
      default: 'pending',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance, removing duplicates
paymentSchema.index({ order: 1 });
paymentSchema.index({ user: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });

// Pre-save hook to sync with Order model
paymentSchema.pre('save', async function (next) {
  if (this.isModified('status')) {
    try {
      const Order = mongoose.model('Order');
      await Order.findByIdAndUpdate(this.order, {
        'paymentInfo.status': this.status,
        orderStatus:
          this.status === 'paid'
            ? 'processing'
            : this.status === 'refunded'
              ? 'refunded'
              : this.orderStatus,
      });
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// Static method to process payment
paymentSchema.statics.processPayment = async function (orderId, paymentMethod) {
  const Order = mongoose.model('Order');
  const order = await Order.findById(orderId);

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Create payment record
  const payment = await this.create({
    order: orderId,
    user: order.user,
    paymentDetails: {
      transactionId: `mock_${Date.now()}`,
      amount: order.totalPrice,
      currency: 'USD',
      method: paymentMethod.type || 'card',
      paymentGateway: 'mock_processor',
    },
    status: 'processing',
  });

  // Simulate payment processing
  await new Promise(resolve => setTimeout(resolve, 1500));

  // 80% success rate for demo
  const isSuccess = Math.random() > 0.2;

  if (isSuccess) {
    payment.status = 'paid';
    await payment.save();
    return {
      success: true,
      payment,
      message: 'Payment processed successfully',
    };
  } else {
    payment.status = 'failed';
    await payment.save();
    throw new AppError('Payment failed - card declined', 402);
  }
};

// Static method to process refund
paymentSchema.statics.processRefund = async function (paymentId) {
  const payment = await this.findById(paymentId);

  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  if (payment.status !== 'paid') {
    throw new AppError('Only paid payments can be refunded', 400);
  }

  if (payment.status === 'refunded') {
    throw new AppError('Payment already refunded', 400);
  }

  // Simulate refund processing
  await new Promise(resolve => setTimeout(resolve, 1000));

  payment.status = 'refunded';
  payment.refundDetails = {
    amount: payment.paymentDetails.amount,
    reason: 'requested_by_customer',
    status: 'processed',
  };

  await payment.save();
  return payment;
};

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
