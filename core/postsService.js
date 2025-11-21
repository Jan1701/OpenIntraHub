/**
 * Posts Service
 * Manages blog posts, categories, tags, and comments
 * Author: Jan Günther <jg@linxpress.de>
 */

const database = require('./database');
const i18n = require('./i18n');

// ==============================================
// POST CATEGORIES
// ==============================================

/**
 * Create a new post category
 */
async function createCategory(categoryData, userId) {
    const {
        name,
        slug,
        description,
        parent_id,
        meta_title,
        meta_description,
        color,
        icon,
        position = 0,
        is_active = true
    } = categoryData;

    const result = await database.query(
        `INSERT INTO post_categories (
            name, slug, description, parent_id, meta_title, meta_description,
            color, icon, position, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [name, slug, description, parent_id, meta_title, meta_description,
         color, icon, position, is_active]
    );

    return result.rows[0];
}

/**
 * Get category by ID
 */
async function findCategoryById(categoryId, includePostCount = false) {
    let query = 'SELECT * FROM post_categories WHERE id = $1';

    if (includePostCount) {
        query = `
            SELECT c.*,
                   COUNT(p.id) as post_count
            FROM post_categories c
            LEFT JOIN posts p ON p.category_id = c.id AND p.deleted_at IS NULL
            WHERE c.id = $1
            GROUP BY c.id
        `;
    }

    const result = await database.query(query, [categoryId]);
    if (result.rows.length === 0) {
        throw new Error('Category not found');
    }

    return result.rows[0];
}

/**
 * Get category by slug
 */
async function findCategoryBySlug(slug) {
    const result = await database.query(
        'SELECT * FROM post_categories WHERE slug = $1',
        [slug]
    );

    if (result.rows.length === 0) {
        throw new Error('Category not found');
    }

    return result.rows[0];
}

/**
 * List all categories
 */
async function listCategories(options = {}) {
    const {
        is_active,
        parent_id,
        include_post_count = false
    } = options;

    let query = 'SELECT c.*';
    if (include_post_count) {
        query += ', COUNT(p.id) as post_count';
    }
    query += ' FROM post_categories c';

    if (include_post_count) {
        query += ' LEFT JOIN posts p ON p.category_id = c.id AND p.deleted_at IS NULL';
    }

    const conditions = [];
    const params = [];

    if (is_active !== undefined) {
        params.push(is_active);
        conditions.push(`c.is_active = $${params.length}`);
    }

    if (parent_id !== undefined) {
        params.push(parent_id);
        conditions.push(`c.parent_id = $${params.length}`);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    if (include_post_count) {
        query += ' GROUP BY c.id';
    }

    query += ' ORDER BY c.position ASC, c.name ASC';

    const result = await database.query(query, params);
    return result.rows;
}

/**
 * Update category
 */
async function updateCategory(categoryId, updates) {
    const allowedFields = [
        'name', 'slug', 'description', 'parent_id', 'meta_title',
        'meta_description', 'color', 'icon', 'position', 'is_active'
    ];

    const fields = [];
    const params = [];

    Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
            params.push(updates[key]);
            fields.push(`${key} = $${params.length}`);
        }
    });

    if (fields.length === 0) {
        throw new Error('No valid fields to update');
    }

    params.push(categoryId);
    const result = await database.query(
        `UPDATE post_categories SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
    );

    if (result.rows.length === 0) {
        throw new Error('Category not found');
    }

    return result.rows[0];
}

/**
 * Delete category
 */
async function deleteCategory(categoryId) {
    await database.query('DELETE FROM post_categories WHERE id = $1', [categoryId]);
}

// ==============================================
// POST TAGS
// ==============================================

/**
 * Create a new tag
 */
