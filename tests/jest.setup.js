const { setupDB, teardownDB } = require('./test-setup');
const mongoose = require('mongoose');

// Global timeout
jest.setTimeout(30000);

// Clean console output
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

// Database setup
beforeAll(async () => {
  await setupDB();
});

// Database cleanup
afterAll(async () => {
  await teardownDB();
  await mongoose.disconnect();
});

// Reset all mocks after each test
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

// Custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    return {
      message: () => `expected ${received} to be within range ${floor}-${ceiling}`,
      pass,
    };
  },
});
