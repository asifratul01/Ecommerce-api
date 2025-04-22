const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const logger = require('../utils/logger');

// Local strategy for email/password login
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
          return done(null, false, { message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid credentials' });
        }

        // Remove password before returning user
        user.password = undefined;
        return done(null, user);
      } catch (err) {
        logger.error(`Passport local strategy error: ${err}`);
        return done(err);
      }
    }
  )
);

// JWT strategy configuration
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
  issuer: process.env.JWT_ISSUER || 'ecommerce-api',
  audience: process.env.JWT_AUDIENCE || 'ecommerce-client',
};

// JWT strategy for protected routes
passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      // Using payload.id instead of payload.sub for consistency
      const user = await User.findById(payload.id);

      if (!user) {
        return done(null, false);
      }

      // Check if token was issued before password change
      if (user.changedPasswordAfter && user.changedPasswordAfter(payload.iat)) {
        return done(null, false);
      }

      return done(null, user);
    } catch (err) {
      logger.error(`Passport JWT strategy error: ${err}`);
      return done(err, false);
    }
  })
);

// Serialization (not strictly needed for JWT but kept for compatibility)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
