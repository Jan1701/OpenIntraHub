/**
 * Database Mock for Testing
 */

const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
  on: jest.fn()
};

const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

// Default mock implementations
mockPool.connect.mockResolvedValue(mockClient);
mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

// Helper to reset all mocks
const resetMocks = () => {
  mockPool.query.mockReset();
  mockPool.connect.mockReset();
  mockPool.end.mockReset();
  mockClient.query.mockReset();
  mockClient.release.mockReset();

  // Restore default implementations
  mockPool.connect.mockResolvedValue(mockClient);
  mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
  mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
};

// Helper to mock query results
const mockQueryResult = (rows, rowCount = null) => {
  mockPool.query.mockResolvedValueOnce({
    rows,
    rowCount: rowCount !== null ? rowCount : rows.length
  });
};

// Helper to mock query error
const mockQueryError = (error) => {
  mockPool.query.mockRejectedValueOnce(error);
};

module.exports = {
  pool: mockPool,
  client: mockClient,
  query: mockPool.query,
  resetMocks,
  mockQueryResult,
  mockQueryError
};
