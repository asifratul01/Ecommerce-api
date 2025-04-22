const mongoose = require('mongoose');
const slugify = require('slugify');
const { AppError } = require('../utils/AppError'); // Import AppError

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
    name: {
      type: String,
      required: [true, 'Review must have a name'],
    },
    rating: {
      type: Number,
      required: [true, 'Review must have a rating'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating must be at most 5'],
    },
    comment: {
      type: String,
      required: [true, 'Review must have a comment'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, 'Image must have a URL'],
    },
    altText: {
      type: String,
      default: 'Product image',
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product must have a name'],
      trim: true,
      maxlength: [100, 'Product name cannot exceed 100 characters'],
      minlength: [5, 'Product name must be at least 5 characters'],
    },
    slug: {
      type: String,
      unique: true, // Ensuring unique slug directly
    },
    description: {
      type: String,
      required: [true, 'Product must have a description'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      minlength: [10, 'Description must be at least 10 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Product must have a price'],
      min: [0.01, 'Price must be at least 0.01'],
    },
    discountPrice: {
      type: Number,
      validate: {
        validator: function (val) {
          return val < this.price;
        },
        message: 'Discount price must be less than regular price',
      },
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product must belong to a category'],
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
    brand: {
      type: String,
      trim: true,
    },
    stock: {
      type: Number,
      required: [true, 'Product must have stock quantity'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    sold: {
      type: Number,
      default: 0,
    },
    images: [imageSchema],
    reviews: [reviewSchema],
    numReviews: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating must be at least 0'],
      max: [5, 'Rating must be at most 5'],
    },
    specifications: {
      type: Map,
      of: String,
    },
    tags: [String],
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Product must belong to a user'],
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

// Create product slug from name
productSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// Update average rating after review operations
productSchema.pre('save', function (next) {
  if (this.isModified('reviews')) {
    this.numReviews = this.reviews.length;
    this.rating =
      this.reviews.length > 0
        ? this.reviews.reduce((acc, item) => item.rating + acc, 0) / this.reviews.length
        : 0;
  }
  next();
});

// Query middleware to populate category and user info
productSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'category',
    select: 'name',
  })
    .populate({
      path: 'subCategory',
      select: 'name',
    })
    .populate({
      path: 'user',
      select: 'name email',
    });
  next();
});

// Virtual for discounted price
productSchema.virtual('discountedPrice').get(function () {
  return this.discountPrice || this.price;
});

// Static method to get featured products
productSchema.statics.getFeaturedProducts = function (limit = 5) {
  return this.find({ isFeatured: true }).limit(limit).sort({ rating: -1, createdAt: -1 });
};

// Static method to get top-rated products
productSchema.statics.getTopProducts = function (limit = 5) {
  return this.find({ rating: { $gte: 4 }, isActive: true })
    .limit(limit)
    .sort({ rating: -1, numReviews: -1 });
};

// Static method to get related products
productSchema.statics.getRelatedProducts = function (productId, categoryId, limit = 4) {
  return this.find({
    _id: { $ne: productId },
    category: categoryId,
    isActive: true,
  }).limit(limit);
};

// Indexes for better performance
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ category: 1 });
productSchema.index({ user: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ isActive: 1 });

// Example of how to use AppError in validation or operations
productSchema.pre('save', function (next) {
  if (this.price < 0) {
    return next(new AppError('Price cannot be less than 0', 400)); // Custom error for invalid price
  }
  next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
