/**
 * Jest Configuration for OpenIntraHub Backend
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Root directories
  roots: ['<rootDir>/tests'],

  // Test file patterns
  testMatch: [
    '**/*.test.js',
    '**/*.spec.js'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'core/**/*.js',
    '!core/app.js', // Entry point
    '!**/node_modules/**'
  ],

  coverageDirectory: 'coverage',

  coverageReporters: ['text', 'lcov', 'html'],

  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module paths
  moduleDirectories: ['node_modules', '<rootDir>'],

  // Timeouts
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true,

  // Global variables
  globals: {
    'process.env.NODE_ENV': 'test'
  }
};
