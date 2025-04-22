const Joi = require('joi');
const { AppError } = require('../utils/AppError');

// Custom validators
const objectId = (value, helpers) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.error('any.invalid');
  }
  return value;
};

const slugValidator = (value, helpers) => {
  if (!value.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)) {
    return helpers.error('any.invalid');
  }
  return value;
};

// Product ID validation (for params)
const productIdSchema = Joi.object({
  productId: Joi.string().custom(objectId).required().messages({
    'string.empty': 'Product ID is required',
    'any.invalid': 'Invalid Product ID format',
  }),
});

// Product query/filter validation
const productQuerySchema = Joi.object({
  category: Joi.string().custom(objectId).optional(),
  status: Joi.string().valid('active', 'draft', 'archived').optional(),
  featured: Joi.boolean().optional(),
  priceMin: Joi.number().positive().optional(),
  priceMax: Joi.number().positive().optional(),
  search: Joi.string().max(100).optional(),
  sort: Joi.string()
    .valid('price', '-price', 'name', '-name', 'createdAt', '-createdAt')
    .optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  page: Joi.number().integer().min(1).default(1),
});

// Review ID validation
const reviewIdSchema = Joi.object({
  reviewId: Joi.string().custom(objectId).required().messages({
    'string.empty': 'Review ID is required',
    'any.invalid': 'Invalid Review ID format',
  }),
});

// Create review validation
const createReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required().messages({
    'number.base': 'Rating must be a number',
    'number.integer': 'Rating must be an integer',
    'number.min': 'Rating must be at least 1',
    'number.max': 'Rating cannot exceed 5',
    'any.required': 'Rating is required',
  }),
  comment: Joi.string().min(10).max(500).required().messages({
    'string.empty': 'Review comment is required',
    'string.min': 'Comment must be at least 10 characters',
    'string.max': 'Comment cannot exceed 500 characters',
  }),
});

// Create product validation
const createProductSchema = Joi.object({
  name: Joi.string().min(3).max(100).required().messages({
    'string.empty': 'Product name is required',
    'string.min': 'Product name must be at least 3 characters',
    'string.max': 'Product name cannot exceed 100 characters',
  }),

  slug: Joi.string()
    .custom(slugValidator)
    .messages({
      'any.invalid': 'Slug must be URL-friendly (lowercase letters, numbers, hyphens)',
    })
    .optional(),

  description: Joi.string().min(10).max(2000).required().messages({
    'string.empty': 'Description is required',
    'string.min': 'Description must be at least 10 characters',
    'string.max': 'Description cannot exceed 2000 characters',
  }),

  price: Joi.number().positive().precision(2).required().messages({
    'number.base': 'Price must be a number',
    'number.positive': 'Price must be positive',
    'any.required': 'Price is required',
  }),

  compareAtPrice: Joi.number()
    .positive()
    .precision(2)
    .greater(Joi.ref('price'))
    .messages({
      'number.base': 'Compare price must be a number',
      'number.positive': 'Compare price must be positive',
      'number.greater': 'Compare price must be greater than price',
    })
    .optional(),

  costPerItem: Joi.number()
    .positive()
    .precision(2)
    .less(Joi.ref('price'))
    .messages({
      'number.base': 'Cost must be a number',
      'number.positive': 'Cost must be positive',
      'number.less': 'Cost must be less than price',
    })
    .optional(),

  sku: Joi.string()
    .max(50)
    .messages({
      'string.max': 'SKU cannot exceed 50 characters',
    })
    .optional(),

  barcode: Joi.string()
    .max(50)
    .messages({
      'string.max': 'Barcode cannot exceed 50 characters',
    })
    .optional(),

  quantity: Joi.number().integer().min(0).default(0).messages({
    'number.base': 'Quantity must be a number',
    'number.integer': 'Quantity must be an integer',
    'number.min': 'Quantity cannot be negative',
  }),

  category: Joi.string().custom(objectId).required().messages({
    'string.empty': 'Category is required',
    'any.invalid': 'Invalid Category ID format',
  }),

  subCategory: Joi.string()
    .custom(objectId)
    .messages({
      'any.invalid': 'Invalid Subcategory ID format',
    })
    .optional(),

  status: Joi.string().valid('active', 'draft', 'archived').default('active').messages({
    'any.only': 'Status must be active, draft, or archived',
  }),

  featured: Joi.boolean().default(false),

  variants: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        options: Joi.array().items(Joi.string()).min(1).required(),
      })
    )
    .optional(),

  images: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
        altText: Joi.string().max(100).optional(),
      })
    )
    .min(1)
    .messages({
      'array.min': 'At least one image is required',
    })
    .required(),

  seo: Joi.object({
    title: Joi.string().max(70).optional(),
    description: Joi.string().max(160).optional(),
  }).optional(),
});

// Optional: Update product schema (reuses most of create schema)
const updateProductSchema = createProductSchema.fork(
  Object.keys(createProductSchema.describe().keys),
  schema => schema.optional()
);

// Validate middleware
const validate = schema => (req, res, next) => {
  const inputToValidate =
    schema === productIdSchema || schema === productQuerySchema
      ? { ...req.params, ...req.query }
      : req.body;

  const { error, value } = schema.validate(inputToValidate, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true,
  });

  if (error) {
    const messages = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    return next(new AppError('Validation failed', 400, messages));
  }

  // Attach validated data
  if (schema === productIdSchema) {
    req.params = value;
  } else if (schema === productQuerySchema) {
    req.query = value;
  } else {
    req.body = value;
  }

  next();
};

module.exports = {
  validate,
  createProductSchema,
  updateProductSchema,
  productIdSchema,
  productQuerySchema,
  createReviewSchema,
  reviewIdSchema,
};
