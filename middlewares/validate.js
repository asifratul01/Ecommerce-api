const { z } = require('zod');
const createHttpError = require('http-errors');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// Configure DOMPurify
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Custom sanitization function
const sanitize = value => {
  return purify.sanitize(value, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
};

// Custom schema with sanitization
const safeString = z.string().transform(sanitize);

const schemas = {
  // User validation
  registerUser: z
    .object({
      name: safeString.min(2).max(30),
      email: z.string().email(),
      password: z
        .string()
        .min(8)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})/)
        .describe(
          'Password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character'
        ),
      passwordConfirm: z.string(),
    })
    .refine(data => data.password === data.passwordConfirm, {
      message: "Passwords don't match",
      path: ['passwordConfirm'],
    }),

  // Product validation
  createProduct: z.object({
    name: safeString.min(3).max(100),
    description: safeString.min(10).max(2000),
    price: z.number().min(0.01).multipleOf(0.01),
    category: safeString,
    stock: z.number().int().min(0),
    images: z
      .array(
        z.object({
          public_id: z.string(),
          url: z.string().url(),
        })
      )
      .optional(),
  }),

  // Add more schemas as needed...
};

exports.validate = schemaName => {
  return async (req, res, next) => {
    try {
      const schema = schemas[schemaName];
      if (!schema) {
        throw createHttpError(500, `Validation schema '${schemaName}' not found`);
      }

      const result = await schema.safeParseAsync(req.body);

      if (!result.success) {
        const errors = result.error.issues.map(issue => {
          return {
            path: issue.path.join('.'),
            message: issue.message,
          };
        });

        return next(createHttpError(400, 'Validation failed', { errors }));
      }

      // Replace body with validated and sanitized data
      req.body = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
};
