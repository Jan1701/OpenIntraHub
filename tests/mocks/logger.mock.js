/**
 * Logger Mock for Testing
 */

const createMockLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn()
});

const mockLogger = createMockLogger();

const createModuleLogger = jest.fn(() => mockLogger);

const resetMocks = () => {
  mockLogger.info.mockReset();
  mockLogger.error.mockReset();
  mockLogger.warn.mockReset();
  mockLogger.debug.mockReset();
  mockLogger.verbose.mockReset();
  createModuleLogger.mockClear();
};

module.exports = {
  logger: mockLogger,
  createModuleLogger,
  createMockLogger,
  resetMocks
};
