const express = require('express');
const { AppError } = require('./utils/AppError');
const globalErrorHandler = require('./controllers/error.controller');
const logger = require('./utils/logger');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const sanitizeHtml = require('sanitize-html');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const hpp = require('hpp');
const path = require('path');
const session = require('express-session');

// Verify essential environment variables
const requiredEnvVars = ['JWT_SECRET', 'MONGO_URI', 'JWT_COOKIE_SECRET'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    logger.error(`❌ Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

// Initialize Express app
const app = express();

// 1) SECURITY MIDDLEWARES
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.options('*', cors());

const limiter = rateLimit({
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// 2) BODY PARSING & COOKIE CONFIGURATION
app.use(
  express.json({
    limit: process.env.BODY_PARSER_LIMIT || '10kb',
    strict: true,
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.BODY_PARSER_LIMIT || '10kb',
  })
);
app.use(cookieParser(process.env.JWT_COOKIE_SECRET));

// 3) SESSION MIDDLEWARE
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // set to true if HTTPS is used
  })
);

// 4) DATA SANITIZATION
app.use(mongoSanitize({ replaceWith: '_' }));

// Use sanitize-html to sanitize body, query, and params
app.use((req, res, next) => {
  const sanitize = obj => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = sanitizeHtml(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
});

app.use(
  hpp({
    whitelist: ['price', 'ratingsAverage', 'ratingsQuantity', 'category', 'stock', 'createdAt'],
  })
);

// 5) PERFORMANCE OPTIMIZATION
app.use(compression());

// 6) AUTHENTICATION
require('./config/passport');
app.use(passport.initialize());

// 7) REQUEST LOGGING
if (process.env.NODE_ENV === 'development') {
  app.use(
    morgan('combined', {
      stream: logger.morganStream,
      skip: req => req.originalUrl === '/healthcheck',
    })
  );
}

// Request timing middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  logger.http(`Incoming ${req.method} ${req.originalUrl} from ${req.ip}`);
  next();
});

// 8) ROUTES
const apiRoutes = require('./routes/index');
app.use('/api/v1', apiRoutes);

// Health check endpoint
app.get('/healthcheck', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// 9) PRODUCTION STATIC ASSETS
if (process.env.NODE_ENV === 'production') {
  app.use(
    express.static(path.join(__dirname, '../client/build'), {
      maxAge: '1y',
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/build/index.html'));
  });
}

// 🔟 ERROR HANDLING
app.all('*', (req, res, next) => {
  logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
