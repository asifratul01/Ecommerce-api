class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class InventoryError extends AppError {
  constructor(productId, requested, available) {
    super(
      `Not enough stock for product ${productId}. Requested: ${requested}, Available: ${available}`,
      400
    );
    this.name = 'InventoryError';
  }
}

class PaymentError extends AppError {
  constructor(message, paymentMethod) {
    super(`Payment failed: ${message}`, 402);
    this.name = 'PaymentError';
    this.paymentMethod = paymentMethod;
  }
}

// ✅ Export everything in a single object
module.exports = {
  AppError,
  InventoryError,
  PaymentError,
};
