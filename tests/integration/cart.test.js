const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Cart = require('../../models/Cart');
const Product = require('../../models/Product');
const { setupDB, teardownDB, createTestUser, getAuthToken } = require('./test-setup');

describe('Cart API Integration Tests', () => {
  let authToken;
  let testUser;
  let testProduct;

  beforeAll(async () => {
    await setupDB();
    testUser = await createTestUser();
    authToken = getAuthToken(testUser);

    // Create a test product
    testProduct = await Product.create({
      name: 'Test Product',
      price: 99.99,
      description: 'Test description',
      stock: 10,
    });
  });

  afterEach(async () => {
    await Cart.deleteMany({});
  });

  afterAll(async () => {
    await teardownDB();
  });

  describe('POST /api/cart', () => {
    it('should add item to cart', async () => {
      const response = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProduct._id,
          quantity: 2,
        });

      expect(response.status).toBe(201);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].productId).toBe(testProduct._id.toString());
      expect(response.body.items[0].quantity).toBe(2);
    });

    it('should update quantity if product already in cart', async () => {
      // First add
      await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ productId: testProduct._id, quantity: 1 });

      // Second add (should update quantity)
      const response = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ productId: testProduct._id, quantity: 3 });

      expect(response.status).toBe(200);
      expect(response.body.items[0].quantity).toBe(4);
    });

    it('should return 400 for invalid product', async () => {
      const response = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ productId: 'invalid-id', quantity: 1 });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/cart', () => {
    it('should retrieve user cart', async () => {
      // Add item first
      await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ productId: testProduct._id, quantity: 1 });

      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.total).toBe(99.99);
    });

    it('should return empty cart if no items', async () => {
      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });
  });

  describe('DELETE /api/cart/:itemId', () => {
    it('should remove item from cart', async () => {
      // Add item first
      const addResponse = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ productId: testProduct._id, quantity: 1 });

      const itemId = addResponse.body.items[0]._id;

      const response = await request(app)
        .delete(`/api/cart/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(0);
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(app)
        .delete(`/api/cart/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/cart/clear', () => {
    it('should clear all items from cart', async () => {
      // Add items first
      await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ productId: testProduct._id, quantity: 2 });

      const response = await request(app)
        .put('/api/cart/clear')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });
  });
});
