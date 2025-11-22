/**
 * Unit Tests for Social Service
 * Tests: Reactions, Activity Feed, Notifications, Mentions
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

const socialService = require('../../core/socialService');

describe('Social Service', () => {
  beforeEach(() => {
    databaseMock.resetMocks();
    jest.clearAllMocks();
  });

  describe('REACTION_TYPES', () => {
    it('should have all standard reaction types', () => {
      expect(socialService.REACTION_TYPES).toBeDefined();
      expect(socialService.REACTION_TYPES.LIKE).toBe('like');
      expect(socialService.REACTION_TYPES.LOVE).toBe('love');
      expect(socialService.REACTION_TYPES.CELEBRATE).toBe('celebrate');
      expect(socialService.REACTION_TYPES.INSIGHTFUL).toBe('insightful');
      expect(socialService.REACTION_TYPES.SUPPORT).toBe('support');
      expect(socialService.REACTION_TYPES.FUNNY).toBe('funny');
    });
  });

  describe('Post Reactions', () => {
    describe('addPostReaction', () => {
      it('should add reaction to post', async () => {
        const mockReaction = {
          id: 1,
          post_id: 1,
          user_id: 1,
          reaction_type: 'like'
        };
        databaseMock.mockQueryResult([mockReaction]);

        const result = await socialService.addPostReaction(1, 1, 'like');

        expect(result.reaction_type).toBe('like');
        expect(databaseMock.query).toHaveBeenCalled();
      });

      it('should throw error for invalid reaction type', async () => {
        await expect(
          socialService.addPostReaction(1, 1, 'invalid')
        ).rejects.toThrow('Invalid reaction type: invalid');
      });

      it('should update existing reaction', async () => {
        const mockReaction = {
          id: 1,
          post_id: 1,
          user_id: 1,
          reaction_type: 'love'
        };
        databaseMock.mockQueryResult([mockReaction]);

        const result = await socialService.addPostReaction(1, 1, 'love');

        expect(result.reaction_type).toBe('love');
      });
    });

    describe('removePostReaction', () => {
      it('should remove reaction from post', async () => {
        databaseMock.mockQueryResult([]);

        await socialService.removePostReaction(1, 1);

        expect(databaseMock.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM post_reactions'),
          [1, 1]
        );
      });

      it('should handle database error', async () => {
        databaseMock.mockQueryError(new Error('DB Error'));

        await expect(
          socialService.removePostReaction(1, 1)
        ).rejects.toThrow('DB Error');
      });
    });

    describe('getPostReactions', () => {
      it('should return reactions for post', async () => {
        const mockReactions = [
          { id: 1, post_id: 1, user_id: 1, reaction_type: 'like', user_name: 'User1' },
          { id: 2, post_id: 1, user_id: 2, reaction_type: 'love', user_name: 'User2' }
        ];
        databaseMock.mockQueryResult(mockReactions);

        const result = await socialService.getPostReactions(1);

        expect(result).toHaveLength(2);
        expect(result[0].reaction_type).toBe('like');
      });

      it('should return empty array for no reactions', async () => {
        databaseMock.mockQueryResult([]);

        const result = await socialService.getPostReactions(999);

        expect(result).toHaveLength(0);
      });
    });

    describe('getPostReactionSummary', () => {
      it('should return aggregated reaction counts', async () => {
        const mockSummary = [
          { reaction_type: 'like', count: '10' },
          { reaction_type: 'love', count: '5' }
        ];
        databaseMock.mockQueryResult(mockSummary);

        const result = await socialService.getPostReactionSummary(1);

        expect(result).toHaveLength(2);
        expect(result[0].reaction_type).toBe('like');
        expect(result[0].count).toBe('10');
      });
    });

    describe('getUserPostReaction', () => {
      it('should return user reaction for post', async () => {
        const mockReaction = { id: 1, post_id: 1, user_id: 1, reaction_type: 'like' };
        databaseMock.mockQueryResult([mockReaction]);

        const result = await socialService.getUserPostReaction(1, 1);

        expect(result.reaction_type).toBe('like');
      });

      it('should return null if no reaction', async () => {
        databaseMock.mockQueryResult([]);

        const result = await socialService.getUserPostReaction(1, 999);

        expect(result).toBeNull();
      });
    });
  });

  describe('Comment Reactions', () => {
    describe('addCommentReaction', () => {
      it('should add reaction to comment', async () => {
        const mockReaction = {
          id: 1,
          comment_id: 1,
          user_id: 1,
          reaction_type: 'like'
        };
        databaseMock.mockQueryResult([mockReaction]);

        const result = await socialService.addCommentReaction(1, 1, 'like');

        expect(result.reaction_type).toBe('like');
      });

      it('should throw error for invalid reaction type', async () => {
        await expect(
          socialService.addCommentReaction(1, 1, 'invalid')
        ).rejects.toThrow('Invalid reaction type: invalid');
      });
    });

    describe('removeCommentReaction', () => {
      it('should remove reaction from comment', async () => {
        databaseMock.mockQueryResult([]);

        await socialService.removeCommentReaction(1, 1);

        expect(databaseMock.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM comment_reactions'),
          [1, 1]
        );
      });
    });
  });

  describe('Post Shares', () => {
    describe('sharePost', () => {
      it('should share post successfully', async () => {
        const mockShare = { id: 1, post_id: 1, user_id: 1, share_comment: 'Great post!' };
        databaseMock.mockQueryResult([mockShare]);

        const result = await socialService.sharePost(1, 1, 'Great post!');

        expect(result.share_comment).toBe('Great post!');
      });

      it('should share post without comment', async () => {
        const mockShare = { id: 1, post_id: 1, user_id: 1, share_comment: null };
        databaseMock.mockQueryResult([mockShare]);

        const result = await socialService.sharePost(1, 1);

        expect(result.share_comment).toBeNull();
      });
    });

    describe('getPostShares', () => {
      it('should return shares for post', async () => {
        const mockShares = [
          { id: 1, post_id: 1, user_id: 1, user_name: 'User1' },
          { id: 2, post_id: 1, user_id: 2, user_name: 'User2' }
        ];
        databaseMock.mockQueryResult(mockShares);

        const result = await socialService.getPostShares(1);

        expect(result).toHaveLength(2);
      });
    });
  });

  describe('Activity Feed', () => {
    describe('getActivityFeed', () => {
      it('should return activity feed for user', async () => {
        const mockActivities = [
          { id: 1, user_id: 1, activity_type: 'post_created', user_name: 'User1' },
          { id: 2, user_id: 2, activity_type: 'post_shared', user_name: 'User2' }
        ];
        databaseMock.mockQueryResult(mockActivities);

        const result = await socialService.getActivityFeed(1);

        expect(result).toHaveLength(2);
        expect(result[0].activity_type).toBe('post_created');
      });

      it('should support pagination', async () => {
        databaseMock.mockQueryResult([]);

        await socialService.getActivityFeed(1, { limit: 10, offset: 20 });

        expect(databaseMock.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([10, 20])
        );
      });

      it('should filter by activity types', async () => {
        databaseMock.mockQueryResult([]);

        await socialService.getActivityFeed(1, {
          activity_types: ['post_created', 'comment_added']
        });

        expect(databaseMock.query).toHaveBeenCalledWith(
          expect.stringContaining('activity_type = ANY'),
          expect.any(Array)
        );
      });
    });

    describe('createActivity', () => {
      it('should create new activity', async () => {
        const mockActivity = {
          id: 1,
          user_id: 1,
          activity_type: 'post_created',
          target_type: 'post',
          target_id: 1
        };
        databaseMock.mockQueryResult([mockActivity]);

        const result = await socialService.createActivity({
          user_id: 1,
          activity_type: 'post_created',
          target_type: 'post',
          target_id: 1
        });

        expect(result.activity_type).toBe('post_created');
      });
    });
  });

  describe('Notifications', () => {
    describe('getUserNotifications', () => {
      it('should return notifications for user', async () => {
        const mockNotifications = [
          { id: 1, user_id: 1, notification_type: 'mention', is_read: false },
          { id: 2, user_id: 1, notification_type: 'reaction', is_read: true }
        ];
        databaseMock.mockQueryResult(mockNotifications);

        const result = await socialService.getUserNotifications(1);

        expect(result).toHaveLength(2);
      });

      it('should filter unread only', async () => {
        databaseMock.mockQueryResult([]);

        await socialService.getUserNotifications(1, { unread_only: true });

        expect(databaseMock.query).toHaveBeenCalledWith(
          expect.stringContaining('is_read = false'),
          expect.any(Array)
        );
      });
    });

    describe('markNotificationRead', () => {
      it('should mark notification as read', async () => {
        databaseMock.mockQueryResult([]);

        await socialService.markNotificationRead(1, 1);

        expect(databaseMock.query).toHaveBeenCalledWith(
          expect.stringContaining('SET is_read = true'),
          [1, 1]
        );
      });
    });

    describe('markAllNotificationsRead', () => {
      it('should mark all notifications as read', async () => {
        databaseMock.mockQueryResult([]);

        await socialService.markAllNotificationsRead(1);

        expect(databaseMock.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE user_id = $1 AND is_read = false'),
          [1]
        );
      });
    });

    describe('getUnreadNotificationCount', () => {
      it('should return unread count', async () => {
        databaseMock.mockQueryResult([{ count: '5' }]);

        const result = await socialService.getUnreadNotificationCount(1);

        expect(result).toBe(5);
      });

      it('should return 0 for no unread', async () => {
        databaseMock.mockQueryResult([{ count: '0' }]);

        const result = await socialService.getUnreadNotificationCount(1);

        expect(result).toBe(0);
      });
    });
  });

  describe('Mentions', () => {
    describe('parseMentions', () => {
      it('should parse mentions from text', async () => {
        const mockUsers = [
          { id: 1, username: 'john' },
          { id: 2, username: 'jane' }
        ];
        databaseMock.mockQueryResult(mockUsers);

        const result = await socialService.parseMentions('Hello @john and @jane!');

        expect(result).toHaveLength(2);
        expect(databaseMock.query).toHaveBeenCalledWith(
          expect.any(String),
          [['john', 'jane']]
        );
      });

      it('should return empty array for no mentions', async () => {
        const result = await socialService.parseMentions('Hello world!');

        expect(result).toHaveLength(0);
        expect(databaseMock.query).not.toHaveBeenCalled();
      });

      it('should handle single mention', async () => {
        databaseMock.mockQueryResult([{ id: 1, username: 'admin' }]);

        const result = await socialService.parseMentions('Hi @admin');

        expect(result).toHaveLength(1);
      });
    });

    describe('createMention', () => {
      it('should create mention and notification', async () => {
        const mockMention = {
          id: 1,
          mentionable_type: 'post',
          mentionable_id: 1,
          mentioned_user_id: 2,
          mentioned_by_user_id: 1
        };
        databaseMock.mockQueryResult([mockMention]);

        const result = await socialService.createMention({
          mentionable_type: 'post',
          mentionable_id: 1,
          mentioned_user_id: 2,
          mentioned_by_user_id: 1
        });

        expect(result.mentioned_user_id).toBe(2);
      });
    });
  });

  describe('Statistics', () => {
    describe('getUserSocialStats', () => {
      it('should return user social statistics', async () => {
        const mockStats = {
          reactions_received: '100',
          comments_received: '50',
          shares_received: '25',
          posts_created: '10',
          comments_made: '30',
          reactions_given: '200'
        };
        databaseMock.mockQueryResult([mockStats]);

        const result = await socialService.getUserSocialStats(1);

        expect(result.reactions_received).toBe('100');
        expect(result.posts_created).toBe('10');
      });
    });
  });
});