async function createTag(tagData) {
    const { name, slug, description } = tagData;

    const result = await database.query(
        `INSERT INTO post_tags (name, slug, description)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, slug, description]
    );

    return result.rows[0];
}

/**
 * Find or create tag
 */
async function findOrCreateTag(name, slug = null) {
    if (!slug) {
        slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }

    // Try to find existing tag
    let result = await database.query(
        'SELECT * FROM post_tags WHERE slug = $1',
        [slug]
    );

    if (result.rows.length > 0) {
        return result.rows[0];
    }

    // Create new tag
    return await createTag({ name, slug });
}

/**
 * List all tags
 */
async function listTags(includePostCount = false) {
    let query = 'SELECT t.*';

    if (includePostCount) {
        query += `, COUNT(ptr.post_id) as post_count
                   FROM post_tags t
                   LEFT JOIN post_tag_relations ptr ON ptr.tag_id = t.id
                   GROUP BY t.id`;
    } else {
        query += ' FROM post_tags t';
    }

    query += ' ORDER BY t.name ASC';

    const result = await database.query(query);
    return result.rows;
}

/**
 * Update tag
 */
async function updateTag(tagId, updates) {
    const allowedFields = ['name', 'slug', 'description'];
    const fields = [];
    const params = [];

    Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
            params.push(updates[key]);
            fields.push(`${key} = $${params.length}`);
        }
    });

    if (fields.length === 0) {
        throw new Error('No valid fields to update');
    }

    params.push(tagId);
    const result = await database.query(
        `UPDATE post_tags SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
    );

    if (result.rows.length === 0) {
        throw new Error('Tag not found');
    }

    return result.rows[0];
}

/**
 * Delete tag
 */
async function deleteTag(tagId) {
    await database.query('DELETE FROM post_tags WHERE id = $1', [tagId]);
}

// ==============================================
// POSTS
// ==============================================

/**
 * Create a new post
 */
async function createPost(postData, userId) {
    const {
        title,
        slug,
        excerpt,
        content,
        featured_image,
        featured_image_alt,
        featured_image_caption,
        category_id,
        status = 'draft',
        published_at,
        scheduled_at,
        is_featured = false,
        is_sticky = false,
        visibility = 'public',
        password_hash,
        meta_title,
        meta_description,
        meta_keywords,
        og_image,
        canonical_url,
        allow_comments = true,
        format = 'standard',
        reading_time
    } = postData;

    const result = await database.query(
        `INSERT INTO posts (
            title, slug, excerpt, content, featured_image, featured_image_alt,
            featured_image_caption, category_id, author_id, status, published_at,
            scheduled_at, is_featured, is_sticky, visibility, password_hash,
            meta_title, meta_description, meta_keywords, og_image, canonical_url,
            allow_comments, format, reading_time, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                  $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        RETURNING *`,
        [
            title, slug, excerpt, content, featured_image, featured_image_alt,
            featured_image_caption, category_id, userId, status, published_at,
            scheduled_at, is_featured, is_sticky, visibility, password_hash,
            meta_title, meta_description, meta_keywords, og_image, canonical_url,
            allow_comments, format, reading_time, userId
        ]
    );

    const post = result.rows[0];

    // Handle tags if provided
    if (postData.tags && Array.isArray(postData.tags)) {
        await setPostTags(post.id, postData.tags);
    }

    // Create initial revision
    await createRevision(post.id, {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        revision_note: 'Initial version'
    }, userId);

    return await findPostById(post.id);
}

/**
 * Find post by ID
 */
async function findPostById(postId, includeRelations = true) {
    const result = await database.query(
        `SELECT p.*,
                u.username as author_name,
                c.name as category_name,
                c.slug as category_slug
         FROM posts p
         LEFT JOIN users u ON u.id = p.author_id
         LEFT JOIN post_categories c ON c.id = p.category_id
         WHERE p.id = $1 AND p.deleted_at IS NULL`,
        [postId]
    );

    if (result.rows.length === 0) {
        throw new Error('Post not found');
    }

    const post = result.rows[0];

    if (includeRelations) {
        // Load tags
        const tagsResult = await database.query(
            `SELECT t.* FROM post_tags t
             JOIN post_tag_relations ptr ON ptr.tag_id = t.id
             WHERE ptr.post_id = $1
             ORDER BY t.name ASC`,
            [postId]
        );
        post.tags = tagsResult.rows;

        // Load meta fields
        const metaResult = await database.query(
            `SELECT meta_key, meta_value FROM post_meta WHERE post_id = $1`,
            [postId]
        );
        post.meta = {};
        metaResult.rows.forEach(row => {
            post.meta[row.meta_key] = row.meta_value;
        });
    }

    return post;
}

