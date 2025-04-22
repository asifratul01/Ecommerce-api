const {
  validateEmail,
  validatePassword,
  validateProductInput,
  validateAddress,
  validateCreditCard,
  validatePrice,
} = require('../../../server/utils/validation');
const AppError = require('../../../server/utils/AppError');

describe('Validation Utilities', () => {
  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('firstname.lastname@example.com')).toBe(true);
      expect(validateEmail('email@subdomain.example.com')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(validateEmail('plainaddress')).toBe(false);
      expect(validateEmail('@missingusername.com')).toBe(false);
      expect(validateEmail('user@.com')).toBe(false);
      expect(validateEmail('user@example..com')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      expect(validatePassword('Secure123!')).toBe(true);
      expect(validatePassword('1qaz@WSX')).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(validatePassword('short')).toBe(false);
      expect(validatePassword('noNumbers!')).toBe(false);
      expect(validatePassword('NOCAPITALLETTERS123')).toBe(false);
      expect(validatePassword('NoSpecialChars123')).toBe(false);
    });

    it('should enforce minimum length of 8 characters', () => {
      expect(validatePassword('A1!xyz')).toBe(false);
      expect(validatePassword('A1!xyz78')).toBe(true);
    });
  });

  describe('validateProductInput', () => {
    it('should validate complete product data', () => {
      const validProduct = {
        name: 'Test Product',
        price: 19.99,
        description: 'A test product',
        category: 'electronics',
        stock: 10,
      };
      expect(validateProductInput(validProduct)).toBe(true);
    });

    it('should reject incomplete product data', () => {
      const invalidProduct = {
        price: 19.99,
        description: 'Missing name',
      };
      expect(() => validateProductInput(invalidProduct)).toThrow(AppError);
    });

    it('should validate price is positive number', () => {
      const invalidPrice = {
        name: 'Test',
        price: -10,
        description: 'Test',
      };
      expect(() => validateProductInput(invalidPrice)).toThrow(AppError);
    });
  });

  describe('validateAddress', () => {
    it('should validate complete shipping address', () => {
      const validAddress = {
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        country: 'US',
      };
      expect(validateAddress(validAddress)).toBe(true);
    });

    it('should reject incomplete addresses', () => {
      const missingCity = {
        street: '123 Main St',
        state: 'CA',
        zipCode: '12345',
      };
      expect(() => validateAddress(missingCity)).toThrow(AppError);
    });

    it('should validate zip code format', () => {
      const invalidZip = {
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '1234',
        country: 'US',
      };
      expect(() => validateAddress(invalidZip)).toThrow(AppError);
    });
  });

  describe('validateCreditCard', () => {
    it('should validate correct card numbers', () => {
      expect(validateCreditCard('4111111111111111')).toBe(true); // Visa
      expect(validateCreditCard('5555555555554444')).toBe(true); // Mastercard
      expect(validateCreditCard('378282246310005')).toBe(true); // Amex
    });

    it('should reject invalid card numbers', () => {
      expect(validateCreditCard('4111111111111112')).toBe(false); // Bad check digit
      expect(validateCreditCard('1234567890123456')).toBe(false); // Invalid prefix
      expect(validateCreditCard('4111-1111-1111-1111')).toBe(false); // Contains hyphens
    });

    it('should validate expiration date format', () => {
      expect(validateCreditCard('4111111111111111', '12/25')).toBe(true);
      expect(() => validateCreditCard('4111111111111111', '13/25')).toThrow(AppError);
      expect(() => validateCreditCard('4111111111111111', '12/20')).toThrow(AppError); // Past date
    });
  });

  describe('validatePrice', () => {
    it('should validate positive numbers with 2 decimal places', () => {
      expect(validatePrice(19.99)).toBe(true);
      expect(validatePrice(100)).toBe(true);
      expect(validatePrice(0.99)).toBe(true);
    });

    it('should reject invalid prices', () => {
      expect(() => validatePrice(-10)).toThrow(AppError);
      expect(() => validatePrice('19.99')).toThrow(AppError);
      expect(() => validatePrice(19.999)).toThrow(AppError); // Too many decimals
      expect(() => validatePrice(null)).toThrow(AppError);
    });
  });
});
