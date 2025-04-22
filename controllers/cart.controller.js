const cartService = require('../services/cart.service');
const orderService = require('../services/order.service'); // ✅ ensure this is included
const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');

// Add item to cart
exports.addToCart = async (req, res, next) => {
  try {
    const { productId, quantity, price, selectedVariants } = req.body;
    const cart = await cartService.addItemToCart(
      req.user?.id,
      req.session?.cartId,
      productId,
      quantity,
      price,
      selectedVariants
    );

    if (!req.user && req.session && !req.session.cartId) {
      req.session.cartId = cart._id;
    }

    res.status(200).json({
      success: true,
      cart,
    });
  } catch (error) {
    logger.error(`Add to cart error: ${error}`);
    next(error);
  }
};

// Get cart contents
exports.getCart = async (req, res, next) => {
  try {
    let cart;

    if (req.user) {
      cart = await cartService.getCartWithDetails(req.user.id);
    } else if (req.session?.cartId) {
      cart = await cartService.getCartWithDetails(null, req.session.cartId);
    } else {
      return next(new AppError('No cart found for this session or user.', 404));
    }

    if (!cart) {
      return res.status(200).json({
        success: true,
        cart: { items: [], total: 0, itemCount: 0 },
      });
    }

    res.status(200).json({
      success: true,
      cart,
    });
  } catch (error) {
    logger.error(`Get cart error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Update cart item quantity
exports.updateCartItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    let cart;
    if (req.user) {
      cart = await cartService.updateCartItem(req.user.id, null, productId, quantity);
    } else if (req.session?.cartId) {
      cart = await cartService.updateCartItem(null, req.session.cartId, productId, quantity);
    } else {
      return next(new AppError('Cart not found', 404));
    }

    res.status(200).json({
      success: true,
      cart,
    });
  } catch (error) {
    logger.error(`Update cart error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Remove item from cart
exports.removeFromCart = async (req, res, next) => {
  try {
    const { productId } = req.params;

    let cart;
    if (req.user) {
      cart = await cartService.removeItemFromCart(req.user.id, null, productId);
    } else if (req.session?.cartId) {
      cart = await cartService.removeItemFromCart(null, req.session.cartId, productId);
    } else {
      return next(new AppError('Cart not found', 404));
    }

    res.status(200).json({
      success: true,
      cart,
    });
  } catch (error) {
    logger.error(`Remove from cart error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Clear cart
exports.clearCart = async (req, res, next) => {
  try {
    if (req.user) {
      await cartService.clearCart(req.user.id);
    } else if (req.session?.cartId) {
      await cartService.clearCart(null, req.session.cartId);
    }

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
    });
  } catch (error) {
    logger.error(`Clear cart error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Merge guest cart with user cart after login
exports.mergeCarts = async (req, res, next) => {
  try {
    if (!req.session?.cartId) {
      return res.status(200).json({
        success: true,
        message: 'No guest cart to merge',
      });
    }

    const result = await cartService.mergeCarts(req.user.id, req.session.cartId);

    // Always remove guest cart ID after merge
    delete req.session.cartId;

    res.status(200).json({
      success: true,
      message: result.message,
      cart: result.cart,
    });
  } catch (error) {
    logger.error(`Merge cart error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// ✅ Place Order from Cart (updated with getCartItemsForOrder)
exports.placeOrderFromCart = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('You must be logged in to place an order', 401));
    }

    const { items, total } = await cartService.getCartItemsForOrder(req.user.id);
    if (!items || items.length === 0) {
      return next(new AppError('Your cart is empty', 400));
    }

    const order = await orderService.createOrderFromCart(req.user.id, { items, total });

    await cartService.clearCart(req.user.id);

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order,
    });
  } catch (error) {
    logger.error(`Place order from cart error: ${error}`);
    next(new AppError(error.message, 500));
  }
};
