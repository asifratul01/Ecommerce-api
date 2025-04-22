const jwt = require('jsonwebtoken');
const logger = require('./logger');

/**
 * Generate JWT token with enhanced logging
 * @param {object} user - User object
 * @returns {string} JWT token
 * @throws {Error} If token generation fails
 */
const generateToken = user => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    const payload = {
      id: user._id,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '30d',
      issuer: process.env.JWT_ISSUER || 'ecommerce-api',
      audience: process.env.JWT_AUDIENCE || 'ecommerce-client',
    });

    logger.debug('JWT token generated', {
      userId: user._id,
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    });

    return token;
  } catch (error) {
    logger.error('JWT generation failed', {
      error: error.message,
      stack: error.stack,
      userId: user?._id,
    });
    throw new Error('Token generation failed');
  }
};

/**
 * Verify JWT token with comprehensive logging
 * @param {string} token - JWT token to verify
 * @returns {object} Decoded token payload
 * @throws {Error} If token is invalid
 */
const verifyToken = token => {
  try {
    if (!token) {
      throw new Error('No token provided');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    });

    logger.debug('JWT token verified', {
      userId: decoded.id,
      issuer: decoded.iss,
      audience: decoded.aud,
      expires: new Date(decoded.exp * 1000),
    });

    return decoded;
  } catch (error) {
    logger.error('JWT verification failed', {
      error: error.message,
      stack: error.stack,
      token: token ? 'provided' : 'missing',
    });
    throw error;
  }
};

/**
 * Send token response with enhanced security logging
 * @param {object} user - User object
 * @param {number} statusCode - HTTP status code
 * @param {object} res - Express response object
 */
const sendToken = (user, statusCode, res) => {
  try {
    if (!user || !user._id) {
      throw new Error('Invalid user object');
    }

    const token = generateToken(user);

    // Sanitize user object
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };

    // Secure cookie configuration
    const cookieOptions = {
      expires: new Date(
        Date.now() + (process.env.JWT_COOKIE_EXPIRE_DAYS || 30) * 24 * 60 * 60 * 1000
      ),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      domain: process.env.COOKIE_DOMAIN,
    };

    logger.info('Sending token response', {
      userId: user._id,
      statusCode,
      secureCookie: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
    });

    res.status(statusCode).cookie('token', token, cookieOptions).json({
      success: true,
      token,
      user: userResponse,
    });
  } catch (error) {
    logger.error('Token response failed', {
      error: error.message,
      stack: error.stack,
      userId: user?._id,
    });
    throw error;
  }
};

module.exports = {
  generateToken,
  verifyToken,
  sendToken,
};
