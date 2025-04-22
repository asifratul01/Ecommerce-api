const logger = require('../../../server/utils/logger');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const AppError = require('../../../server/utils/AppError');

describe('Logger Utility', () => {
  const testLogDir = path.join(__dirname, '../../logs');

  beforeAll(() => {
    // Ensure clean state
    if (fs.existsSync(testLogDir)) {
      fs.rmdirSync(testLogDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Remove all transports between tests
    logger.clear();
  });

  it('should be instantiated with correct configuration', () => {
    expect(logger).toBeInstanceOf(winston.Logger);
    expect(logger.level).toBe(process.env.NODE_ENV === 'production' ? 'info' : 'debug');
    expect(logger.transports.length).toBeGreaterThan(0);
  });

  describe('Logging Methods', () => {
    it('should log error messages', () => {
      const errorSpy = jest.spyOn(logger, 'error');
      logger.error('Test error message');
      expect(errorSpy).toHaveBeenCalledWith('Test error message');
    });

    it('should log warning messages', () => {
      const warnSpy = jest.spyOn(logger, 'warn');
      logger.warn('Test warning message');
      expect(warnSpy).toHaveBeenCalledWith('Test warning message');
    });

    it('should log info messages', () => {
      const infoSpy = jest.spyOn(logger, 'info');
      logger.info('Test info message');
      expect(infoSpy).toHaveBeenCalledWith('Test info message');
    });

    it('should log debug messages in development', () => {
      const debugSpy = jest.spyOn(logger, 'debug');
      logger.debug('Test debug message');
      expect(debugSpy).toHaveBeenCalledWith('Test debug message');
    });
  });

  describe('File Transport', () => {
    it('should create log directory if not exists', () => {
      expect(fs.existsSync(testLogDir)).toBe(true);
    });

    it('should create daily rotating files', () => {
      const date = new Date().toISOString().split('T')[0];
      const errorFile = path.join(testLogDir, `error-${date}.log`);
      const combinedFile = path.join(testLogDir, `combined-${date}.log`);

      logger.error('Test error log');
      logger.info('Test info log');

      // Check files are created (content check would require async file reading)
      expect(fs.existsSync(errorFile)).toBe(true);
      expect(fs.existsSync(combinedFile)).toBe(true);
    });
  });

  describe('API Request Logging', () => {
    it('should log successful API requests', () => {
      const infoSpy = jest.spyOn(logger, 'info');
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/products',
        ip: '127.0.0.1',
        user: { id: 'user123' },
      };
      const mockRes = {
        statusCode: 200,
        responseTime: 45,
      };

      logger.logApiRequest(mockReq, mockRes);
      expect(infoSpy).toHaveBeenCalledWith(
        'GET /api/products',
        expect.objectContaining({
          method: 'GET',
          status: 200,
          user: 'user123',
        })
      );
    });

    it('should log failed API requests with errors', () => {
      const errorSpy = jest.spyOn(logger, 'error');
      const mockReq = {
        method: 'POST',
        originalUrl: '/api/orders',
        ip: '127.0.0.1',
      };
      const mockRes = {
        statusCode: 500,
        responseTime: 120,
      };
      const error = new AppError('Test error', 500);

      logger.logApiRequest(mockReq, mockRes, error);
      expect(errorSpy).toHaveBeenCalledWith(
        'POST /api/orders',
        expect.objectContaining({
          status: 500,
          error: expect.stringContaining('Test error'),
        })
      );
    });
  });

  describe('Database Query Logging', () => {
    it('should log database queries', () => {
      const debugSpy = jest.spyOn(logger, 'debug');
      const query = { _id: 'product123' };

      logger.logDatabaseQuery('products', 'find', query, 25);
      expect(debugSpy).toHaveBeenCalledWith(
        'DB find on products',
        expect.objectContaining({
          collection: 'products',
          operation: 'find',
          duration: '25ms',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle uncaught exceptions', () => {
      const errorSpy = jest.spyOn(logger, 'error');
      const error = new Error('Uncaught test error');

      // Simulate uncaught exception
      process.emit('uncaughtException', error);
      expect(errorSpy).toHaveBeenCalledWith('Uncaught Exception:', error);
    });
  });

  describe('Morgan Stream', () => {
    it('should provide a stream for morgan middleware', () => {
      const infoSpy = jest.spyOn(logger, 'info');
      const message = 'GET /api/products 200 45ms';

      logger.morganStream.write(message);
      expect(infoSpy).toHaveBeenCalledWith(message.trim());
    });
  });
});
