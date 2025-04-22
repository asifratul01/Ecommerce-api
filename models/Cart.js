const mongoose = require('mongoose');
const { AppError } = require('../utils/AppError');

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'A cart item must belong to a product'],
  },
  name: {
    type: String,
    required: [true, 'A cart item must have a name'],
  },
  quantity: {
    type: Number,
    required: [true, 'A cart item must have a quantity'],
    min: [1, 'Quantity must be at least 1'],
  },
  priceAtAddition: {
    type: Number,
    required: [true, 'A cart item must have a price'],
    min: [0.01, 'Price must be at least 0.01'],
  },
  image: {
    type: String,
    default: '',
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  sessionId: {
    type: String,
    index: true,
  },
  items: [cartItemSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt timestamp on save
cartSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Validate product exists and has sufficient stock
cartSchema.pre('save', async function (next) {
  try {
    for (const item of this.items) {
      const product = await mongoose.model('Product').findById(item.productId);

      if (!product) {
        throw new AppError(`Product ${item.productId} not found`, 404);
      }

      if (product.stock < item.quantity) {
        throw new AppError(
          `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
          400
        );
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Recalculate cart totals as a virtual property
cartSchema.virtual('total').get(function () {
  return this.items.reduce((total, item) => total + item.priceAtAddition * item.quantity, 0);
});

// Recalculate item count as a virtual property
cartSchema.virtual('itemCount').get(function () {
  return this.items.reduce((count, item) => count + item.quantity, 0);
});

// Add instance method to find item by productId
cartSchema.methods.findItem = function (productId) {
  return this.items.find(item => item.productId.toString() === productId.toString());
};

// Add instance method to update item quantity
cartSchema.methods.updateItemQuantity = function (productId, newQuantity) {
  const item = this.findItem(productId);
  if (item) {
    item.quantity = newQuantity;
  }
  return item;
};

// Add instance method to remove item
cartSchema.methods.removeItem = function (productId) {
  this.items = this.items.filter(item => item.productId.toString() !== productId.toString());
  return this;
};

// Static method to find cart by user or session
cartSchema.statics.findByUserOrSession = async function (userId, sessionId) {
  if (userId) {
    return this.findOne({ userId });
  } else if (sessionId) {
    return this.findOne({ sessionId });
  }
  return null;
};

// Static method to merge carts
cartSchema.statics.mergeCarts = async function (userCart, guestCart) {
  if (!guestCart) return userCart;

  for (const guestItem of guestCart.items) {
    const existingItem = userCart.items.find(item => item.productId.equals(guestItem.productId));

    if (existingItem) {
      existingItem.quantity += guestItem.quantity;
    } else {
      userCart.items.push(guestItem);
    }
  }

  await userCart.save();
  await guestCart.remove();

  return userCart;
};

// Ensure virtuals are included in toJSON output
cartSchema.set('toJSON', { virtuals: true });
cartSchema.set('toObject', { virtuals: true });

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