/**
 * Find post by slug
 */
async function findPostBySlug(slug, includeRelations = true) {
    const result = await database.query(
        `SELECT p.*,
                u.username as author_name,
                c.name as category_name,
                c.slug as category_slug
         FROM posts p
         LEFT JOIN users u ON u.id = p.author_id
         LEFT JOIN post_categories c ON c.id = p.category_id
         WHERE p.slug = $1 AND p.deleted_at IS NULL`,
        [slug]
    );

    if (result.rows.length === 0) {
        throw new Error('Post not found');
    }

    const post = result.rows[0];

    if (includeRelations) {
        // Load tags
        const tagsResult = await database.query(
            `SELECT t.* FROM post_tags t
             JOIN post_tag_relations ptr ON ptr.tag_id = t.id
             WHERE ptr.post_id = $1
             ORDER BY t.name ASC`,
            [post.id]
        );
        post.tags = tagsResult.rows;

        // Load meta fields
        const metaResult = await database.query(
            `SELECT meta_key, meta_value FROM post_meta WHERE post_id = $1`,
            [post.id]
        );
        post.meta = {};
        metaResult.rows.forEach(row => {
            post.meta[row.meta_key] = row.meta_value;
        });
    }

    return post;
}

/**
 * List posts with filtering and pagination
 */
async function listPosts(options = {}) {
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
        limit = 20,
        offset = 0,
        order_by = 'created_at',
        order_dir = 'DESC'
    } = options;

    const conditions = ['p.deleted_at IS NULL'];
    const params = [];

    if (status) {
        params.push(status);
        conditions.push(`p.status = $${params.length}`);
    }

    if (category_id) {
        params.push(category_id);
        conditions.push(`p.category_id = $${params.length}`);
    }

    if (author_id) {
        params.push(author_id);
        conditions.push(`p.author_id = $${params.length}`);
    }

    if (visibility) {
        params.push(visibility);
        conditions.push(`p.visibility = $${params.length}`);
    }

    if (is_featured !== undefined) {
        params.push(is_featured);
        conditions.push(`p.is_featured = $${params.length}`);
    }

    if (is_sticky !== undefined) {
        params.push(is_sticky);
        conditions.push(`p.is_sticky = $${params.length}`);
    }

    if (format) {
        params.push(format);
        conditions.push(`p.format = $${params.length}`);
    }

    if (tag_id) {
        conditions.push(`EXISTS (
            SELECT 1 FROM post_tag_relations ptr
            WHERE ptr.post_id = p.id AND ptr.tag_id = $${params.length + 1}
        )`);
        params.push(tag_id);
    }

    if (search) {
        conditions.push(`(
            to_tsvector('german', p.title || ' ' || COALESCE(p.excerpt, '') || ' ' || COALESCE(p.content, ''))
            @@ plainto_tsquery('german', $${params.length + 1})
        )`);
        params.push(search);
    }

    // Count total
    const countQuery = `
        SELECT COUNT(*) as total
        FROM posts p
        WHERE ${conditions.join(' AND ')}
    `;
    const countResult = await database.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get posts
    const validOrderColumns = ['created_at', 'published_at', 'title', 'views_count', 'likes_count'];
    const orderColumn = validOrderColumns.includes(order_by) ? order_by : 'created_at';
    const orderDirection = order_dir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    params.push(limit, offset);
    const query = `
        SELECT p.*,
               u.username as author_name,
               c.name as category_name,
               c.slug as category_slug,
               (SELECT COUNT(*) FROM post_tag_relations ptr WHERE ptr.post_id = p.id) as tag_count
        FROM posts p
        LEFT JOIN users u ON u.id = p.author_id
        LEFT JOIN post_categories c ON c.id = p.category_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.is_sticky DESC, p.${orderColumn} ${orderDirection}
        LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await database.query(query, params);

    return {
        data: result.rows,
        total,
        limit,
        offset
    };
}

/**
 * Update post
 */
async function updatePost(postId, updates, userId) {
    const allowedFields = [
        'title', 'slug', 'excerpt', 'content', 'featured_image', 'featured_image_alt',
        'featured_image_caption', 'category_id', 'status', 'published_at', 'scheduled_at',
        'is_featured', 'is_sticky', 'visibility', 'password_hash', 'meta_title',
        'meta_description', 'meta_keywords', 'og_image', 'canonical_url',
        'allow_comments', 'comments_closed_at', 'format', 'reading_time'
    ];

    const fields = [];
    const params = [];

    Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
            params.push(updates[key]);
            fields.push(`${key} = $${params.length}`);
        }
    });

    if (fields.length === 0 && !updates.tags) {
        throw new Error('No valid fields to update');
    }

    if (fields.length > 0) {
        params.push(userId);
        fields.push(`updated_by = $${params.length}`);

        params.push(postId);
        const result = await database.query(
            `UPDATE posts SET ${fields.join(', ')} WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`,
            params
        );

        if (result.rows.length === 0) {
            throw new Error('Post not found');
        }
    }

    // Handle tags update
    if (updates.tags && Array.isArray(updates.tags)) {
        await setPostTags(postId, updates.tags);
    }

    // Create revision if content changed
    if (updates.title || updates.slug || updates.excerpt || updates.content) {
        const post = await findPostById(postId, false);
        await createRevision(postId, {
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            content: post.content,
            revision_note: updates.revision_note || 'Updated'
        }, userId);
    }

    return await findPostById(postId);
}

/**
 * Soft delete post
 */
async function deletePost(postId, userId) {
    const result = await database.query(
        `UPDATE posts SET deleted_at = CURRENT_TIMESTAMP, updated_by = $1
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [userId, postId]
    );

    if (result.rows.length === 0) {
        throw new Error('Post not found');
    }

    return result.rows[0];
}

