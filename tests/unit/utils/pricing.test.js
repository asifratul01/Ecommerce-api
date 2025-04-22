const {
  calculateSubtotal,
  applyDiscount,
  calculateTax,
  calculateShipping,
  calculateTotal,
} = require('../../../server/utils/pricing');
const AppError = require('../../../server/utils/AppError');

describe('Pricing Utilities', () => {
  describe('calculateSubtotal', () => {
    it('should calculate subtotal for multiple items', () => {
      const items = [
        { price: 10.99, quantity: 2 },
        { price: 5.99, quantity: 3 },
      ];
      expect(calculateSubtotal(items)).toBeCloseTo(10.99 * 2 + 5.99 * 3);
    });

    it('should return 0 for empty cart', () => {
      expect(calculateSubtotal([])).toBe(0);
    });

    it('should handle single item', () => {
      expect(calculateSubtotal([{ price: 19.99, quantity: 1 }])).toBe(19.99);
    });
  });

  describe('applyDiscount', () => {
    it('should apply percentage discount correctly', () => {
      expect(applyDiscount(100, { type: 'percentage', value: 10 })).toBe(90);
    });

    it('should apply fixed amount discount correctly', () => {
      expect(applyDiscount(100, { type: 'fixed', value: 15 })).toBe(85);
    });

    it('should not return negative values', () => {
      expect(applyDiscount(10, { type: 'fixed', value: 15 })).toBe(0);
    });

    it('should throw error for invalid discount type', () => {
      expect(() => applyDiscount(100, { type: 'invalid', value: 10 })).toThrow(AppError);
    });
  });

  describe('calculateTax', () => {
    it('should calculate tax correctly', () => {
      expect(calculateTax(100, 0.08)).toBe(8);
    });

    it('should handle zero tax rate', () => {
      expect(calculateTax(100, 0)).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      expect(calculateTax(99.99, 0.075)).toBe(7.5);
    });
  });

  describe('calculateShipping', () => {
    it('should apply flat rate shipping', () => {
      expect(calculateShipping(100, { method: 'flat', rate: 5 })).toBe(5);
    });

    it('should apply free shipping over threshold', () => {
      expect(
        calculateShipping(200, {
          method: 'threshold',
          rate: 10,
          freeThreshold: 150,
        })
      ).toBe(0);
    });

    it('should apply shipping when below threshold', () => {
      expect(
        calculateShipping(100, {
          method: 'threshold',
          rate: 10,
          freeThreshold: 150,
        })
      ).toBe(10);
    });

    it('should throw error for invalid shipping method', () => {
      expect(() => calculateShipping(100, { method: 'invalid' })).toThrow(AppError);
    });
  });

  describe('calculateTotal', () => {
    it('should calculate complete order total', () => {
      const order = {
        subtotal: 100,
        discount: { type: 'percentage', value: 10 },
        taxRate: 0.08,
        shipping: { method: 'flat', rate: 5 },
      };

      // 100 - 10% = 90
      // Tax = 90 * 0.08 = 7.20
      // Shipping = 5
      // Total = 90 + 7.20 + 5 = 102.20
      expect(calculateTotal(order)).toBe(102.2);
    });

    it('should handle free shipping threshold', () => {
      const order = {
        subtotal: 200,
        discount: { type: 'fixed', value: 20 },
        taxRate: 0.05,
        shipping: {
          method: 'threshold',
          rate: 10,
          freeThreshold: 150,
        },
      };

      // 200 - 20 = 180
      // Tax = 180 * 0.05 = 9
      // Shipping = 0 (over threshold)
      // Total = 180 + 9 = 189
      expect(calculateTotal(order)).toBe(189);
    });

    it('should validate required fields', () => {
      expect(() => calculateTotal({})).toThrow(AppError);
    });
  });
});
