const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const { setupDB, teardownDB } = require('./test-setup');
const jwt = require('jsonwebtoken');

describe('Auth Controller', () => {
  beforeAll(async () => {
    await setupDB();
    // Create test user
    await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
      isVerified: true,
    });
  });

  afterAll(async () => {
    await teardownDB();
  });

  describe('POST /api/v1/auth/register', () => {
    test('should register a new user with valid data', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'New User',
          email: 'new@example.com',
          password: 'SecurePass123!',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/verification email sent/i);
    });

    test('should reject weak passwords', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Weak User',
          email: 'weak@example.com',
          password: '123',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.headers['set-cookie']).toBeDefined();
    });

    test('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPass123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    test('should send reset email for valid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should fail silently for non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200); // Security: Don't reveal if email exists

      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/v1/auth/reset-password/:token', () => {
    let resetToken;

    beforeAll(async () => {
      const user = await User.findOne({ email: 'test@example.com' });
      resetToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });
    });

    test('should reset password with valid token', async () => {
      const response = await request(app)
        .put(`/api/v1/auth/reset-password/${resetToken}`)
        .send({
          password: 'NewSecurePass123!',
          confirmPassword: 'NewSecurePass123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject mismatched passwords', async () => {
      const response = await request(app)
        .put(`/api/v1/auth/reset-password/${resetToken}`)
        .send({
          password: 'NewSecurePass123!',
          confirmPassword: 'Mismatched123!',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/verify-email/:token', () => {
    let verificationToken;

    beforeAll(async () => {
      const user = await User.create({
        name: 'Unverified User',
        email: 'unverified@example.com',
        password: 'Password123!',
        isVerified: false,
        verificationToken: 'valid-token-123',
      });
      verificationToken = user.verificationToken;
    });

    test('should verify email with valid token', async () => {
      const response = await request(app)
        .get(`/api/v1/auth/verify-email/${verificationToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject invalid verification token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/verify-email/invalid-token')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/logout', () => {
    test('should clear authentication cookie', async () => {
      const response = await request(app).get('/api/v1/auth/logout').expect(200);

      expect(response.headers['set-cookie'][0]).toMatch(/token=;/);
    });
  });

  describe('Protected Routes', () => {
    let authToken;

    beforeAll(async () => {
      // Login to get valid token
      const user = await User.findOne({ email: 'test@example.com' });
      authToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
      });
    });

    test('should allow access with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `token=${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should block access without token', async () => {
      const response = await request(app).get('/api/v1/auth/me').expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
