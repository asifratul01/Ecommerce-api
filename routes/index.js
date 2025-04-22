const express = require('express');
const router = express.Router();

// Import all route files
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const productRoutes = require('./product.routes');
const orderRoutes = require('./order.routes');
const paymentRoutes = require('./payment.routes');
const cartRoutes = require('./cart.routes'); // ✅ Make sure the file name matches

// Mount routes (these are prefixed by /api/v1 in app.js)
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/cart', cartRoutes); // ✅ Mounted correctly

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Handle 404 for undefined API routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
  });
});

module.exports = router;
