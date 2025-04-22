const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app'); // Adjust path as needed
const {
  setupDB,
  teardownDB,
  createTestUser,
  createTestOrder,
  getAuthToken,
} = require('./test-setup');
const Order = require('../../models/Order');

describe('Order API Integration Tests', () => {
  let authToken;
  let testUser;
  let testOrder;

  beforeAll(async () => {
    await setupDB();
    testUser = await createTestUser();
    authToken = getAuthToken(testUser);
    testOrder = await createTestOrder(testUser._id);
  });

  afterAll(async () => {
    await teardownDB();
  });

  describe('POST /api/orders', () => {
    it('should create a new order with valid data', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              productId: new mongoose.Types.ObjectId().toString(),
              name: 'Premium Product',
              quantity: 2,
              price: 49.99,
            },
          ],
          shippingAddress: '456 Order Avenue',
          paymentMethod: 'credit_card',
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        status: 'processing',
        shippingAddress: '456 Order Avenue',
        totalAmount: 99.98,
      });
    });

    it('should return 400 when creating order with empty items', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [],
          shippingAddress: '123 Test Street',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/items.*required/i);
    });
  });

  describe('GET /api/orders', () => {
    it('should retrieve all orders for authenticated user', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].user).toBe(testUser._id.toString());
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).get('/api/orders');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/orders/:orderId', () => {
    it('should retrieve specific order details', async () => {
      const response = await request(app)
        .get(`/api/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(testOrder._id.toString());
      expect(response.body.items[0].name).toBe('Test Product');
    });

    it("should return 403 when accessing another user's order", async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const otherOrder = await createTestOrder(otherUser._id);

      const response = await request(app)
        .get(`/api/orders/${otherOrder._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/orders/:orderId/status', () => {
    it('should update order status for admin users', async () => {
      // Create admin user
      const adminUser = await createTestUser({ role: 'admin' });
      const adminToken = getAuthToken(adminUser);

      const response = await request(app)
        .patch(`/api/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'shipped' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('shipped');

      // Verify in database
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.status).toBe('shipped');
    });

    it('should prevent non-admin users from updating status', async () => {
      const response = await request(app)
        .patch(`/api/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'shipped' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/orders/:orderId', () => {
    it('should cancel an order', async () => {
      const order = await createTestOrder(testUser._id); // New order in processing state

      const response = await request(app)
        .delete(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toMatch(/cancelled/i);

      // Verify status changed to cancelled
      const cancelledOrder = await Order.findById(order._id);
      expect(cancelledOrder.status).toBe('cancelled');
    });

    it('should not allow cancelling shipped orders', async () => {
      const shippedOrder = await createTestOrder(testUser._id, [], 'shipped');

      const response = await request(app)
        .delete(`/api/orders/${shippedOrder._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/cannot cancel/i);
    });
  });
});
