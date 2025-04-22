const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const auth = require('../middlewares/auth');
const { validate } = require('../validations/order.validation');
const { checkOwnership } = require('../middlewares/roleCheck');
const Order = require('../models/Order');

// 🔐 All routes below require login
router.use(auth.protect);

// 🛒 POST /api/orders - Place a new order with 50% payment (Any user)
router.post('/', validate('createOrderSchema'), orderController.createOrder);

// 📜 GET /api/orders/myorders - View user's own orders
router.get('/myorders', orderController.getMyOrders);

// 🔍 GET /api/orders/:id - View single order (admin or owner only)
router.get('/:id', validate('orderIdSchema'), checkOwnership(Order), orderController.getOrder);

// ❌ PATCH /api/orders/cancel/:orderId - Cancel order within 24h (with 98% refund)
router.patch(
  '/cancel/:orderId',
  validate('orderIdSchema'),
  validate('cancelOrderSchema'),
  orderController.cancelOrder
);

// 💳 POST /api/orders/pay/:orderId - Complete final 50% payment (on delivery)
router.post(
  '/pay/:orderId',
  validate('orderIdSchema'),
  validate('completePaymentSchema'),
  orderController.completePayment
);

// 💰 GET /api/orders/payments - View payment records
router.get('/payments', orderController.getPayments);

// ---------------- ADMIN ONLY ---------------- //
router.use(auth.restrictTo('admin'));

// 📋 GET /api/orders - View all orders (admin)
router.get('/', orderController.getAllOrders);

// ✅ PUT /api/orders/:id - Update order status (admin)
router.put(
  '/:id',
  validate('orderIdSchema'),
  validate('updateOrderStatusSchema'),
  orderController.updateOrder
);

// 🗑️ DELETE /api/orders/:id - Delete order (admin)
router.delete('/:id', validate('orderIdSchema'), orderController.deleteOrder);

// 📊 GET /api/orders/sales/monthly - Monthly sales report (admin)
router.get('/sales/monthly', orderController.getMonthlySales);

module.exports = router;
