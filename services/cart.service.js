const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');

class CartService {
  constructor() {
    this.Cart = Cart;
    this.Product = Product;
  }

  async getOrCreateCart(userId, sessionId) {
    let cart;
    if (userId) {
      cart = await this.Cart.findOne({ userId });
      if (!cart) {
        cart = await this.Cart.create({ userId, items: [] });
      }
    } else if (sessionId) {
      cart = await this.Cart.findById(sessionId);
      if (!cart) {
        cart = await this.Cart.create({ items: [] });
      }
    } else {
      cart = await this.Cart.create({ items: [] });
    }
    return cart;
  }

  async getGuestCart(cartId) {
    const cart = await this.Cart.findById(cartId);
    return cart;
  }

  async addItemToCart(userId, sessionId, productId, quantity) {
    if (!productId || !quantity || quantity <= 0) {
      throw new AppError('Invalid product or quantity', 400);
    }

    const product = await this.Product.findById(productId);
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    if (product.stock < quantity) {
      throw new AppError('Insufficient stock available', 400);
    }

    const cart = await this.getOrCreateCart(userId, sessionId);

    const existingItemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      cart.items.push({
        productId,
        quantity,
        priceAtAddition: product.price,
        name: product.name,
        image: product.images[0]?.url || '',
      });
    }

    await cart.save();
    return cart;
  }

  async getCartWithDetails(userId, sessionId) {
    let cart;
    if (userId) {
      cart = await this.Cart.findOne({ userId }).populate(
        'items.productId',
        'name price images stock'
      );
    } else if (sessionId) {
      cart = await this.Cart.findById(sessionId).populate(
        'items.productId',
        'name price images stock'
      );
    }

    if (!cart) {
      return { items: [], total: 0, itemCount: 0 };
    }

    let total = 0;
    const verifiedItems = await Promise.all(
      cart.items.map(async item => {
        const product = await this.Product.findById(item.productId);
        if (!product) return null;

        const quantity = Math.min(item.quantity, product.stock);
        const subtotal = quantity * (item.priceAtAddition || product.price);
        total += subtotal;

        return {
          productId: item.productId,
          name: product.name,
          price: item.priceAtAddition || product.price,
          quantity,
          image: product.images[0]?.url || '',
          stock: product.stock,
          subtotal,
        };
      })
    );

    const filteredItems = verifiedItems.filter(item => item !== null);

    return {
      items: filteredItems,
      total,
      itemCount: filteredItems.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  async updateCartItemQuantity(userId, sessionId, productId, quantity) {
    if (!quantity || quantity < 0) {
      throw new AppError('Invalid quantity', 400);
    }

    const cart = await this.getOrCreateCart(userId, sessionId);
    if (!cart) {
      throw new AppError('Cart not found', 404);
    }

    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

    if (itemIndex === -1) {
      throw new AppError('Item not found in cart', 404);
    }

    const product = await this.Product.findById(productId);
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const newQuantity = Math.min(quantity, product.stock);
    if (newQuantity === 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = newQuantity;
    }

    await cart.save();
    return cart;
  }

  async removeItemFromCart(userId, sessionId, productId) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    if (!cart) {
      throw new AppError('Cart not found', 404);
    }

    cart.items = cart.items.filter(item => item.productId.toString() !== productId);

    await cart.save();
    return cart;
  }

  async clearCart(userId, sessionId) {
    if (userId) {
      await this.Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });
    } else if (sessionId) {
      await this.Cart.findByIdAndUpdate(sessionId, { $set: { items: [] } });
    }
  }

  async mergeCarts(userId, guestCartId) {
    if (!guestCartId) {
      return { message: 'No guest cart to merge' };
    }

    const guestCart = await this.Cart.findById(guestCartId);
    if (!guestCart || guestCart.items.length === 0) {
      return { message: 'Guest cart is empty' };
    }

    let userCart = await this.Cart.findOne({ userId });
    if (!userCart) {
      userCart = await this.Cart.create({
        userId,
        items: guestCart.items,
      });
    } else {
      guestCart.items.forEach(guestItem => {
        const existingItem = userCart.items.find(userItem =>
          userItem.productId.equals(guestItem.productId)
        );

        if (existingItem) {
          existingItem.quantity += guestItem.quantity;
        } else {
          userCart.items.push(guestItem);
        }
      });

      await userCart.save();
    }

    await this.Cart.findByIdAndDelete(guestCartId);

    return {
      message: 'Cart merged successfully',
      cart: userCart,
    };
  }

  // 🆕 New method: Get cart items and total for order creation
  async getCartItemsForOrder(userId, sessionId) {
    const cart = await this.getOrCreateCart(userId, sessionId);

    if (!cart || cart.items.length === 0) {
      throw new AppError('Cart is empty', 400);
    }

    let total = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const product = await this.Product.findById(item.productId);
      if (!product) continue;

      const quantity = Math.min(item.quantity, product.stock);
      const price = item.priceAtAddition || product.price;
      const subtotal = price * quantity;
      total += subtotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        price,
        quantity,
      });
    }

    if (orderItems.length === 0) {
      throw new AppError('No valid items found in cart', 400);
    }

    return { items: orderItems, total };
  }
}

module.exports = new CartService();