/**
 * Restore soft-deleted post
 */
async function restorePost(postId, userId) {
    const result = await database.query(
        `UPDATE posts SET deleted_at = NULL, updated_by = $1
         WHERE id = $2
         RETURNING *`,
        [userId, postId]
    );

    if (result.rows.length === 0) {
        throw new Error('Post not found');
    }

    return result.rows[0];
}

/**
 * Permanently delete post
 */
async function permanentlyDeletePost(postId) {
    await database.query('DELETE FROM posts WHERE id = $1', [postId]);
}

/**
 * Increment post view count
 */
async function incrementViewCount(postId) {
    await database.query(
        'UPDATE posts SET views_count = views_count + 1 WHERE id = $1',
        [postId]
    );
}

/**
 * Set post tags (replaces all existing tags)
 */
async function setPostTags(postId, tagNames) {
    // Remove existing tags
    await database.query('DELETE FROM post_tag_relations WHERE post_id = $1', [postId]);

    // Add new tags
    for (const tagName of tagNames) {
        const tag = await findOrCreateTag(tagName);
        await database.query(
            'INSERT INTO post_tag_relations (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [postId, tag.id]
        );
    }
}

// ==============================================
// POST META
// ==============================================

/**
 * Set post meta field
 */
async function setPostMeta(postId, key, value) {
    await database.query(
        `INSERT INTO post_meta (post_id, meta_key, meta_value)
         VALUES ($1, $2, $3)
         ON CONFLICT (post_id, meta_key)
         DO UPDATE SET meta_value = $3, updated_at = CURRENT_TIMESTAMP`,
        [postId, key, value]
    );
}

/**
 * Get post meta field
 */
async function getPostMeta(postId, key) {
    const result = await database.query(
        'SELECT meta_value FROM post_meta WHERE post_id = $1 AND meta_key = $2',
        [postId, key]
    );

    return result.rows.length > 0 ? result.rows[0].meta_value : null;
}

/**
 * Delete post meta field
 */
async function deletePostMeta(postId, key) {
    await database.query(
        'DELETE FROM post_meta WHERE post_id = $1 AND meta_key = $2',
        [postId, key]
    );
}

// ==============================================
// POST COMMENTS
// ==============================================

/**
 * Create a comment
 */
