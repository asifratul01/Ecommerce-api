const Joi = require('joi');
const { AppError } = require('../utils/AppError');

// Custom validators
const objectId = (value, helpers) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.error('any.invalid');
  }
  return value;
};

const paymentMethodValidator = (value, helpers) => {
  const validMethods = ['credit_card', 'debit_card', 'paypal', 'stripe', 'bank_transfer'];
  if (!validMethods.includes(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

const currencyValidator = (value, helpers) => {
  const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
  if (!validCurrencies.includes(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

module.exports = {
  // Process payment validation
  processPaymentSchema: Joi.object({
    orderId: Joi.string().custom(objectId).required().messages({
      'string.empty': 'Order ID is required',
      'any.invalid': 'Invalid Order ID format',
    }),

    paymentMethod: Joi.string().custom(paymentMethodValidator).required().messages({
      'any.invalid':
        'Payment method must be credit_card, debit_card, paypal, stripe, or bank_transfer',
      'string.empty': 'Payment method is required',
    }),

    amount: Joi.number().positive().precision(2).required().messages({
      'number.base': 'Amount must be a number',
      'number.positive': 'Amount must be positive',
      'any.required': 'Amount is required',
    }),

    currency: Joi.string().custom(currencyValidator).default('USD').messages({
      'any.invalid': 'Currency must be USD, EUR, GBP, CAD, or AUD',
    }),

    paymentDetails: Joi.object().when('paymentMethod', {
      switch: [
        {
          is: Joi.string().valid('credit_card', 'debit_card'),
          then: Joi.object({
            cardNumber: Joi.string()
              .pattern(/^[0-9]{13,19}$/)
              .required()
              .messages({
                'string.pattern.base': 'Card number must be 13-19 digits',
                'string.empty': 'Card number is required',
              }),
            expiry: Joi.string()
              .pattern(/^(0[1-9]|1[0-2])\/?([0-9]{4}|[0-9]{2})$/)
              .required()
              .messages({
                'string.pattern.base': 'Expiry must be in MM/YY or MM/YYYY format',
                'string.empty': 'Expiry date is required',
              }),
            cvv: Joi.string()
              .length(3)
              .pattern(/^[0-9]+$/)
              .required()
              .messages({
                'string.length': 'CVV must be 3 digits',
                'string.pattern.base': 'CVV must contain only numbers',
                'string.empty': 'CVV is required',
              }),
            nameOnCard: Joi.string().min(2).max(50).required().messages({
              'string.empty': 'Name on card is required',
              'string.min': 'Name must be at least 2 characters',
              'string.max': 'Name cannot exceed 50 characters',
            }),
          }).required(),
        },
        {
          is: 'paypal',
          then: Joi.object({
            email: Joi.string().email().required().messages({
              'string.email': 'Please provide a valid PayPal email',
              'string.empty': 'PayPal email is required',
            }),
          }).required(),
        },
        {
          is: 'bank_transfer',
          then: Joi.object({
            accountNumber: Joi.string()
              .pattern(/^[0-9]{8,17}$/)
              .required()
              .messages({
                'string.pattern.base': 'Account number must be 8-17 digits',
                'string.empty': 'Account number is required',
              }),
            routingNumber: Joi.string()
              .pattern(/^[0-9]{9}$/)
              .required()
              .messages({
                'string.pattern.base': 'Routing number must be 9 digits',
                'string.empty': 'Routing number is required',
              }),
          }).required(),
        },
      ],
      otherwise: Joi.object().optional(),
    }),

    savePaymentMethod: Joi.boolean().default(false),
  }),

  // Refund validation
  processRefundSchema: Joi.object({
    paymentId: Joi.string().custom(objectId).required().messages({
      'string.empty': 'Payment ID is required',
      'any.invalid': 'Invalid Payment ID format',
    }),

    amount: Joi.number().positive().precision(2).required().messages({
      'number.base': 'Amount must be a number',
      'number.positive': 'Amount must be positive',
      'any.required': 'Amount is required',
    }),

    reason: Joi.string().max(500).required().messages({
      'string.empty': 'Refund reason is required',
      'string.max': 'Reason cannot exceed 500 characters',
    }),
  }),

  // Payment ID validation (for params)
  paymentIdSchema: Joi.object({
    paymentId: Joi.string().custom(objectId).required().messages({
      'string.empty': 'Payment ID is required',
      'any.invalid': 'Invalid Payment ID format',
    }),
  }),

  // Validate function
  validate: schema => (req, res, next) => {
    const inputToValidate = schema === this.paymentIdSchema ? req.params : req.body;
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

    if (schema === this.paymentIdSchema) {
      req.params = value;
    } else {
      req.body = value;
    }
    next();
  },
};
