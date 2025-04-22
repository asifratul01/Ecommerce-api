const { AppError } = require('./AppError');

/**
 * Calculates the subtotal of items in cart
 * @param {Array} items - Array of items with price and quantity
 * @returns {number} - Subtotal amount
 */
function calculateSubtotal(items) {
  if (!Array.isArray(items)) {
    throw new AppError('Items must be an array', 400);
  }

  return items.reduce((sum, item) => {
    if (typeof item.price !== 'number' || typeof item.quantity !== 'number') {
      throw new AppError('Invalid item format', 400);
    }
    return sum + item.price * item.quantity;
  }, 0);
}

/**
 * Applies discount to an amount
 * @param {number} amount - Original amount
 * @param {object} discount - Discount configuration
 * @param {string} discount.type - 'percentage' or 'fixed'
 * @param {number} discount.value - Discount value
 * @returns {number} - Amount after discount
 */
function applyDiscount(amount, discount) {
  if (typeof amount !== 'number' || amount < 0) {
    throw new AppError('Invalid amount', 400);
  }

  if (!discount || typeof discount !== 'object') {
    throw new AppError('Discount configuration required', 400);
  }

  let discountedAmount;

  switch (discount.type) {
    case 'percentage':
      if (discount.value < 0 || discount.value > 100) {
        throw new AppError('Invalid percentage value', 400);
      }
      discountedAmount = amount * (1 - discount.value / 100);
      break;
    case 'fixed':
      if (discount.value < 0) {
        throw new AppError('Invalid fixed discount value', 400);
      }
      discountedAmount = amount - discount.value;
      break;
    default:
      throw new AppError('Invalid discount type', 400);
  }

  // Ensure amount doesn't go negative
  return Math.max(0, discountedAmount);
}

/**
 * Calculates tax amount
 * @param {number} amount - Taxable amount
 * @param {number} taxRate - Tax rate (e.g., 0.08 for 8%)
 * @returns {number} - Tax amount rounded to 2 decimal places
 */
function calculateTax(amount, taxRate) {
  if (typeof amount !== 'number' || amount < 0) {
    throw new AppError('Invalid amount', 400);
  }

  if (typeof taxRate !== 'number' || taxRate < 0) {
    throw new AppError('Invalid tax rate', 400);
  }

  const tax = amount * taxRate;
  return Math.round(tax * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculates shipping cost
 * @param {number} amount - Order amount
 * @param {object} shippingOptions - Shipping configuration
 * @param {string} shippingOptions.method - 'flat' or 'threshold'
 * @param {number} shippingOptions.rate - Shipping rate
 * @param {number} [shippingOptions.freeThreshold] - Threshold for free shipping
 * @returns {number} - Shipping cost
 */
function calculateShipping(amount, shippingOptions) {
  if (typeof amount !== 'number' || amount < 0) {
    throw new AppError('Invalid amount', 400);
  }

  if (!shippingOptions || typeof shippingOptions !== 'object') {
    throw new AppError('Shipping options required', 400);
  }

  switch (shippingOptions.method) {
    case 'flat':
      if (typeof shippingOptions.rate !== 'number' || shippingOptions.rate < 0) {
        throw new AppError('Invalid shipping rate', 400);
      }
      return shippingOptions.rate;
    case 'threshold':
      if (typeof shippingOptions.rate !== 'number' || shippingOptions.rate < 0) {
        throw new AppError('Invalid shipping rate', 400);
      }
      if (typeof shippingOptions.freeThreshold !== 'number' || shippingOptions.freeThreshold < 0) {
        throw new AppError('Invalid free shipping threshold', 400);
      }
      return amount >= shippingOptions.freeThreshold ? 0 : shippingOptions.rate;
    default:
      throw new AppError('Invalid shipping method', 400);
  }
}

/**
 * Calculates order total
 * @param {object} orderDetails - Order details
 * @param {number} orderDetails.subtotal - Order subtotal
 * @param {object} orderDetails.discount - Discount configuration
 * @param {number} orderDetails.taxRate - Tax rate
 * @param {object} orderDetails.shipping - Shipping configuration
 * @returns {number} - Total amount
 */
function calculateTotal(orderDetails) {
  if (!orderDetails || typeof orderDetails !== 'object') {
    throw new AppError('Order details required', 400);
  }

  const { subtotal, discount, taxRate, shipping } = orderDetails;

  if (typeof subtotal !== 'number' || subtotal < 0) {
    throw new AppError('Invalid subtotal', 400);
  }

  const discountedAmount = discount ? applyDiscount(subtotal, discount) : subtotal;
  const taxAmount = calculateTax(discountedAmount, taxRate || 0);
  const shippingCost = shipping ? calculateShipping(discountedAmount, shipping) : 0;

  return Math.round((discountedAmount + taxAmount + shippingCost) * 100) / 100;
}

module.exports = {
  calculateSubtotal,
  applyDiscount,
  calculateTax,
  calculateShipping,
  calculateTotal,
};
