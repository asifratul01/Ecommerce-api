const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller');
const {
  validate,
  addItemSchema,
  updateItemSchema,
  productIdSchema,
} = require('../validations/cart.validation');

// Guest users can access cart routes – no global auth middleware here

// POST /api/v1/cart - Add item to cart
router.post('/', validate(addItemSchema), cartController.addToCart);

// GET /api/v1/cart - Get cart contents
router.get('/', cartController.getCart);

// PUT /api/v1/cart/:productId - Update cart item quantity
router.put(
  '/:productId',
  validate(productIdSchema),
  validate(updateItemSchema),
  cartController.updateCartItem
);

// DELETE /api/v1/cart/:productId - Remove item from cart
router.delete('/:productId', validate(productIdSchema), cartController.removeFromCart);

// DELETE /api/v1/cart - Clear the entire cart
router.delete('/', cartController.clearCart);

// POST /api/v1/cart/merge - Merge guest cart with user cart
router.post('/merge', cartController.mergeCarts);

module.exports = router;
