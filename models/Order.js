const mongoose = require('mongoose');
const { AppError, InventoryError } = require('../utils/AppError');

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Order item must belong to a product'],
    },
    name: {
      type: String,
      required: [true, 'Order item must have a name'],
    },
    quantity: {
      type: Number,
      required: [true, 'Order item must have a quantity'],
      min: [1, 'Quantity must be at least 1'],
    },
    price: {
      type: Number,
      required: [true, 'Order item must have a price'],
      min: [0.01, 'Price must be at least 0.01'],
    },
    image: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const shippingInfoSchema = new mongoose.Schema(
  {
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true, default: 'US' },
    postalCode: { type: String, required: true },
    phone: { type: String, required: true },
  },
  { _id: false }
);

const paymentInfoSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    method: {
      type: String,
      required: true,
      enum: ['card', 'paypal', 'cod'],
    },
    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid', 'refunded'],
      default: 'unpaid',
    },
    amount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    orderNumber: {
      type: String,
    },
    orderItems: [orderItemSchema],
    shippingInfo: shippingInfoSchema,
    paymentInfo: paymentInfoSchema,

    itemsPrice: { type: Number, required: true, default: 0.0 },
    taxPrice: { type: Number, required: true, default: 0.0 },
    shippingPrice: { type: Number, required: true, default: 0.0 },
    totalPrice: { type: Number, required: true, default: 0.0 },

    paymentDue: { type: Number, default: 0.0 },
    orderStatus: {
      type: String,
      enum: ['processing', 'shipped', 'delivered', 'cancelled', 'returned'],
      default: 'processing',
    },

    isConfirmed: { type: Boolean, default: false }, // ✅ newly added
    paymentRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    }, // ✅ optional field

    isDelivered: { type: Boolean, default: false },
    deliveredAt: { type: Date },

    isCanceled: { type: Boolean, default: false },
    canceledAt: { type: Date },

    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ✅ Unique index for order number
orderSchema.index({ orderNumber: 1 }, { unique: true, sparse: true });

// 🔢 Auto generate order number
orderSchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  try {
    const count = await this.constructor.countDocuments();
    this.orderNumber = `ORD-${Date.now()}-${count + 1}`;
    next();
  } catch (err) {
    next(new AppError('Failed to generate order number', 500));
  }
});

// 📉 Reduce product stock on order creation
orderSchema.pre('save', async function (next) {
  if (!this.isModified('orderItems') || !this.isNew) return next();
  try {
    await Promise.all(
      this.orderItems.map(async item => {
        const product = await mongoose.model('Product').findById(item.product);
        if (!product) throw new AppError(`Product ${item.product} not found`, 404);
        if (product.stock < item.quantity)
          throw new InventoryError(item.product, item.quantity, product.stock);
        product.stock -= item.quantity;
        product.sold += item.quantity;
        await product.save({ validateBeforeSave: false });
      })
    );
    next();
  } catch (err) {
    next(err);
  }
});

// ♻️ Restore product stock on cancel
orderSchema.pre('findOneAndUpdate', async function (next) {
  const order = await this.model.findOne(this.getQuery());
  const update = this.getUpdate();
  if (!order) return next(new AppError('Order not found', 404));
  if (update.orderStatus === 'cancelled' && order.orderStatus !== 'cancelled') {
    try {
      await Promise.all(
        order.orderItems.map(async item => {
          const product = await mongoose.model('Product').findById(item.product);
          if (!product) throw new AppError(`Product ${item.product} not found`, 404);
          product.stock += item.quantity;
          product.sold -= item.quantity;
          await product.save({ validateBeforeSave: false });
        })
      );
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

// 📦 Order summary virtual
orderSchema.virtual('summary').get(function () {
  return {
    items: this.orderItems.length,
    total: this.totalPrice,
    status: this.orderStatus,
  };
});

// ✅ Virtual field: canBeCancelled
orderSchema.virtual('canBeCancelled').get(function () {
  const now = new Date();
  const hoursDiff = (now - this.createdAt) / (1000 * 60 * 60);
  return hoursDiff <= 24 && !this.isCanceled && !this.isDelivered;
});

// 📊 Monthly sales stats
orderSchema.statics.getMonthlySales = async function () {
  try {
    return await this.aggregate([
      { $match: { orderStatus: 'delivered' } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          totalSales: { $sum: '$totalPrice' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          totalSales: 1,
          count: 1,
        },
      },
    ]);
  } catch (err) {
    throw new AppError('Failed to fetch monthly sales', 500);
  }
};

// 👤 Auto populate user and product info
orderSchema.pre(/^find/, function (next) {
  this.populate({ path: 'user', select: 'name email' }).populate({
    path: 'orderItems.product',
    select: 'name images',
  });
  next();
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
