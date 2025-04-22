const Joi = require('joi');
const { AppError } = require('../utils/AppError');

// Custom MongoDB ObjectId validator
const objectId = (value, helpers) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.error('any.invalid');
  }
  return value;
};

// All schemas
const addItemSchema = Joi.object({
  productId: Joi.string().custom(objectId).required().messages({
    'string.empty': 'Product ID is required',
    'any.invalid': 'Invalid Product ID format',
  }),
  quantity: Joi.number().integer().min(1).max(100).required().messages({
    'number.base': 'Quantity must be a number',
    'number.integer': 'Quantity must be an integer',
    'number.min': 'Quantity must be at least {#limit}',
    'number.max': 'Quantity cannot exceed {#limit}',
    'any.required': 'Quantity is required',
  }),
  price: Joi.number().positive().precision(2).required().messages({
    'number.base': 'Price must be a number',
    'number.positive': 'Price must be positive',
    'any.required': 'Price is required',
  }),
  selectedVariants: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        value: Joi.string().required(),
      })
    )
    .optional(),
});

const updateItemSchema = Joi.object({
  quantity: Joi.number().integer().min(1).max(100).required().messages({
    'number.base': 'Quantity must be a number',
    'number.integer': 'Quantity must be an integer',
    'number.min': 'Quantity must be at least {#limit}',
    'number.max': 'Quantity cannot exceed {#limit}',
    'any.required': 'Quantity is required',
  }),
});

const removeItemSchema = Joi.object({
  cartItemId: Joi.string().custom(objectId).required().messages({
    'string.empty': 'Cart item ID is required',
    'any.invalid': 'Invalid Cart item ID format',
  }),
});

const applyCouponSchema = Joi.object({
  couponCode: Joi.string().trim().min(4).max(20).required().messages({
    'string.empty': 'Coupon code is required',
    'string.min': 'Coupon code must be at least {#limit} characters',
    'string.max': 'Coupon code cannot exceed {#limit} characters',
  }),
});

const checkoutSchema = Joi.object({
  shippingAddress: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipCode: Joi.string().required(),
    country: Joi.string().required(),
  }).required(),
  billingAddress: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipCode: Joi.string().required(),
    country: Joi.string().required(),
  }).optional(),
  paymentMethod: Joi.string().valid('credit_card', 'paypal', 'stripe').required().messages({
    'any.only': 'Payment method must be credit_card, paypal, or stripe',
  }),
  useShippingAsBilling: Joi.boolean().default(false),
  notes: Joi.string().max(500).optional(),
});

const cartIdSchema = Joi.object({
  cartId: Joi.string().custom(objectId).required().messages({
    'string.empty': 'Cart ID is required',
    'any.invalid': 'Invalid Cart ID format',
  }),
});

const productIdSchema = Joi.object({
  productId: Joi.string().custom(objectId).required().messages({
    'string.empty': 'Product ID is required',
    'any.invalid': 'Invalid Product ID format',
  }),
});

// ✅ Validation middleware
const validate = schema => (req, res, next) => {
  if (!schema || typeof schema.validate !== 'function') {
    return next(new AppError('Invalid validation schema', 500));
  }

  const dataToValidate =
    schema === cartIdSchema || schema === productIdSchema ? req.params : req.body;

  const { error, value } = schema.validate(dataToValidate, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true,
  });

  if (error) {
    const messages = error.details.map(detail => detail.message);
    return next(new AppError(messages.join('. '), 400));
  }

  if (schema === cartIdSchema || schema === productIdSchema) {
    req.params = value;
  } else {
    req.body = value;
  }

  next();
};

module.exports = {
  addItemSchema,
  updateItemSchema,
  removeItemSchema,
  applyCouponSchema,
  checkoutSchema,
  cartIdSchema,
  productIdSchema,
  validate,
};
