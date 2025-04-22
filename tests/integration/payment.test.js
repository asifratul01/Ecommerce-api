const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const {
  setupDB,
  teardownDB,
  createTestUser,
  createTestOrder,
  getAuthToken,
} = require('./test-setup');
const Payment = require('../../models/Payment');
const Order = require('../../models/Order');

describe('Payment API Integration Tests', () => {
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

  describe('POST /api/payments/process', () => {
    it('should process a payment successfully', async () => {
      const mockPaymentDetails = {
        orderId: testOrder._id,
        paymentMethod: 'credit_card',
        cardDetails: {
          number: '4242424242424242',
          expMonth: '12',
          expYear: '2025',
          cvc: '123',
        },
        amount: testOrder.totalAmount,
      };

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockPaymentDetails);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'completed',
        orderId: testOrder._id.toString(),
        amount: testOrder.totalAmount,
      });

      // Verify payment record was created
      const payment = await Payment.findOne({ order: testOrder._id });
      expect(payment).not.toBeNull();
      expect(payment.status).toBe('completed');

      // Verify order status was updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.status).toBe('processing');
    });

    it('should fail with invalid card details', async () => {
      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrder._id,
          paymentMethod: 'credit_card',
          cardDetails: {
            number: '4000000000000002', // Test card that always fails
            expMonth: '12',
            expYear: '2025',
            cvc: '123',
          },
          amount: testOrder.totalAmount,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/payment failed/i);

      // Verify failed payment was recorded
      const payment = await Payment.findOne({ order: testOrder._id });
      expect(payment.status).toBe('failed');
    });

    it("should return 403 when paying for another user's order", async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const otherOrder = await createTestOrder(otherUser._id);

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: otherOrder._id,
          paymentMethod: 'credit_card',
          amount: otherOrder.totalAmount,
        });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/payments/:paymentId', () => {
    it('should retrieve payment details', async () => {
      // First create a payment
      const payment = await Payment.create({
        order: testOrder._id,
        user: testUser._id,
        amount: testOrder.totalAmount,
        status: 'completed',
      });

      const response = await request(app)
        .get(`/api/payments/${payment._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(payment._id.toString());
      expect(response.body.amount).toBe(testOrder.totalAmount);
    });

    it('should return 404 for non-existent payment', async () => {
      const response = await request(app)
        .get(`/api/payments/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/payments/webhook', () => {
    it('should process payment webhook notifications', async () => {
      const testPayment = await Payment.create({
        order: testOrder._id,
        user: testUser._id,
        amount: testOrder.totalAmount,
        status: 'pending',
        paymentIntentId: 'pi_test123',
      });

      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test123',
            amount: testOrder.totalAmount * 100,
            status: 'succeeded',
          },
        },
      };

      const response = await request(app).post('/api/payments/webhook').send(webhookPayload);

      expect(response.status).toBe(200);

      // Verify payment status was updated
      const updatedPayment = await Payment.findById(testPayment._id);
      expect(updatedPayment.status).toBe('completed');

      // Verify order status was updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.status).toBe('processing');
    });
  });

  describe('POST /api/payments/refund', () => {
    it('should process refund for completed payment', async () => {
      const completedPayment = await Payment.create({
        order: testOrder._id,
        user: testUser._id,
        amount: testOrder.totalAmount,
        status: 'completed',
        paymentIntentId: 'pi_test456',
      });

      const response = await request(app)
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentId: completedPayment._id,
          amount: testOrder.totalAmount,
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('refunded');

      // Verify payment status was updated
      const refundedPayment = await Payment.findById(completedPayment._id);
      expect(refundedPayment.status).toBe('refunded');
    });

    it('should not refund non-completed payments', async () => {
      const pendingPayment = await Payment.create({
        order: testOrder._id,
        user: testUser._id,
        amount: testOrder.totalAmount,
        status: 'pending',
      });

      const response = await request(app)
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentId: pendingPayment._id,
          amount: pendingPayment.amount,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/cannot refund/i);
    });
  });
});
