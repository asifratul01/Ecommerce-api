const mongoose = require('mongoose');
const { AppError } = require('../utils/AppError');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
      maxlength: [50, 'Category name cannot exceed 50 characters'],
      minlength: [3, 'Category name must be at least 3 characters'],
    },
    slug: {
      type: String,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    image: {
      public_id: String,
      url: String,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for subcategories
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentCategory',
  justOne: false,
});

// Virtual for product count
categorySchema.virtual('productCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'categories',
  count: true,
});

// Generate slug before saving
categorySchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true, strict: true });
  this.updatedAt = Date.now();
  next();
});

// Prevent deletion if category has products
categorySchema.pre('remove', async function (next) {
  const Product = mongoose.model('Product');
  const products = await Product.find({ categories: this._id });

  if (products.length > 0) {
    return next(
      new AppError(`Cannot delete category with ${products.length} associated products`, 400)
    );
  }
  next();
});

// Cascade delete subcategories when parent is deleted
categorySchema.pre('remove', async function (next) {
  await this.model('Category').deleteMany({ parentCategory: this._id });
  next();
});

// Static method for tree structure
categorySchema.statics.getCategoryTree = async function () {
  const categories = await this.aggregate([
    {
      $graphLookup: {
        from: 'categories',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parentCategory',
        as: 'children',
        depthField: 'depth',
      },
    },
    { $match: { parentCategory: null } },
  ]);

  return categories;
};

// Static method to check if category exists
categorySchema.statics.categoryExists = async function (name, excludeId = null) {
  const query = { name: new RegExp(`^${name}$`, 'i') };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return await this.findOne(query);
};

// Indexes for better performance
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ active: 1, featured: 1 });

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
