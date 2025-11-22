/**
 * Unit Tests for Chat Service
 * Tests: Conversations, Messages, Participants
 */

process.env.JWT_SECRET = 'test-secret-key-for-testing-only-12345678901234567890';
process.env.NODE_ENV = 'test';

// Mock logger first
jest.mock('../../core/logger', () => ({
  createModuleLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

const databaseMock = require('../mocks/database.mock');
jest.mock('../../core/database', () => require('../mocks/database.mock'));

const chatService = require('../../core/chatService');

describe('Chat Service', () => {
  beforeEach(() => {
    databaseMock.resetMocks();
    jest.clearAllMocks();
  });

  describe('Conversations', () => {
    describe('getOrCreateDirectConversation', () => {
      it('should return existing conversation id', async () => {
        databaseMock.mockQueryResult([{ conversation_id: 123 }]);

        const result = await chatService.getOrCreateDirectConversation(1, 2);

        expect(result).toBe(123);
        expect(databaseMock.query).toHaveBeenCalledWith(
          expect.stringContaining('get_or_create_direct_conversation'),
          [1, 2]
        );
      });

      it('should handle database error', async () => {
        databaseMock.mockQueryError(new Error('DB Error'));

        await expect(
          chatService.getOrCreateDirectConversation(1, 2)
        ).rejects.toThrow('DB Error');
      });
    });

    describe('createGroupConversation', () => {
      it('should create group conversation with members', async () => {
        const mockConversation = {
          id: 1,
          type: 'group',
          name: 'Test Group',
          description: 'Test description',
          created_by: 1
        };
        databaseMock.mockQueryResult([mockConversation]);

        const result = await chatService.createGroupConversation(1, {
          name: 'Test Group',
          description: 'Test description',
          member_ids: [2, 3]
        });

        expect(result.name).toBe('Test Group');
        expect(result.type).toBe('group');
      });

      it('should create group without additional members', async () => {
        const mockConversation = {
          id: 1,
          type: 'group',
          name: 'Solo Group',
          created_by: 1
        };
        databaseMock.mockQueryResult([mockConversation]);

        const result = await chatService.createGroupConversation(1, {
          name: 'Solo Group'
        });

        expect(result.name).toBe('Solo Group');
      });

      it('should handle duplicate member ids', async () => {
        const mockConversation = {
          id: 1,
          type: 'group',
          name: 'Test Group',
          created_by: 1
        };
        databaseMock.mockQueryResult([mockConversation]);

        const result = await chatService.createGroupConversation(1, {
          name: 'Test Group',
          member_ids: [2, 2, 3, 3]
        });

        expect(result).toBeDefined();
      });
    });

    describe('getConversationById', () => {
      it('should return conversation with details', async () => {
        const mockConversation = {
          id: 1,
          type: 'direct',
          participant_count: 2,
          last_message: null
        };
        databaseMock.mockQueryResult([mockConversation]);

        const result = await chatService.getConversationById(1, 1);

        expect(result.id).toBe(1);
        expect(result.participant_count).toBe(2);
      });

      it('should handle non-existent conversation', async () => {
        databaseMock.mockQueryResult([]);

        const result = await chatService.getConversationById(999, 1);

        // Returns first row which is undefined when empty
        expect(result).toBeFalsy();
      });
    });

    describe('getUserConversations', () => {
      it('should return user conversations', async () => {
        const mockConversations = [
          { id: 1, type: 'direct', unread_count: 5 },
          { id: 2, type: 'group', unread_count: 0 }
        ];
        databaseMock.mockQueryResult(mockConversations);

        const result = await chatService.getUserConversations(1);

        expect(result).toHaveLength(2);
        expect(result[0].unread_count).toBe(5);
      });

      it('should return empty array for no conversations', async () => {
        databaseMock.mockQueryResult([]);

        const result = await chatService.getUserConversations(1);

        expect(result).toHaveLength(0);
      });
    });
  });

  describe('Messages', () => {
    describe('sendMessage', () => {
      it('should send text message', async () => {
        const mockMessage = {
          id: 1,
          conversation_id: 1,
          sender_id: 1,
          content: 'Hello!',
          message_type: 'text'
        };
        databaseMock.mockQueryResult([mockMessage]);

        const result = await chatService.sendMessage(1, 1, {
          content: 'Hello!'
        });

        expect(result.content).toBe('Hello!');
        expect(result.message_type).toBe('text');
      });

      it('should send message with attachment', async () => {
        const mockMessage = {
          id: 1,
          conversation_id: 1,
          sender_id: 1,
          content: 'Check this file',
          message_type: 'file',
          attachment_url: '/files/doc.pdf'
        };
        databaseMock.mockQueryResult([mockMessage]);

        const result = await chatService.sendMessage(1, 1, {
          content: 'Check this file',
          message_type: 'file',
          attachment_url: '/files/doc.pdf'
        });

        expect(result.message_type).toBe('file');
        expect(result.attachment_url).toBe('/files/doc.pdf');
      });

      it('should handle send error', async () => {
        databaseMock.mockQueryError(new Error('Send failed'));

        await expect(
          chatService.sendMessage(1, 1, { content: 'Test' })
        ).rejects.toThrow('Send failed');
      });
    });

    describe('getConversationMessages', () => {
      it('should return messages for conversation in chronological order', async () => {
        // Mock returns DESC order, function reverses to chronological
        const mockMessages = [
          { id: 2, message_text: 'Hi there', sender_name: 'User2' },
          { id: 1, message_text: 'Hello', sender_name: 'User1' }
        ];
        databaseMock.mockQueryResult(mockMessages);

        const result = await chatService.getConversationMessages(1, 1, {});

        // Result is reversed to chronological order (oldest first)
        expect(result).toHaveLength(2);
        expect(result[0].message_text).toBe('Hello');
        expect(result[1].message_text).toBe('Hi there');
      });

      it('should support pagination', async () => {
        databaseMock.mockQueryResult([]);

        await chatService.getConversationMessages(1, 1, { limit: 20, offset: 40 });

        expect(databaseMock.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Array)
        );
      });

      it('should support before_message_id filter', async () => {
        databaseMock.mockQueryResult([]);

        await chatService.getConversationMessages(1, 1, { before_message_id: 100 });

        expect(databaseMock.query).toHaveBeenCalledWith(
          expect.stringContaining('cm.id <'),
          expect.any(Array)
        );
      });
    });

    describe('editMessage', () => {
      it('should edit message content', async () => {
        const mockMessage = {
          id: 1,
          message_text: 'Edited content',
          is_edited: true
        };
        databaseMock.mockQueryResult([mockMessage]);

        const result = await chatService.editMessage(1, 1, 'Edited content');

        expect(result.message_text).toBe('Edited content');
        expect(result.is_edited).toBe(true);
      });

      it('should throw error for non-existent message', async () => {
        databaseMock.mockQueryResult([]);

        await expect(
          chatService.editMessage(999, 1, 'New content')
        ).rejects.toThrow();
      });
    });

    describe('deleteMessage', () => {
      it('should soft delete message', async () => {
        databaseMock.mockQueryResult([{ id: 1, is_deleted: true }]);

        const result = await chatService.deleteMessage(1, 1);

        expect(result).toBeDefined();
      });
    });
  });

  describe('Participants', () => {
    describe('addParticipant', () => {
      it('should add participant to conversation', async () => {
        const mockParticipant = {
          id: 1,
          conversation_id: 1,
          user_id: 2,
          role: 'member'
        };
        databaseMock.mockQueryResult([mockParticipant]);

        const result = await chatService.addParticipant(1, 2);

        expect(result.user_id).toBe(2);
        expect(result.role).toBe('member');
      });
    });

    describe('removeParticipant', () => {
      it('should remove participant from conversation', async () => {
        databaseMock.mockQueryResult([]);

        await chatService.removeParticipant(1, 2);

        expect(databaseMock.query).toHaveBeenCalled();
      });
    });

    describe('getConversationParticipants', () => {
      it('should return conversation participants', async () => {
        const mockParticipants = [
          { user_id: 1, user_name: 'User1', role: 'admin' },
          { user_id: 2, user_name: 'User2', role: 'member' }
        ];
        databaseMock.mockQueryResult(mockParticipants);

        const result = await chatService.getConversationParticipants(1);

        expect(result).toHaveLength(2);
        expect(result[0].role).toBe('admin');
      });
    });
  });

  describe('Read Status', () => {
    describe('markConversationRead', () => {
      it('should mark conversation as read', async () => {
        databaseMock.mockQueryResult([]);

        await chatService.markConversationRead(1, 1, 100);

        expect(databaseMock.query).toHaveBeenCalledWith(
          expect.stringContaining('last_read_at'),
          expect.any(Array)
        );
      });
    });
  });

  describe('Search', () => {
    describe('searchMessages', () => {
      it('should search messages by query', async () => {
        const mockResults = [
          { id: 1, message_text: 'Hello world', conversation_id: 1 },
          { id: 2, message_text: 'World peace', conversation_id: 2 }
        ];
        databaseMock.mockQueryResult(mockResults);

        const result = await chatService.searchMessages(1, 'world');

        expect(result).toHaveLength(2);
      });

      it('should filter by conversation', async () => {
        databaseMock.mockQueryResult([]);

        await chatService.searchMessages(1, 'test', { conversation_id: 1 });

        expect(databaseMock.query).toHaveBeenCalledWith(
          expect.stringContaining('conversation_id'),
          expect.any(Array)
        );
      });
    });
  });
});
