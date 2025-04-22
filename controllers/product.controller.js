const productService = require('../services/product.service'); // Import the service
const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');

// Create new product - Admin only
exports.createProduct = async (req, res, next) => {
  try {
    const product = await productService.createProduct({
      productData: req.body,
      userId: req.user.id,
    });

    res.status(201).json({
      success: true,
      product,
    });
  } catch (error) {
    logger.error(`Create product error: ${error}`);
    next(new AppError(error.message, error.statusCode || 500));
  }
};

// Get all products
exports.getAllProducts = async (req, res, next) => {
  try {
    // Call the service to get products with query parameters
    const { products, count, total } = await productService.getAllProducts(req.query);

    // Send the response with products, count, and total
    res.status(200).json({
      success: true,
      count,
      total,
      products,
    });
  } catch (error) {
    // Log error and pass to next middleware (error handler)
    logger.error(`Get all products error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Get single product
exports.getProduct = async (req, res, next) => {
  try {
    const product = await productService.getProduct({
      productId: req.params.productId,
    });

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    logger.error(`Get product error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Update product - Admin only
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await productService.updateProduct({
      productId: req.params.productId,
      updateData: req.body,
      userId: req.user.id,
      userRole: req.user.role,
    });

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    logger.error(`Update product error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Delete product - Admin only
exports.deleteProduct = async (req, res, next) => {
  try {
    await productService.deleteProduct({
      productId: req.params.productId,
      userId: req.user.id,
      userRole: req.user.role,
    });

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    logger.error(`Delete product error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Create/Update product review
exports.createProductReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;

    await productService.createProductReview({
      productId: req.params.productId,
      userId: req.user.id,
      userName: req.user.name,
      rating,
      comment,
    });

    res.status(201).json({
      success: true,
      message: 'Review added',
    });
  } catch (error) {
    logger.error(`Create review error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Get all reviews of a product
exports.getProductReviews = async (req, res, next) => {
  try {
    const reviews = await productService.getProductReviews({
      productId: req.params.productId,
    });

    res.status(200).json({
      success: true,
      reviews,
    });
  } catch (error) {
    logger.error(`Get reviews error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Delete review - Admin/Review owner only
exports.deleteReview = async (req, res, next) => {
  try {
    await productService.deleteReview({
      productId: req.params.productId,
      reviewId: req.params.reviewId,
      userId: req.user.id,
      userRole: req.user.role,
    });

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    logger.error(`Delete review error: ${error}`);
    next(new AppError(error.message, 500));
  }
};

// Get admin products - For admin dashboard
exports.getAdminProducts = async (req, res, next) => {
  try {
    const products = await productService.getAdminProducts({
      userId: req.user.id,
    });

    res.status(200).json({
      success: true,
      products,
    });
  } catch (error) {
    logger.error(`Get admin products error: ${error}`);
    next(new AppError(error.message, 500));
  }
};
