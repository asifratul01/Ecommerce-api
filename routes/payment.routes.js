const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const auth = require('../middlewares/auth');
const { validate } = require('../validations/payment.validation');

// Apply authentication middleware to all payment routes
router.use(auth.protect);

// POST /api/payments/process - Process payment
router.post('/process', validate('processPaymentSchema'), paymentController.processPayment);

// GET /api/payments/status/:orderId - Get payment status
router.get('/status/:orderId', validate('paymentIdSchema'), paymentController.getPaymentStatus);

// ADMIN ROUTES
router.use(auth.restrictTo('admin'));

// POST /api/payments/refund - Process refund (Admin)
router.post('/refund', validate('processRefundSchema'), paymentController.processRefund);

module.exports = router;
