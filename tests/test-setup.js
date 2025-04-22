const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const User = require('../server/models/User');
const Order = require('../server/models/Order');
const jwt = require('../server/utils/jwtToken');

let mongoServer;

module.exports = {
  setupDB: async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  },

  teardownDB: async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  },

  // Test utility functions
  createTestUser: async (userData = {}) => {
    return await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'test1234',
      ...userData,
    });
  },

  createTestOrder: async (userId, items = []) => {
    return await Order.create({
      user: userId,
      items: items.length
        ? items
        : [
            {
              productId: new mongoose.Types.ObjectId(),
              name: 'Test Product',
              quantity: 1,
              price: 99.99,
            },
          ],
      totalAmount: items.reduce((sum, item) => sum + item.price * item.quantity, 0) || 99.99,
      shippingAddress: '123 Test St',
      status: 'processing',
    });
  },

  getAuthToken: user => {
    return jwt.generateToken({ id: user._id });
  },
};