async function createComment(commentData, userId = null) {
    const {
        post_id,
        parent_id,
        author_name,
        author_email,
        author_website,
        author_ip,
        content,
        status = 'pending'
    } = commentData;

    const result = await database.query(
        `INSERT INTO post_comments (
            post_id, parent_id, user_id, author_name, author_email,
            author_website, author_ip, content, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [post_id, parent_id, userId, author_name, author_email,
         author_website, author_ip, content, status]
    );

    return result.rows[0];
}

/**
 * List comments for a post
 */
async function listComments(postId, options = {}) {
    const { status = 'approved', include_children = true } = options;

    let query = `
        SELECT c.*,
               u.username as user_name
        FROM post_comments c
        LEFT JOIN users u ON u.id = c.user_id
        WHERE c.post_id = $1
    `;

    const params = [postId];

    if (status) {
        params.push(status);
        query += ` AND c.status = $${params.length}`;
    }

    if (!include_children) {
        query += ' AND c.parent_id IS NULL';
    }

    query += ' ORDER BY c.created_at ASC';

    const result = await database.query(query, params);
    return result.rows;
}

/**
 * Update comment status
 */
async function updateCommentStatus(commentId, status, approvedBy = null) {
    const validStatuses = ['pending', 'approved', 'spam', 'trash'];
    if (!validStatuses.includes(status)) {
        throw new Error('Invalid comment status');
    }

    const result = await database.query(
        `UPDATE post_comments
         SET status = $1,
             approved_at = $2,
             approved_by = $3
         WHERE id = $4
         RETURNING *`,
        [
            status,
            status === 'approved' ? new Date() : null,
            status === 'approved' ? approvedBy : null,
            commentId
        ]
    );

    if (result.rows.length === 0) {
        throw new Error('Comment not found');
    }

    return result.rows[0];
}

/**
 * Delete comment
 */
async function deleteComment(commentId) {
    await database.query('DELETE FROM post_comments WHERE id = $1', [commentId]);
}

// ==============================================
// POST REVISIONS
// ==============================================

/**
 * Create a post revision
 */
async function createRevision(postId, revisionData, userId) {
    const { title, slug, excerpt, content, revision_note } = revisionData;

    const result = await database.query(
        `INSERT INTO post_revisions (
            post_id, title, slug, excerpt, content, revision_note, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [postId, title, slug, excerpt, content, revision_note, userId]
    );

    return result.rows[0];
}

/**
 * List revisions for a post
 */
async function listRevisions(postId, limit = 50) {
    const result = await database.query(
        `SELECT r.*, u.username as created_by_name
         FROM post_revisions r
         LEFT JOIN users u ON u.id = r.created_by
         WHERE r.post_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2`,
        [postId, limit]
    );

    return result.rows;
}

/**
 * Get specific revision
 */
async function findRevisionById(revisionId) {
    const result = await database.query(
        `SELECT r.*, u.username as created_by_name
         FROM post_revisions r
         LEFT JOIN users u ON u.id = r.created_by
         WHERE r.id = $1`,
        [revisionId]
    );

    if (result.rows.length === 0) {
        throw new Error('Revision not found');
    }

    return result.rows[0];
}

/**
 * Restore post from revision
 */
async function restoreFromRevision(postId, revisionId, userId) {
    const revision = await findRevisionById(revisionId);

    if (revision.post_id !== postId) {
        throw new Error('Revision does not belong to this post');
    }

    return await updatePost(postId, {
        title: revision.title,
        slug: revision.slug,
        excerpt: revision.excerpt,
        content: revision.content,
        revision_note: `Restored from revision #${revisionId}`
    }, userId);
}

// ==============================================
// EXPORTS
// ==============================================

module.exports = {
    // Categories
    createCategory,
    findCategoryById,
    findCategoryBySlug,
    listCategories,
    updateCategory,
    deleteCategory,

    // Tags
    createTag,
    findOrCreateTag,
    listTags,
    updateTag,
    deleteTag,

    // Posts
    createPost,
    findPostById,
    findPostBySlug,
    listPosts,
    updatePost,
    deletePost,
    restorePost,
    permanentlyDeletePost,
    incrementViewCount,
    setPostTags,

    // Meta
    setPostMeta,
    getPostMeta,
    deletePostMeta,

    // Comments
    createComment,
    listComments,
    updateCommentStatus,
    deleteComment,

    // Revisions
    createRevision,
    listRevisions,
    findRevisionById,
    restoreFromRevision
};
