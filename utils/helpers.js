const { AppError } = require('./AppError');
const crypto = require('crypto');

/**
 * Generates a random string of specified length
 * @param {number} length - Length of the random string
 * @returns {string} - Random string
 */
const generateRandomString = (length = 32) => {
  if (!Number.isInteger(length) || length <= 0) {
    throw new AppError('Length must be a positive integer', 400);
  }
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
};

/**
 * Formats price with currency symbol and decimals
 * @param {number} amount - Price amount
 * @param {string} currency - Currency code (default: 'USD')
 * @returns {string} - Formatted price string
 */
const formatPrice = (amount, currency = 'USD') => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new AppError('Invalid price amount', 400);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Creates slug from string
 * @param {string} text - Text to slugify
 * @returns {string} - Slugified string
 */
const slugify = text => {
  if (typeof text !== 'string') {
    throw new AppError('Input must be a string', 400);
  }

  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/-+/g, '-') // Replace multiple - with single -
    .trim();
};

/**
 * Validates and parses JSON string
 * @param {string} jsonString - JSON string to parse
 * @returns {object} - Parsed JSON object
 */
const safeJsonParse = jsonString => {
  try {
    return JSON.parse(jsonString);
  } catch (err) {
    throw new AppError('Invalid JSON string', 400);
  }
};

/**
 * Truncates text to specified length
 * @param {string} text - Text to truncate
 * @param {number} length - Maximum length
 * @param {string} [ending='...'] - Ending suffix
 * @returns {string} - Truncated text
 */
const truncate = (text, length = 100, ending = '...') => {
  if (typeof text !== 'string') {
    throw new AppError('Input must be a string', 400);
  }

  if (text.length <= length) return text;
  return text.substring(0, length - ending.length) + ending;
};

/**
 * Delays execution for specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} - Promise that resolves after delay
 */
const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Converts object to query string
 * @param {object} params - Object to convert
 * @returns {string} - Query string
 */
const objectToQueryString = params => {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
};

/**
 * Checks if value is empty (null, undefined, empty string/array/object)
 * @param {*} value - Value to check
 * @returns {boolean} - True if empty
 */
const isEmpty = value => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

module.exports = {
  generateRandomString,
  formatPrice,
  slugify,
  safeJsonParse,
  truncate,
  sleep,
  objectToQueryString,
  isEmpty,
};
