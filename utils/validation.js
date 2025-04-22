const { AppError } = require('./AppError');

// Email validation using regex
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

// Password validation (min 8 chars, 1 uppercase, 1 number, 1 special char)
function validatePassword(password) {
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return re.test(password);
}

// Product input validation
function validateProductInput(product) {
  if (!product.name || typeof product.name !== 'string') {
    throw new AppError('Product name is required', 400);
  }
  if (!product.price || typeof product.price !== 'number' || product.price <= 0) {
    throw new AppError('Valid price is required', 400);
  }
  if (product.price.toString().split('.')[1]?.length > 2) {
    throw new AppError('Price must have max 2 decimal places', 400);
  }
  return true;
}

// Address validation
function validateAddress(address) {
  const requiredFields = ['street', 'city', 'state', 'zipCode', 'country'];
  for (const field of requiredFields) {
    if (!address[field]) {
      throw new AppError(`${field} is required`, 400);
    }
  }

  // Basic zip code validation
  const zipRegex = /^\d{5}(-\d{4})?$/;
  if (!zipRegex.test(address.zipCode)) {
    throw new AppError('Invalid zip code format', 400);
  }

  return true;
}

// Credit card validation (Luhn algorithm)
function validateCreditCard(cardNumber, expiration = null) {
  // Remove all non-digit characters
  cardNumber = cardNumber.replace(/\D/g, '');

  // Check if the card number is valid using Luhn algorithm
  let sum = 0;
  let shouldDouble = false;

  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber.charAt(i));

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  if (sum % 10 !== 0) return false;

  // Validate expiration date if provided
  if (expiration) {
    const [month, year] = expiration.split('/').map(Number);
    const currentYear = new Date().getFullYear() % 100;
    const currentMonth = new Date().getMonth() + 1;

    if (month < 1 || month > 12) {
      throw new AppError('Invalid expiration month', 400);
    }

    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      throw new AppError('Card has expired', 400);
    }
  }

  return true;
}

// Price validation
function validatePrice(price) {
  if (typeof price !== 'number' || isNaN(price)) {
    throw new AppError('Price must be a number', 400);
  }
  if (price <= 0) {
    throw new AppError('Price must be positive', 400);
  }
  if (price.toString().split('.')[1]?.length > 2) {
    throw new AppError('Price can have maximum 2 decimal places', 400);
  }
  return true;
}

module.exports = {
  validateEmail,
  validatePassword,
  validateProductInput,
  validateAddress,
  validateCreditCard,
  validatePrice,
};
