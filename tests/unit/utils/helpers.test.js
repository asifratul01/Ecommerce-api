const {
  generateRandomString,
  formatPrice,
  slugify,
  safeJsonParse,
  truncate,
  sleep,
  objectToQueryString,
  isEmpty,
} = require('../../../server/utils/helpers');
const AppError = require('../../../server/utils/AppError');

describe('Helper Functions', () => {
  describe('generateRandomString', () => {
    it('should generate string of specified length', () => {
      const str = generateRandomString(16);
      expect(str.length).toBe(16);
      expect(typeof str).toBe('string');
    });

    it('should throw error for invalid length', () => {
      expect(() => generateRandomString(-1)).toThrow(AppError);
      expect(() => generateRandomString('16')).toThrow(AppError);
    });
  });

  describe('formatPrice', () => {
    it('should format price with currency symbol', () => {
      expect(formatPrice(19.99)).toBe('$19.99');
      expect(formatPrice(1000, 'EUR')).toMatch(/€1,000.00/);
    });

    it('should handle decimal places correctly', () => {
      expect(formatPrice(19.9)).toBe('$19.90');
      expect(formatPrice(19)).toBe('$19.00');
    });

    it('should throw error for invalid amount', () => {
      expect(() => formatPrice('19.99')).toThrow(AppError);
      expect(() => formatPrice(NaN)).toThrow(AppError);
    });
  });

  describe('slugify', () => {
    it('should convert text to URL-friendly slug', () => {
      expect(slugify('Hello World!')).toBe('hello-world');
      expect(slugify('Product Name 123')).toBe('product-name-123');
    });

    it('should handle special characters', () => {
      expect(slugify('Product @#$% Name')).toBe('product-name');
    });

    it('should throw error for non-string input', () => {
      expect(() => slugify(123)).toThrow(AppError);
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON string', () => {
      const obj = { key: 'value' };
      expect(safeJsonParse(JSON.stringify(obj))).toEqual(obj);
    });

    it('should throw error for invalid JSON', () => {
      expect(() => safeJsonParse('invalid json')).toThrow(AppError);
    });
  });

  describe('truncate', () => {
    it('should truncate long text with ellipsis', () => {
      const longText = 'This is a very long text that needs to be truncated';
      expect(truncate(longText, 20)).toBe('This is a very lon...');
    });

    it('should not truncate short text', () => {
      const shortText = 'Short text';
      expect(truncate(shortText, 20)).toBe(shortText);
    });

    it('should use custom ending', () => {
      expect(truncate('Long text', 5, '***')).toBe('Lo***');
    });
  });

  describe('sleep', () => {
    it('should delay execution', async () => {
      const start = Date.now();
      await sleep(100);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(100);
    });
  });

  describe('objectToQueryString', () => {
    it('should convert object to query string', () => {
      const params = { name: 'John', age: 30 };
      expect(objectToQueryString(params)).toBe('name=John&age=30');
    });

    it('should URL encode values', () => {
      expect(objectToQueryString({ search: 'hello world' })).toBe('search=hello%20world');
    });
  });

  describe('isEmpty', () => {
    it('should check if value is empty', () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
      expect(isEmpty('')).toBe(true);
      expect(isEmpty([])).toBe(true);
      expect(isEmpty({})).toBe(true);
      expect(isEmpty('text')).toBe(false);
      expect(isEmpty([1])).toBe(false);
      expect(isEmpty({ key: 'value' })).toBe(false);
    });
  });
});
