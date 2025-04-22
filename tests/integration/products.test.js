const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const { setupDB, teardownDB, createTestUser, getAuthToken } = require('./test-setup');
const Product = require('../../models/Product');
const Category = require('../../models/Category');

describe('Product API Integration Tests', () => {
  let authToken;
  let adminToken;
  let testCategory;
  let testProduct;

  beforeAll(async () => {
    await setupDB();

    // Create regular user and admin user
    const regularUser = await createTestUser();
    const adminUser = await createTestUser({
      email: 'admin@example.com',
      role: 'admin',
    });

    authToken = getAuthToken(regularUser);
    adminToken = getAuthToken(adminUser);

    // Create test category
    testCategory = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
    });

    // Create test product
    testProduct = await Product.create({
      name: 'Test Product',
      price: 99.99,
      description: 'Test description',
      category: testCategory._id,
      stock: 10,
      images: [{ url: 'image1.jpg' }],
    });
  });

  afterAll(async () => {
    await teardownDB();
  });

  describe('GET /api/products', () => {
    it('should retrieve all products', async () => {
      const response = await request(app).get('/api/products').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('price');
    });

    it('should filter products by category', async () => {
      const response = await request(app)
        .get(`/api/products?category=${testCategory._id}`)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].category._id).toBe(testCategory._id.toString());
    });

    it('should search products by name', async () => {
      const response = await request(app).get('/api/products?search=Test').expect(200);

      expect(response.body[0].name).toMatch(/Test/i);
    });
  });

  describe('GET /api/products/:id', () => {
    it('should retrieve a single product', async () => {
      const response = await request(app).get(`/api/products/${testProduct._id}`).expect(200);

      expect(response.body._id).toBe(testProduct._id.toString());
      expect(response.body.name).toBe('Test Product');
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get(`/api/products/${new mongoose.Types.ObjectId()}`)
        .expect(404);
    });
  });

  describe('POST /api/products', () => {
    it('should create a new product (admin only)', async () => {
      const newProduct = {
        name: 'New Product',
        price: 199.99,
        description: 'Premium product',
        category: testCategory._id,
        stock: 5,
        images: [{ url: 'new-image.jpg' }],
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newProduct)
        .expect(201);

      expect(response.body.name).toBe('New Product');
      expect(response.body.price).toBe(199.99);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Should Fail',
          price: 9.99,
        })
        .expect(403);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          path: 'name',
          message: 'Product name is required',
        })
      );
    });
  });

  describe('PUT /api/products/:id', () => {
    it('should update a product (admin only)', async () => {
      const updates = {
        name: 'Updated Product',
        price: 89.99,
        stock: 20,
      };

      const response = await request(app)
        .put(`/api/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.name).toBe('Updated Product');
      expect(response.body.price).toBe(89.99);
    });

    it('should prevent unauthorized updates', async () => {
      const response = await request(app)
        .put(`/api/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Should Fail' })
        .expect(403);
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('should delete a product (admin only)', async () => {
      const productToDelete = await Product.create({
        name: 'To Delete',
        price: 9.99,
        category: testCategory._id,
      });

      await request(app)
        .delete(`/api/products/${productToDelete._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // Verify deletion
      const deletedProduct = await Product.findById(productToDelete._id);
      expect(deletedProduct).toBeNull();
    });

    it('should prevent unauthorized deletion', async () => {
      const response = await request(app)
        .delete(`/api/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('GET /api/products/categories', () => {
    it('should retrieve all categories', async () => {
      const response = await request(app).get('/api/products/categories').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0].name).toBe('Electronics');
    });
  });
});
