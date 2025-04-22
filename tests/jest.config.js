module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Where to find tests
  roots: ['<rootDir>/tests'],

  // File patterns to consider as tests
  testMatch: ['**/integration/**/*.test.js', '**/unit/**/*.test.js'],

  // Module path aliases (adjust according to your project)
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/server/config/$1',
    '^@controllers/(.*)$': '<rootDir>/server/controllers/$1',
    '^@services/(.*)$': '<rootDir>/server/services/$1',
    '^@utils/(.*)$': '<rootDir>/server/utils/$1',
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  globalSetup: '<rootDir>/tests/test-setup.js',

  // Code coverage
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'server/controllers/**/*.js',
    'server/services/**/*.js',
    'server/utils/**/*.js',
    '!**/node_modules/**',
    '!**/__mocks__/**',
  ],

  // Coverage thresholds (adjust as needed)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Transform settings
  transform: {
    '^.+\\.js$': 'babel-jest',
  },

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/server/public/'],

  // Slow test warning (in ms)
  slowTestThreshold: 5000,
};
