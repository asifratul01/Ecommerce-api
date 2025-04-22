const Joi = require('joi');
const { passwordStrength } = require('check-password-strength');
const { AppError } = require('../utils/AppError');

// Custom password strength validator
const passwordComplexity = (value, helpers) => {
  const result = passwordStrength(value);
  if (result.id < 2) {
    return helpers.error('password.complexity');
  }
  return value;
};

// Custom objectId validator
const objectId = (value, helpers) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.error('any.invalid');
  }
  return value;
};

// All schemas
const schemas = {
  registerSchema: Joi.object({
    name: Joi.string().min(2).max(30).required().messages({
      'string.empty': 'Name is required',
      'string.min': 'Name should be at least {#limit} characters',
      'string.max': 'Name should not exceed {#limit} characters',
    }),
    email: Joi.string().email().required().messages({
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address',
    }),
    password: Joi.string().min(8).max(30).custom(passwordComplexity).required().messages({
      'string.empty': 'Password is required',
      'string.min': 'Password should be at least {#limit} characters',
      'string.max': 'Password should not exceed {#limit} characters',
      'password.complexity':
        'Password must contain at least one uppercase letter, one number, and one special character',
    }),
    passwordConfirm: Joi.string().valid(Joi.ref('password')).required().messages({
      'string.empty': 'Please confirm your password',
      'any.only': 'Passwords do not match',
    }),
  }),

  loginSchema: Joi.object({
    email: Joi.string().email().required().messages({
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address',
    }),
    password: Joi.string().required().messages({
      'string.empty': 'Password is required',
    }),
  }),

  forgotPasswordSchema: Joi.object({
    email: Joi.string().email().required().messages({
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address',
    }),
  }),

  resetPasswordSchema: Joi.object({
    token: Joi.string().required().messages({
      'string.empty': 'Token is required',
    }),
    password: Joi.string().min(8).max(30).custom(passwordComplexity).required().messages({
      'string.empty': 'Password is required',
      'string.min': 'Password should be at least {#limit} characters',
      'string.max': 'Password should not exceed {#limit} characters',
      'password.complexity':
        'Password must contain at least one uppercase letter, one number, and one special character',
    }),
    passwordConfirm: Joi.string().valid(Joi.ref('password')).required().messages({
      'string.empty': 'Please confirm your password',
      'any.only': 'Passwords do not match',
    }),
  }),

  updatePasswordSchema: Joi.object({
    currentPassword: Joi.string().required().messages({
      'string.empty': 'Current password is required',
    }),
    newPassword: Joi.string().min(8).max(30).custom(passwordComplexity).required().messages({
      'string.empty': 'New password is required',
      'string.min': 'New password should be at least {#limit} characters',
      'string.max': 'New password should not exceed {#limit} characters',
      'password.complexity':
        'Password must contain at least one uppercase letter, one number, and one special character',
    }),
    newPasswordConfirm: Joi.string().valid(Joi.ref('newPassword')).required().messages({
      'string.empty': 'Please confirm your new password',
      'any.only': 'Passwords do not match',
    }),
  }),

  verifyEmailSchema: Joi.object({
    token: Joi.string().required().messages({
      'string.empty': 'Token is required',
    }),
  }),

  updateProfileSchema: Joi.object({
    name: Joi.string().min(2).max(30).messages({
      'string.min': 'Name should be at least {#limit} characters',
      'string.max': 'Name should not exceed {#limit} characters',
    }),
    email: Joi.string().email().messages({
      'string.email': 'Please provide a valid email address',
    }),
  }).min(1),

  adminUpdateUserSchema: Joi.object({
    name: Joi.string().min(2).max(30).messages({
      'string.min': 'Name should be at least {#limit} characters',
      'string.max': 'Name should not exceed {#limit} characters',
    }),
    email: Joi.string().email().messages({
      'string.email': 'Please provide a valid email address',
    }),
    role: Joi.string().valid('user', 'admin').messages({
      'any.only': 'Role must be either user or admin',
    }),
  }).min(1),

  objectIdSchema: Joi.object({
    id: Joi.string().custom(objectId).required().messages({
      'string.empty': 'ID is required',
      'any.invalid': 'Invalid ID format',
    }),
  }),
};

// ✅ Updated validate function
const validate = schemaName => (req, res, next) => {
  const schema = schemas[schemaName];

  if (!schema || typeof schema.validate !== 'function') {
    return next(new AppError(`Invalid validation schema: ${schemaName}`, 500));
  }

  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    allowUnknown: false,
  });

  if (error) {
    const messages = error.details.map(detail => detail.message);
    return next(new AppError(messages.join('. '), 400));
  }

  req.body = value;
  next();
};

module.exports = {
  ...schemas,
  validate,
};
