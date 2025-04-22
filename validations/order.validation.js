const Joi = require('joi');
const { AppError, PaymentError } = require('../utils/AppError');

// 🔹 Custom MongoDB ObjectId validator
const objectId = (value, helpers) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    throw new AppError('Invalid ID format', 400);
  }
  return value;
};

// 🔹 Custom payment method validator
const paymentMethodValidator = (value, helpers) => {
  const validMethods = ['card', 'paypal', 'cod']; // Matches Order.js enum
  if (!validMethods.includes(value)) {
    throw new PaymentError('Payment method must be card, paypal, or cod', value);
  }
  return value;
};

// 🔹 Custom order status validator
const orderStatusValidator = (value, helpers) => {
  const validStatuses = ['processing', 'shipped', 'delivered', 'cancelled', 'returned'];
  if (!validStatuses.includes(value)) {
    throw new AppError(`Invalid order status. Must be one of: ${validStatuses.join(', ')}`, 400);
  }
  return value;
};

// 🔹 Order ID Schema (used in params)
const orderIdSchema = Joi.string().custom(objectId).required().messages({
  'string.empty': 'Order ID is required',
  'any.invalid': 'Invalid Order ID format',
});

// 🔹 Order Placement Schema (user places order with 50% upfront)
const createOrderSchema = Joi.object({
  orderItems: Joi.array()
    .items(
      Joi.object({
        product: Joi.string().custom(objectId).required(),
        name: Joi.string().required(),
        quantity: Joi.number().min(1).required(),
        price: Joi.number().min(0.01).required(),
        image: Joi.string().optional(),
      })
    )
    .min(1)
    .required(),

  shippingInfo: Joi.object({
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    country: Joi.string().default('BD'),
    postalCode: Joi.string().required(),
    phone: Joi.string().required(),
  }).required(),

  paymentInfo: Joi.object({
    method: Joi.string().custom(paymentMethodValidator).required(),
    status: Joi.string().valid('pending', 'completed', 'failed', 'refunded').default('pending'),
    paidAmount: Joi.number().min(0).required().messages({
      'number.base': 'Paid amount must be a number',
      'number.min': 'Paid amount must be at least 50% upfront',
    }),
  }).required(),

  isConfirmed: Joi.boolean().optional().default(false), // ✅ new addition

  itemsPrice: Joi.number().min(0).default(0),
  taxPrice: Joi.number().min(0).default(0),
  shippingPrice: Joi.number().min(0).default(0),
  totalPrice: Joi.number().min(0).required(),
});

// 🔹 Update order status (admin only)
const updateOrderStatusSchema = Joi.object({
  orderStatus: Joi.string().custom(orderStatusValidator).required(),
  deliveredAt: Joi.date().optional(),
});

// 🔹 Cancel Order Schema (within 24hr; refund logic server-side)
const cancelOrderSchema = Joi.object({
  reason: Joi.string().max(500).required().messages({
    'string.empty': 'Cancellation reason is required',
    'string.max': 'Reason can be up to 500 characters',
  }),
  refundRequested: Joi.boolean().default(false),
});

// 🔹 Complete Remaining Payment after Delivery
const completePaymentSchema = Joi.object({
  amount: Joi.number().min(0.01).required().messages({
    'number.base': 'Payment amount must be a number',
    'number.min': 'Payment must be greater than 0',
    'any.required': 'Payment amount is required',
  }),
  method: Joi.string().custom(paymentMethodValidator).required(),
});

// 🔹 Validation Middleware
const validate = schemaName => {
  return (req, res, next) => {
    const schema = module.exports[schemaName];
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return next(new AppError(`Validation failed: ${errorMessages.join(', ')}`, 400));
    }

    req.body = value;
    next();
  };
};

module.exports = {
  createOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  completePaymentSchema,
  orderIdSchema,
  validate,
};
