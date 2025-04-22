const Product = require('../models/Product');
const Category = require('../models/Category'); // Import Category if needed
const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');
const APIFeatures = require('../utils/apiFeatures');

class ProductService {
  async createProduct({ productData, userId }) {
    productData.user = userId;
    const product = await Product.create(productData);
    return product;
  }

  async getAllProducts(queryParams) {
    console.log('Query params:', queryParams); // For debugging

    // Start with base query and populate category field with 'name'
    const baseQuery = Product.find().populate('category', 'name');

    // Apply query features like filter, search, sort, etc.
    const features = new APIFeatures(baseQuery, queryParams)
      .filter()
      .search(['name', 'description'])
      .sort()
      .limitFields()
      .paginate();

    const countQuery = new APIFeatures(Product.find(), queryParams)
      .filter()
      .search(['name', 'description']);

    // Fetch products and count concurrently
    const [products, total] = await Promise.all([
      features.query,
      countQuery.query.countDocuments(),
    ]);

    return {
      products,
      count: products.length,
      total,
    };
  }

  async getProduct({ productId }) {
    const product = await Product.findById(productId).populate('category', 'name');
    if (!product) throw new AppError('Product not found', 404);
    return product;
  }

  async updateProduct({ productId, updateData, userId, userRole }) {
    let product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404);

    if (product.user.toString() !== userId && userRole !== 'admin') {
      throw new AppError('Not authorized to update this product', 403);
    }

    product = await Product.findByIdAndUpdate(productId, updateData, {
      new: true,
      runValidators: true,
    });

    return product;
  }

  async deleteProduct({ productId, userId, userRole }) {
    const product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404);

    if (product.user.toString() !== userId && userRole !== 'admin') {
      throw new AppError('Not authorized to delete this product', 403);
    }

    await product.remove();
  }

  async createProductReview({ productId, userId, userName, rating, comment }) {
    const product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404);

    const alreadyReviewed = product.reviews.find(r => r.user.toString() === userId);
    if (alreadyReviewed) throw new AppError('Product already reviewed', 400);

    const review = {
      user: userId,
      name: userName,
      rating: Number(rating),
      comment,
    };

    product.reviews.push(review);
    product.numReviews = product.reviews.length;
    product.rating =
      product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

    await product.save();
  }

  async getProductReviews({ productId }) {
    const product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404);
    return product.reviews;
  }

  async deleteReview({ productId, reviewId, userId, userRole }) {
    const product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404);

    const review = product.reviews.find(r => r._id.toString() === reviewId);
    if (!review) throw new AppError('Review not found', 404);

    if (review.user.toString() !== userId && userRole !== 'admin') {
      throw new AppError('Not authorized to delete this review', 403);
    }

    product.reviews = product.reviews.filter(r => r._id.toString() !== reviewId);
    product.numReviews = product.reviews.length;
    product.rating =
      product.reviews.length > 0
        ? product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length
        : 0;

    await product.save();
  }

  async getAdminProducts({ userId }) {
    return await Product.find({ user: userId }).populate('category', 'name');
  }
}

module.exports = new ProductService();
