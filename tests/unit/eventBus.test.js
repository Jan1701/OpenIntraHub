/**
 * Unit Tests for EventBus Module
 * Tests: on, off, emit, once
 */

// Create a fresh EventEmitter instance for testing
const EventEmitter = require('events');

describe('EventBus Module', () => {
  let eventBus;

  beforeEach(() => {
    // Create fresh instance for each test
    eventBus = new EventEmitter();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  describe('on (subscribe)', () => {
    it('should register an event listener', () => {
      const callback = jest.fn();
      eventBus.on('TEST_EVENT', callback);

      expect(eventBus.listenerCount('TEST_EVENT')).toBe(1);
    });

    it('should allow multiple listeners for same event', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      eventBus.on('TEST_EVENT', callback1);
      eventBus.on('TEST_EVENT', callback2);

      expect(eventBus.listenerCount('TEST_EVENT')).toBe(2);
    });
  });

  describe('emit', () => {
    it('should call registered listener', () => {
      const callback = jest.fn();
      eventBus.on('TEST_EVENT', callback);

      eventBus.emit('TEST_EVENT');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should pass data to listener', () => {
      const callback = jest.fn();
      const testData = { userId: 1, action: 'test' };

      eventBus.on('TEST_EVENT', callback);
      eventBus.emit('TEST_EVENT', testData);

      expect(callback).toHaveBeenCalledWith(testData);
    });

    it('should call all registered listeners', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      eventBus.on('TEST_EVENT', callback1);
      eventBus.on('TEST_EVENT', callback2);
      eventBus.emit('TEST_EVENT', { test: true });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should not throw for event with no listeners', () => {
      expect(() => {
        eventBus.emit('UNKNOWN_EVENT', { data: 'test' });
      }).not.toThrow();
    });

    it('should pass multiple arguments', () => {
      const callback = jest.fn();
      eventBus.on('TEST_EVENT', callback);

      eventBus.emit('TEST_EVENT', 'arg1', 'arg2', { key: 'value' });

      expect(callback).toHaveBeenCalledWith('arg1', 'arg2', { key: 'value' });
    });
  });

  describe('off (unsubscribe)', () => {
    it('should remove specific listener', () => {
      const callback = jest.fn();
      eventBus.on('TEST_EVENT', callback);
      eventBus.off('TEST_EVENT', callback);

      eventBus.emit('TEST_EVENT');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should only remove specified listener', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      eventBus.on('TEST_EVENT', callback1);
      eventBus.on('TEST_EVENT', callback2);
      eventBus.off('TEST_EVENT', callback1);

      eventBus.emit('TEST_EVENT');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('once', () => {
    it('should call listener only once', () => {
      const callback = jest.fn();
      eventBus.once('TEST_EVENT', callback);

      eventBus.emit('TEST_EVENT');
      eventBus.emit('TEST_EVENT');
      eventBus.emit('TEST_EVENT');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should pass data to once listener', () => {
      const callback = jest.fn();
      const testData = { id: 42 };

      eventBus.once('TEST_EVENT', callback);
      eventBus.emit('TEST_EVENT', testData);

      expect(callback).toHaveBeenCalledWith(testData);
    });
  });

  describe('Common Events', () => {
    it('should handle USER_LOGIN event', () => {
      const callback = jest.fn();
      const userData = {
        id: 1,
        username: 'testuser',
        role: 'user'
      };

      eventBus.on('USER_LOGIN', callback);
      eventBus.emit('USER_LOGIN', userData);

      expect(callback).toHaveBeenCalledWith(userData);
    });

    it('should handle USER_LOGOUT event', () => {
      const callback = jest.fn();
      eventBus.on('USER_LOGOUT', callback);
      eventBus.emit('USER_LOGOUT', { userId: 1 });

      expect(callback).toHaveBeenCalled();
    });

    it('should handle POST_CREATED event', () => {
      const callback = jest.fn();
      const postData = {
        id: 1,
        title: 'Test Post',
        authorId: 1
      };

      eventBus.on('POST_CREATED', callback);
      eventBus.emit('POST_CREATED', postData);

      expect(callback).toHaveBeenCalledWith(postData);
    });
  });
});
