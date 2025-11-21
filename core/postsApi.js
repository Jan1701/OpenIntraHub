/**
 * Posts REST API
 * RESTful endpoints for blog posts, categories, tags, and comments
 * Author: Jan Günther <jg@linxpress.de>
 */

const express = require('express');
const router = express.Router();
const postsService = require('./postsService');
const { authenticateToken, requirePermission } = require('./middleware');
const i18n = require('./i18n');

// ==============================================
// POST CATEGORIES
// ==============================================

/**
 * GET /api/posts/categories
 * List all categories
 */
router.get('/posts/categories', async (req, res) => {
    try {
        const { is_active, parent_id, include_post_count } = req.query;

        const options = {
            is_active: is_active !== undefined ? is_active === 'true' : undefined,
            parent_id: parent_id !== undefined ? parseInt(parent_id) : undefined,
            include_post_count: include_post_count === 'true'
        };

        const categories = await postsService.listCategories(options);

        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('Error listing categories:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/posts/categories/:id
 * Get category by ID
 */
router.get('/posts/categories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { include_post_count } = req.query;

        const category = await postsService.findCategoryById(
            parseInt(id),
            include_post_count === 'true'
        );

        res.json({
            success: true,
            data: category
        });
    } catch (error) {
        if (error.message === 'Category not found') {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        console.error('Error finding category:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/posts/categories/slug/:slug
 * Get category by slug
 */
router.get('/posts/categories/slug/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const category = await postsService.findCategoryBySlug(slug);

        res.json({
            success: true,
            data: category
        });
    } catch (error) {
        if (error.message === 'Category not found') {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        console.error('Error finding category:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/posts/categories
 * Create a new category
 */
router.post('/posts/categories', authenticateToken, requirePermission('content.create'), async (req, res) => {
    try {
        const category = await postsService.createCategory(req.body, req.user.id);

        res.status(201).json({
            success: true,
            data: category
        });
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * PUT /api/posts/categories/:id
 * Update category
 */
router.put('/posts/categories/:id', authenticateToken, requirePermission('content.edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const category = await postsService.updateCategory(parseInt(id), req.body);

        res.json({
            success: true,
            data: category
        });
    } catch (error) {
        if (error.message === 'Category not found') {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        console.error('Error updating category:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * DELETE /api/posts/categories/:id
 * Delete category
 */
router.delete('/posts/categories/:id', authenticateToken, requirePermission('content.delete'), async (req, res) => {
    try {
        const { id } = req.params;
        await postsService.deleteCategory(parseInt(id));

        res.json({
            success: true,
            message: 'Category deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

// ==============================================
// POST TAGS
// ==============================================

/**
 * GET /api/posts/tags
 * List all tags
 */
router.get('/posts/tags', async (req, res) => {
    try {
        const { include_post_count } = req.query;
        const tags = await postsService.listTags(include_post_count === 'true');

        res.json({
            success: true,
            data: tags
        });
    } catch (error) {
        console.error('Error listing tags:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/posts/tags
 * Create a new tag
 */
router.post('/posts/tags', authenticateToken, requirePermission('content.create'), async (req, res) => {
    try {
        const tag = await postsService.createTag(req.body);

        res.status(201).json({
            success: true,
            data: tag
        });
    } catch (error) {
        console.error('Error creating tag:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * PUT /api/posts/tags/:id
 * Update tag
 */
router.put('/posts/tags/:id', authenticateToken, requirePermission('content.edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const tag = await postsService.updateTag(parseInt(id), req.body);

        res.json({
            success: true,
            data: tag
        });
    } catch (error) {
        if (error.message === 'Tag not found') {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        console.error('Error updating tag:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * DELETE /api/posts/tags/:id
 * Delete tag
 */
router.delete('/posts/tags/:id', authenticateToken, requirePermission('content.delete'), async (req, res) => {
    try {
        const { id } = req.params;
        await postsService.deleteTag(parseInt(id));

        res.json({
            success: true,
            message: 'Tag deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting tag:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

// ==============================================
// POSTS
// ==============================================

/**
 * GET /api/posts
 * List posts with filtering and pagination
 */
router.get('/posts', async (req, res) => {
    try {
        const {
            status,
            category_id,
            author_id,
            visibility,
            is_featured,
            is_sticky,
            tag_id,
            search,
            format,
            limit,
            offset,
            order_by,
            order_dir
        } = req.query;

        const options = {
            status,
            category_id: category_id ? parseInt(category_id) : undefined,
            author_id: author_id ? parseInt(author_id) : undefined,
            visibility,
            is_featured: is_featured !== undefined ? is_featured === 'true' : undefined,
            is_sticky: is_sticky !== undefined ? is_sticky === 'true' : undefined,
            tag_id: tag_id ? parseInt(tag_id) : undefined,
            search,
            format,
            limit: limit ? parseInt(limit) : 20,
            offset: offset ? parseInt(offset) : 0,
            order_by,
            order_dir
        };

        const result = await postsService.listPosts(options);

        res.json({
            success: true,
            data: result.data,
            pagination: {
                total: result.total,
                limit: result.limit,
                offset: result.offset,
                pages: Math.ceil(result.total / result.limit)
            }
        });
    } catch (error) {
        console.error('Error listing posts:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/posts/:id
 * Get post by ID
 */
router.get('/posts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { include_relations } = req.query;

        const post = await postsService.findPostById(
            parseInt(id),
            include_relations !== 'false'
        );

        // Increment view count (optional: only for public/published posts)
        if (post.status === 'published' && post.visibility === 'public') {
            await postsService.incrementViewCount(post.id);
        }

        res.json({
            success: true,
            data: post
        });
    } catch (error) {
        if (error.message === 'Post not found') {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        console.error('Error finding post:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/posts/slug/:slug
 * Get post by slug
 */
router.get('/posts/slug/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const { include_relations } = req.query;

        const post = await postsService.findPostBySlug(
            slug,
            include_relations !== 'false'
        );

        // Increment view count
        if (post.status === 'published' && post.visibility === 'public') {
            await postsService.incrementViewCount(post.id);
        }

        res.json({
            success: true,
            data: post
        });
    } catch (error) {
        if (error.message === 'Post not found') {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        console.error('Error finding post:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/posts
 * Create a new post
 */
router.post('/posts', authenticateToken, requirePermission('content.create'), async (req, res) => {
    try {
        const post = await postsService.createPost(req.body, req.user.id);

        res.status(201).json({
            success: true,
            data: post
        });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * PUT /api/posts/:id
 * Update post
 */
router.put('/posts/:id', authenticateToken, requirePermission('content.edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const post = await postsService.updatePost(parseInt(id), req.body, req.user.id);

        res.json({
            success: true,
            data: post
        });
    } catch (error) {
        if (error.message === 'Post not found') {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        console.error('Error updating post:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * DELETE /api/posts/:id
 * Soft delete post
 */
router.delete('/posts/:id', authenticateToken, requirePermission('content.delete'), async (req, res) => {
    try {
        const { id } = req.params;
        const { permanent } = req.query;

        if (permanent === 'true') {
            await postsService.permanentlyDeletePost(parseInt(id));
        } else {
            await postsService.deletePost(parseInt(id), req.user.id);
        }

        res.json({
            success: true,
            message: 'Post deleted successfully'
        });
    } catch (error) {
        if (error.message === 'Post not found') {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        console.error('Error deleting post:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/posts/:id/restore
 * Restore soft-deleted post
 */
router.post('/posts/:id/restore', authenticateToken, requirePermission('content.edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const post = await postsService.restorePost(parseInt(id), req.user.id);

        res.json({
            success: true,
            data: post
        });
    } catch (error) {
        if (error.message === 'Post not found') {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        console.error('Error restoring post:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

// ==============================================
// POST META
// ==============================================

/**
 * PUT /api/posts/:id/meta/:key
 * Set post meta field
 */
router.put('/posts/:id/meta/:key', authenticateToken, requirePermission('content.edit'), async (req, res) => {
    try {
        const { id, key } = req.params;
        const { value } = req.body;

        await postsService.setPostMeta(parseInt(id), key, value);

        res.json({
            success: true,
            message: 'Meta field updated successfully'
        });
    } catch (error) {
        console.error('Error setting meta:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/posts/:id/meta/:key
 * Get post meta field
 */
router.get('/posts/:id/meta/:key', async (req, res) => {
    try {
        const { id, key } = req.params;
        const value = await postsService.getPostMeta(parseInt(id), key);

        res.json({
            success: true,
            data: { key, value }
        });
    } catch (error) {
        console.error('Error getting meta:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * DELETE /api/posts/:id/meta/:key
 * Delete post meta field
 */
router.delete('/posts/:id/meta/:key', authenticateToken, requirePermission('content.edit'), async (req, res) => {
    try {
        const { id, key } = req.params;
        await postsService.deletePostMeta(parseInt(id), key);

        res.json({
            success: true,
            message: 'Meta field deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting meta:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

// ==============================================
// POST COMMENTS
// ==============================================

/**
 * GET /api/posts/:id/comments
 * List comments for a post
 */
router.get('/posts/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, include_children } = req.query;

        const options = {
            status: status || 'approved',
            include_children: include_children !== 'false'
        };

        const comments = await postsService.listComments(parseInt(id), options);

        res.json({
            success: true,
            data: comments
        });
    } catch (error) {
        console.error('Error listing comments:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/posts/:id/comments
 * Create a comment
 */
router.post('/posts/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || null;

        const commentData = {
            ...req.body,
            post_id: parseInt(id)
        };

        const comment = await postsService.createComment(commentData, userId);

        res.status(201).json({
            success: true,
            data: comment
        });
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * PUT /api/posts/comments/:commentId/status
 * Update comment status (approve, reject, spam)
 */
router.put('/posts/comments/:commentId/status', authenticateToken, requirePermission('content.edit'), async (req, res) => {
    try {
        const { commentId } = req.params;
        const { status } = req.body;

        const comment = await postsService.updateCommentStatus(
            parseInt(commentId),
            status,
            req.user.id
        );

        res.json({
            success: true,
            data: comment
        });
    } catch (error) {
        if (error.message === 'Comment not found') {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        if (error.message === 'Invalid comment status') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        console.error('Error updating comment status:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * DELETE /api/posts/comments/:commentId
 * Delete comment
 */
router.delete('/posts/comments/:commentId', authenticateToken, requirePermission('content.delete'), async (req, res) => {
    try {
        const { commentId } = req.params;
        await postsService.deleteComment(parseInt(commentId));

        res.json({
            success: true,
            message: 'Comment deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

// ==============================================
// POST REVISIONS
// ==============================================

/**
 * GET /api/posts/:id/revisions
 * List revisions for a post
 */
router.get('/posts/:id/revisions', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { limit } = req.query;

        const revisions = await postsService.listRevisions(
            parseInt(id),
            limit ? parseInt(limit) : 50
        );

        res.json({
            success: true,
            data: revisions
        });
    } catch (error) {
        console.error('Error listing revisions:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/posts/revisions/:revisionId
 * Get specific revision
 */
router.get('/posts/revisions/:revisionId', authenticateToken, async (req, res) => {
    try {
        const { revisionId } = req.params;
        const revision = await postsService.findRevisionById(parseInt(revisionId));

        res.json({
            success: true,
            data: revision
        });
    } catch (error) {
        if (error.message === 'Revision not found') {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        console.error('Error finding revision:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/posts/:id/revisions/:revisionId/restore
 * Restore post from specific revision
 */
router.post('/posts/:id/revisions/:revisionId/restore', authenticateToken, requirePermission('content.edit'), async (req, res) => {
    try {
        const { id, revisionId } = req.params;

        const post = await postsService.restoreFromRevision(
            parseInt(id),
            parseInt(revisionId),
            req.user.id
        );

        res.json({
            success: true,
            data: post
        });
    } catch (error) {
        if (error.message === 'Revision not found' || error.message === 'Revision does not belong to this post') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        console.error('Error restoring from revision:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

module.exports = router;
