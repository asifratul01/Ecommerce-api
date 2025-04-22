const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const auth = require('../middlewares/auth');

const {
  validate,
  createProductSchema,
  productIdSchema,
  productQuerySchema,
  createReviewSchema,
  reviewIdSchema,
  updateProductSchema,
} = require('../validations/product.validation');

// Public routes (no authentication required)
router.get('/', validate(productQuerySchema), productController.getAllProducts);
router.get('/:productId', validate(productIdSchema), productController.getProduct);
router.get('/:productId/reviews', validate(productIdSchema), productController.getProductReviews);

// Protected routes (require authentication)
router.use(auth.protect);

// POST /api/products/:productId/reviews - Add product review
router.post(
  '/:productId/reviews',
  validate(productIdSchema),
  validate(createReviewSchema),
  productController.createProductReview
);

// DELETE /api/products/:productId/reviews/:reviewId - Delete review
router.delete(
  '/:productId/reviews/:reviewId',
  validate(productIdSchema),
  validate(reviewIdSchema),
  productController.deleteReview
);

// Get logged-in user's products (for sellers/admins)
router.get('/admin/my-products', productController.getAdminProducts);

// ADMIN ROUTES
router.use(auth.restrictTo('admin'));

// POST /api/products - Create product (Admin)
router.post('/', validate(createProductSchema), productController.createProduct);

// PUT /api/products/:productId - Update product (Admin)
router.put(
  '/:productId',
  validate(productIdSchema),
  validate(updateProductSchema),
  productController.updateProduct
);

// DELETE /api/products/:productId - Delete product (Admin)
router.delete('/:productId', validate(productIdSchema), productController.deleteProduct);

module.exports = router;
