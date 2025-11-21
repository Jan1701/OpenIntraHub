/**
 * Express Request/Response Mocks for Testing
 */

/**
 * Create a mock Express request object
 */
const createMockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: null,
  cookies: {},
  get: jest.fn((header) => overrides.headers?.[header]),
  ...overrides
});

/**
 * Create a mock Express response object
 */
const createMockResponse = () => {
  const res = {
    statusCode: 200,
    _json: null,
    _sent: false
  };

  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });

  res.json = jest.fn((data) => {
    res._json = data;
    res._sent = true;
    return res;
  });

  res.send = jest.fn((data) => {
    res._json = data;
    res._sent = true;
    return res;
  });

  res.cookie = jest.fn(() => res);
  res.clearCookie = jest.fn(() => res);
  res.redirect = jest.fn(() => res);
  res.set = jest.fn(() => res);
  res.header = jest.fn(() => res);
  res.type = jest.fn(() => res);
  res.download = jest.fn(() => res);
  res.sendFile = jest.fn(() => res);

  return res;
};

/**
 * Create a mock next function
 */
const createMockNext = () => jest.fn();

/**
 * Helper to create request with authenticated user
 */
const createAuthenticatedRequest = (user, overrides = {}) => {
  return createMockRequest({
    user: {
      userId: user.id || 1,
      username: user.username || 'testuser',
      role: user.role || 'user',
      ...user
    },
    headers: {
      authorization: 'Bearer test-token',
      ...overrides.headers
    },
    ...overrides
  });
};

module.exports = {
  createMockRequest,
  createMockResponse,
  createMockNext,
  createAuthenticatedRequest
};
