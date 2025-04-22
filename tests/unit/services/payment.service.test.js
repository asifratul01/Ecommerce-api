const PaymentService = require('../../../server/services/payment.service');
const Order = require('../../../server/models/Order');
const AppError = require('../../../server/utils/AppError');

// Mock dependencies
jest.mock('../../../server/models/Order');

describe('PaymentService', () => {
  let paymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    paymentService = new PaymentService();
  });

  describe('processPayment', () => {
    it('should process payment successfully for valid order', async () => {
      const mockOrder = {
        _id: 'order123',
        user: 'user123',
        paymentInfo: { status: 'pending' },
        orderStatus: 'pending',
        save: jest.fn().mockResolvedValue(true),
      };
      Order.findById.mockResolvedValue(mockOrder);

      // Mock successful payment processing
      jest.spyOn(paymentService.mockPaymentProcessor, 'processPayment').mockResolvedValue({
        success: true,
        transactionId: 'txn_123',
        message: 'Payment processed successfully',
      });

      const result = await paymentService.processPayment('order123', 'user123', {
        type: 'credit_card',
      });

      expect(Order.findById).toHaveBeenCalledWith('order123');
      expect(paymentService.mockPaymentProcessor.processPayment).toHaveBeenCalledWith(mockOrder, {
        type: 'credit_card',
      });
      expect(mockOrder.paymentInfo).toEqual({
        id: 'txn_123',
        status: 'paid',
        method: 'card',
      });
      expect(mockOrder.orderStatus).toBe('processing');
      expect(mockOrder.save).toHaveBeenCalled();
      expect(result.message).toBe('Payment processed successfully');
    });

    it('should throw error for missing orderId or paymentMethod', async () => {
      await expect(paymentService.processPayment('', 'user123', {})).rejects.toThrow(AppError);
      await expect(paymentService.processPayment('order123', 'user123', null)).rejects.toThrow(
        AppError
      );
    });

    it('should throw error for non-existent order', async () => {
      Order.findById.mockResolvedValue(null);
      await expect(
        paymentService.processPayment('nonexistent', 'user123', { type: 'credit_card' })
      ).rejects.toThrow(AppError);
    });

    it('should throw error for unauthorized user', async () => {
      const mockOrder = { _id: 'order123', user: 'user456' };
      Order.findById.mockResolvedValue(mockOrder);
      await expect(
        paymentService.processPayment('order123', 'user123', { type: 'credit_card' })
      ).rejects.toThrow(AppError);
    });

    it('should throw error for already paid order', async () => {
      const mockOrder = {
        _id: 'order123',
        user: 'user123',
        paymentInfo: { status: 'paid' },
      };
      Order.findById.mockResolvedValue(mockOrder);
      await expect(
        paymentService.processPayment('order123', 'user123', { type: 'credit_card' })
      ).rejects.toThrow(AppError);
    });

    it('should throw error for failed payment', async () => {
      const mockOrder = {
        _id: 'order123',
        user: 'user123',
        paymentInfo: { status: 'pending' },
      };
      Order.findById.mockResolvedValue(mockOrder);
      jest.spyOn(paymentService.mockPaymentProcessor, 'processPayment').mockResolvedValue({
        success: false,
        message: 'Card declined',
      });

      await expect(
        paymentService.processPayment('order123', 'user123', { type: 'credit_card' })
      ).rejects.toThrow(AppError);
    });
  });

  describe('getPaymentStatus', () => {
    it('should return payment status for order owner', async () => {
      const mockOrder = {
        _id: 'order123',
        user: 'user123',
        paymentInfo: {
          status: 'paid',
          method: 'card',
          id: 'txn_123',
        },
      };
      Order.findById.mockResolvedValue(mockOrder);

      const result = await paymentService.getPaymentStatus('order123', 'user123', 'customer');

      expect(Order.findById).toHaveBeenCalledWith('order123');
      expect(result).toEqual({
        paymentStatus: 'paid',
        paymentDetails: mockOrder.paymentInfo,
      });
    });

    it('should return payment status for admin', async () => {
      const mockOrder = {
        _id: 'order123',
        user: 'user456',
        paymentInfo: { status: 'paid' },
      };
      Order.findById.mockResolvedValue(mockOrder);

      const result = await paymentService.getPaymentStatus('order123', 'admin123', 'admin');

      expect(result.paymentStatus).toBe('paid');
    });

    it('should throw error for unauthorized access', async () => {
      const mockOrder = { _id: 'order123', user: 'user456' };
      Order.findById.mockResolvedValue(mockOrder);
      await expect(
        paymentService.getPaymentStatus('order123', 'user123', 'customer')
      ).rejects.toThrow(AppError);
    });

    it('should throw error for non-existent order', async () => {
      Order.findById.mockResolvedValue(null);
      await expect(
        paymentService.getPaymentStatus('nonexistent', 'user123', 'customer')
      ).rejects.toThrow(AppError);
    });
  });

  describe('processRefund', () => {
    it('should process refund for paid order', async () => {
      const mockOrder = {
        _id: 'order123',
        paymentInfo: { status: 'paid' },
        orderStatus: 'completed',
        save: jest.fn().mockResolvedValue(true),
      };
      Order.findById.mockResolvedValue(mockOrder);

      const result = await paymentService.processRefund('order123');

      expect(Order.findById).toHaveBeenCalledWith('order123');
      expect(mockOrder.orderStatus).toBe('refunded');
      expect(mockOrder.paymentInfo.status).toBe('refunded');
      expect(mockOrder.save).toHaveBeenCalled();
      expect(result.message).toBe('Refund processed successfully');
    });

    it('should throw error for non-paid order', async () => {
      const mockOrder = {
        _id: 'order123',
        paymentInfo: { status: 'pending' },
      };
      Order.findById.mockResolvedValue(mockOrder);
      await expect(paymentService.processRefund('order123')).rejects.toThrow(AppError);
    });

    it('should throw error for already refunded order', async () => {
      const mockOrder = {
        _id: 'order123',
        paymentInfo: { status: 'refunded' },
        orderStatus: 'refunded',
      };
      Order.findById.mockResolvedValue(mockOrder);
      await expect(paymentService.processRefund('order123')).rejects.toThrow(AppError);
    });

    it('should throw error for non-existent order', async () => {
      Order.findById.mockResolvedValue(null);
      await expect(paymentService.processRefund('nonexistent')).rejects.toThrow(AppError);
    });
  });
});
