require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// XSS Sanitization
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// ==================== Configuration & Constants ====================

const app = express();
const port = process.env.PORT || 3001;
const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/blogDB';
const DB_NAME = 'blogDB';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = '24h';

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500
};

// Pre-hashed passwords using bcrypt (10 salt rounds)
// Generated at startup via hashPasswords() below
const VALID_USERS = {
    'admin': { passwordHash: '', role: 'admin' },
    'student': { passwordHash: '', role: 'student' }
};

function hashPasswords() {
    const saltRounds = 10;
    const adminPwd = process.env.ADMIN_PASSWORD || 'admin123';
    const studentPwd = process.env.STUDENT_PASSWORD || 'student123';
    VALID_USERS['admin'].passwordHash = bcrypt.hashSync(adminPwd, saltRounds);
    VALID_USERS['student'].passwordHash = bcrypt.hashSync(studentPwd, saltRounds);
    console.log('🔐 User password hashes generated');
}

function generateToken(user) {
    return jwt.sign(
        { username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );
}

function verifyToken(req, res, next) {
    // Support both Bearer token AND legacy x-headers for backward compatibility
    const authHeader = req.headers['authorization'];
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = { username: decoded.username, role: decoded.role };
            return next();
        } catch (err) {
            return sendError(res, HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired token');
        }
    }
    
    // Fallback to legacy x-username/x-role headers for backward compatibility
    if (req.headers['x-username'] && req.headers['x-role']) {
        req.user = { username: req.headers['x-username'], role: req.headers['x-role'] };
        return next();
    }
    
    return sendError(res, HTTP_STATUS.UNAUTHORIZED, 'Authentication required');
}

// ==================== MongoDB Connection ====================

const client = new MongoClient(uri);
let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db(DB_NAME);
        console.log('✅ Connected to MongoDB at:', uri);
        console.log('   Database:', DB_NAME);

        // Ensure indexes for performance
        await db.collection('posts').createIndex({ createdAt: -1 });
        await db.collection('posts').createIndex({ category: 1 });
        console.log('   Indexes ensured on posts collection');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        console.error('   Make sure MongoDB is running on your machine.');
        console.error('   Download: https://www.mongodb.com/try/download/community');
        process.exit(1);
    }
}

// ==================== Response Helpers ====================

function sendError(res, code, msg) {
    return res.status(code).json({ success: false, message: msg });
}

function sendOk(res, code, data = {}) {
    return res.status(code).json({ success: true, ...data });
}

// ==================== Auth Helpers ====================

function isAdmin(req) { return req.user && req.user.role === 'admin'; }
function isAuthenticated(req) { return !!req.user; }

// ==================== Middleware ====================

app.use(bodyParser.json({ limit: '50mb' }));  // Large limit for Base64 images
app.use(express.static(path.join(__dirname, 'public')));

// Security headers with CSP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://use.fontawesome.com", "https://cdn.quilljs.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://use.fontawesome.com", "https://fonts.googleapis.com", "https://cdn.quilljs.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://use.fontawesome.com", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
        },
    },
}));

// CORS — allow cross-origin requests with custom headers
app.use(cors({
    origin: '*',
    allowedHeaders: ['Content-Type', 'Authorization', 'x-username', 'x-role'],
}));

// Rate limiting — 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', apiLimiter);

// ==================== Swagger/OpenAPI ====================

const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'UniBlog API',
        version: '1.0.0',
        description: 'REST API for the UniBlog full-stack blog platform. Supports blog posts, design items (announcements), static blog items, achievers, and comments.'
    },
    servers: [{ url: `http://localhost:${port}`, description: 'Development server' }],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT'
            }
        }
    }
};

const swaggerOptions = {
    swaggerDefinition,
    apis: ['./server.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// ==================== CRUD Route Factory ====================

// Generic CRUD route builder for a MongoDB collection
// Config: { path, collection, label, requiredFields, buildDoc, buildUpdate, extraRoutes }
function createCrudRoutes(config) {
    const { path: basePath, collection, label, requiredFields, buildDoc, buildUpdate, extraRoutes } = config;
    const col = () => db.collection(collection);
    const notFoundMsg = `${label} not found`;
    const logLabel = label.toLowerCase();

    // GET all with pagination
    app.get(basePath, async (req, res) => {
        try {
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 6));
            const skip = (page - 1) * limit;
            
            const [items, totalItems] = await Promise.all([
                col().find().sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
                col().countDocuments()
            ]);
            
            const totalPages = Math.ceil(totalItems / limit);
            console.log(`📋 Fetched ${items.length} ${logLabel}s (page ${page}/${totalPages})`);
            
            res.json({
                page,
                limit,
                totalPages,
                totalItems,
                items
            });
        } catch (err) {
            console.error(`❌ Error fetching ${logLabel}s:`, err);
            sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
        }
    });

    // GET by ID (with view count increment for posts)
    app.get(`${basePath}/:id`, async (req, res) => {
        try {
            const item = await col().findOne({ _id: new ObjectId(req.params.id) });
            if (!item) return sendError(res, HTTP_STATUS.NOT_FOUND, notFoundMsg);
            
            // Increment view count (non-blocking)
            col().updateOne(
                { _id: new ObjectId(req.params.id) },
                { $inc: { viewCount: 1 } }
            ).catch(err => console.error(`Error incrementing view count:`, err));
            
            res.json(item);
        } catch (err) {
            sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
        }
    });

    // POST (create) — admin only
    app.post(basePath, verifyToken, async (req, res) => {
        try {
            if (!isAdmin(req)) return sendError(res, HTTP_STATUS.FORBIDDEN, 'Only admins can perform this action');

            const missing = requiredFields.filter(f => !req.body[f]);
            if (missing.length) return sendError(res, HTTP_STATUS.BAD_REQUEST, `Required fields missing: ${missing.join(', ')}`);

            // Sanitize HTML fields before storing
            ['content', 'description', 'desc1', 'desc2', 'quote'].forEach(field => {
                if (req.body[field] && typeof req.body[field] === 'string') {
                    req.body[field] = DOMPurify.sanitize(req.body[field]);
                }
            });

            const doc = buildDoc ? buildDoc(req.body) : req.body;
            const result = await col().insertOne({ ...doc, createdAt: new Date() });
            console.log(`📝 ${label} created:`, result.insertedId);
            sendOk(res, HTTP_STATUS.CREATED, { id: result.insertedId });
        } catch (err) {
            console.error(`❌ Error creating ${logLabel}:`, err);
            sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
        }
    });

    // PUT (update) — admin only
    app.put(`${basePath}/:id`, verifyToken, async (req, res) => {
        try {
            if (!isAdmin(req)) return sendError(res, HTTP_STATUS.FORBIDDEN, 'Only admins can perform this action');

            const missing = requiredFields.filter(f => !req.body[f]);
            if (missing.length) return sendError(res, HTTP_STATUS.BAD_REQUEST, `Required fields missing: ${missing.join(', ')}`);

            // Sanitize HTML fields before storing
            ['content', 'description', 'desc1', 'desc2', 'quote'].forEach(field => {
                if (req.body[field] && typeof req.body[field] === 'string') {
                    req.body[field] = DOMPurify.sanitize(req.body[field]);
                }
            });

            const updateData = buildUpdate ? buildUpdate(req.body) : req.body;
            updateData.updatedAt = new Date();

            const result = await col().updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: updateData }
            );

            if (result.matchedCount === 0) return sendError(res, HTTP_STATUS.NOT_FOUND, notFoundMsg);

            console.log(`✏️ ${label} updated:`, req.params.id);
            sendOk(res, HTTP_STATUS.OK);
        } catch (err) {
            console.error(`❌ Error updating ${logLabel}:`, err);
            sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
        }
    });

    // DELETE — admin only
    app.delete(`${basePath}/:id`, verifyToken, async (req, res) => {
        try {
            if (!isAdmin(req)) return sendError(res, HTTP_STATUS.FORBIDDEN, 'Only admins can perform this action');

            const result = await col().deleteOne({ _id: new ObjectId(req.params.id) });
            if (result.deletedCount === 0) return sendError(res, HTTP_STATUS.NOT_FOUND, notFoundMsg);

            console.log(`🗑️ ${label} deleted:`, req.params.id);
            sendOk(res, HTTP_STATUS.OK);
        } catch (err) {
            console.error(`❌ Error deleting ${logLabel}:`, err);
            sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
        }
    });

    // Register any extra routes (like /like, /share)
    if (extraRoutes) extraRoutes(app, basePath, collection, label, col);
}

// ==================== Like Toggle Helper ====================

function addLikeRoute(app, basePath, collection, label, col) {
    app.post(`${basePath}/:id/like`, verifyToken, async (req, res) => {
        try {
            const username = req.user.username;
            if (!username) return sendError(res, HTTP_STATUS.BAD_REQUEST, 'Username is required');

            const item = await col().findOne({ _id: new ObjectId(req.params.id) });
            if (!item) return sendError(res, HTTP_STATUS.NOT_FOUND, `${label} not found`);

            const likedBy = item.likedBy || [];
            const alreadyLiked = likedBy.includes(username);

            const newLikedBy = alreadyLiked ? likedBy.filter(u => u !== username) : [...likedBy, username];
            const newLikeCount = Math.max(0, (item.likeCount || 0) + (alreadyLiked ? -1 : 1));

            await col().updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { likedBy: newLikedBy, likeCount: newLikeCount } }
            );

            console.log(`❤️ Like toggled on ${label.toLowerCase()} ${req.params.id} by ${username} → liked=${!alreadyLiked}, count=${newLikeCount}`);
            sendOk(res, HTTP_STATUS.OK, { liked: !alreadyLiked, likeCount: newLikeCount, likedBy: newLikedBy });
        } catch (err) {
            console.error(`❌ Error toggling ${label.toLowerCase()} like:`, err);
            sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
        }
    });
}

// ==================== Health Check ====================

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', dbConnected: !!db, timestamp: new Date().toISOString() });
});

// ==================== Blog Posts (with like + share) ====================

/**
 * @swagger
 * /posts:
 *   get:
 *     summary: Get all blog posts (paginated)
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated list of posts
 *   post:
 *     summary: Create a new blog post (Admin only)
 *     tags: [Posts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201:
 *         description: Post created
 *       403:
 *         description: Unauthorized
 * /posts/{id}:
 *   get:
 *     summary: Get a single post by ID
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Post details
 *   put:
 *     summary: Update a post (Admin only)
 *     tags: [Posts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Post updated
 *   delete:
 *     summary: Delete a post (Admin only)
 *     tags: [Posts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Post deleted
 * /posts/{id}/like:
 *   post:
 *     summary: Toggle like on a post
 *     tags: [Posts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Like toggled
 * /posts/{id}/share:
 *   post:
 *     summary: Record a share event
 *     tags: [Posts]
 *     responses:
 *       200:
 *         description: Share recorded
 * /posts/popular:
 *   get:
 *     summary: Get most viewed posts
 *     tags: [Posts]
 *     responses:
 *       200:
 *         description: Top 5 posts by view count
 */

createCrudRoutes({
    path: '/posts',
    collection: 'posts',
    label: 'Post',
    requiredFields: ['title', 'description', 'content', 'image'],
    buildDoc: (body) => ({
        title: body.title,
        description: body.description,
        content: body.content,
        image: body.image,
        category: body.category || 'General',
        likeCount: 0,
        likedBy: [],
        shareCount: 0,
        viewCount: 0
    }),
    buildUpdate: (body) => {
        const data = {
            title: body.title,
            description: body.description,
            content: body.content,
            category: body.category || 'General'
        };
        if (body.image) data.image = body.image;
        return data;
    },
    extraRoutes: (app, basePath, collection, label, col) => {
        // Like toggle
        addLikeRoute(app, basePath, collection, label, col);
        // Share increment
        app.post(`${basePath}/:id/share`, async (req, res) => {
            try {
                const result = await col().updateOne(
                    { _id: new ObjectId(req.params.id) },
                    { $inc: { shareCount: 1 } }
                );
                if (result.matchedCount === 0) return sendError(res, HTTP_STATUS.NOT_FOUND, 'Post not found');
                sendOk(res, HTTP_STATUS.OK);
            } catch (err) {
                console.error('❌ Error incrementing share:', err);
                sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
            }
        });
    }
});

// Popular posts by view count
app.get('/posts/popular', async (req, res) => {
    try {
        const posts = await db.collection('posts')
            .find()
            .sort({ viewCount: -1 })
            .limit(5)
            .toArray();
        res.json(posts);
    } catch (err) {
        sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
    }
});

// ==================== Design Items (Announcements, with like) ====================

/**
 * @swagger
 * /design-items:
 *   get:
 *     summary: Get all design items (paginated)
 *     tags: [Design Items]
 *   post:
 *     summary: Create a design item (Admin only)
 *     tags: [Design Items]
 *     security: [{ bearerAuth: [] }]
 * /design-items/{id}:
 *   put:
 *     summary: Update a design item (Admin only)
 *     tags: [Design Items]
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     summary: Delete a design item (Admin only)
 *     tags: [Design Items]
 *     security: [{ bearerAuth: [] }]
 * /design-items/{id}/like:
 *   post:
 *     summary: Toggle like on a design item
 *     tags: [Design Items]
 *     security: [{ bearerAuth: [] }]
 */

createCrudRoutes({
    path: '/design-items',
    collection: 'designItems',
    label: 'Design item',
    requiredFields: ['title', 'imageUrl', 'category'],
    buildDoc: (body) => ({
        title: body.title,
        imageUrl: body.imageUrl,
        category: body.category,
        likeCount: 0,
        likedBy: []
    }),
    buildUpdate: (body) => ({
        title: body.title,
        imageUrl: body.imageUrl,
        category: body.category
    }),
    extraRoutes: (app, basePath, collection, label, col) => {
        addLikeRoute(app, basePath, collection, label, col);
    }
});

// ==================== Static Blog Items (simple CRUD, no like/share) ====================

createCrudRoutes({
    path: '/static-blog-items',
    collection: 'staticBlogItems',
    label: 'Static blog item',
    requiredFields: ['title', 'description', 'content', 'imageUrl', 'date'],
    buildDoc: (body) => ({
        title: body.title,
        description: body.description,
        content: body.content,
        imageUrl: body.imageUrl,
        date: body.date
    }),
    buildUpdate: (body) => ({
        title: body.title,
        description: body.description,
        content: body.content,
        imageUrl: body.imageUrl,
        date: body.date
    })
});

// ==================== Achievers (simple CRUD, no like/share) ====================

createCrudRoutes({
    path: '/achievers',
    collection: 'achievers',
    label: 'Achiever',
    requiredFields: ['name', 'years', 'image', 'desc1', 'desc2', 'quote'],
    buildDoc: (body) => ({
        name: body.name,
        years: body.years,
        image: body.image,
        desc1: body.desc1,
        desc2: body.desc2,
        quote: body.quote
    }),
    buildUpdate: (body) => ({
        name: body.name,
        years: body.years,
        image: body.image,
        desc1: body.desc1,
        desc2: body.desc2,
        quote: body.quote
    })
});

// ==================== Comments Routes ====================

const commentsCol = () => db.collection('comments');

// GET all comments for a specific post (sorted oldest-first for threading)
app.get('/posts/:postId/comments', async (req, res) => {
    try {
        const comments = await commentsCol()
            .find({ postId: req.params.postId })
            .sort({ createdAt: 1 })
            .toArray();
        res.json(comments);
    } catch (err) {
        console.error('❌ Error fetching comments:', err);
        sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
    }
});

// GET comment count for a post
app.get('/posts/:postId/comments/count', async (req, res) => {
    try {
        const count = await commentsCol().countDocuments({ postId: req.params.postId });
        res.json({ count });
    } catch (err) {
        console.error('❌ Error counting comments:', err);
        sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
    }
});

// POST a new comment (authenticated users only)
app.post('/posts/:postId/comments', verifyToken, async (req, res) => {
    try {
        const { body, parentId } = req.body;
        if (!body || !body.trim()) {
            return sendError(res, HTTP_STATUS.BAD_REQUEST, 'Comment body is required');
        }
        
        const cleanBody = DOMPurify.sanitize(body.trim());

        const comment = {
            postId: req.params.postId,
            author: req.user.username,
            body: cleanBody,
            parentId: parentId || null,
            createdAt: new Date()
        };
        
        const result = await commentsCol().insertOne(comment);
        console.log(`💬 Comment added by ${req.user.username} on post ${req.params.postId}`);
        sendOk(res, HTTP_STATUS.CREATED, { id: result.insertedId, comment });
    } catch (err) {
        console.error('❌ Error adding comment:', err);
        sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
    }
});

// DELETE a comment (admin or comment author)
app.delete('/posts/:postId/comments/:id', verifyToken, async (req, res) => {
    try {
        const comment = await commentsCol().findOne({ _id: new ObjectId(req.params.id) });
        if (!comment) return sendError(res, HTTP_STATUS.NOT_FOUND, 'Comment not found');
        
        // Only admin or the comment's author can delete
        if (!isAdmin(req) && req.user.username !== comment.author) {
            return sendError(res, HTTP_STATUS.FORBIDDEN, 'You can only delete your own comments');
        }
        
        await commentsCol().deleteOne({ _id: new ObjectId(req.params.id) });
        console.log(`🗑️ Comment deleted by ${req.user.username}`);
        sendOk(res, HTTP_STATUS.OK);
    } catch (err) {
        console.error('❌ Error deleting comment:', err);
        sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
    }
});

// -------------------- Admin Utilities: Recompute & Audit --------------------

async function recomputeLikeCountsForCollections(collectionNames) {
    const summary = {};
    for (const name of collectionNames) {
        const col = db.collection(name);
        const cursor = col.find();
        let matched = 0, modified = 0, anomalies = 0;
        const bulk = col.initializeUnorderedBulkOp();

        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            const likedBy = Array.isArray(doc.likedBy) ? doc.likedBy : [];
            const desired = likedBy.length;
            const current = (typeof doc.likeCount === 'number' && Number.isFinite(doc.likeCount)) ? doc.likeCount : null;

            // Consider as anomaly if likeCount differs from desired, is missing, negative, non-integer, or extremely large
            const isAnomaly = current !== desired || current === null || current < 0 || !Number.isInteger(current) || Math.abs(current) > 1e12;
            if (isAnomaly) {
                anomalies++;
                matched++;
                bulk.find({ _id: doc._id }).updateOne({ $set: { likedBy: likedBy, likeCount: desired } });
            }
        }

        if (matched > 0) {
            const result = await bulk.execute();
            modified = result.nModified || result.nModified === undefined ? (result.nModified || Object.values(result).reduce((s, v) => s + (v.nModified || 0), 0)) : result.nModified;
        }

        summary[name] = { checked: true, matched, modified, anomalies };
    }
    return summary;
}

// Compute diffs without applying updates (dry-run)
async function computeLikeCountsDiff(collectionNames) {
    const summary = {};
    for (const name of collectionNames) {
        const col = db.collection(name);
        const cursor = col.find();
        let matched = 0, anomalies = 0;
        const samples = [];

        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            const likedBy = Array.isArray(doc.likedBy) ? doc.likedBy : [];
            const desired = likedBy.length;
            const current = (typeof doc.likeCount === 'number' && Number.isFinite(doc.likeCount)) ? doc.likeCount : null;
            const isAnomaly = current !== desired || current === null || current < 0 || !Number.isInteger(current) || Math.abs(current) > 1e12;
            if (isAnomaly) {
                matched++;
                anomalies++;
                samples.push({ _id: doc._id, current, desired });
                if (samples.length >= 5) continue;
            }
        }

        summary[name] = { matched, anomalies, sample: samples };
    }
    return summary;
}

/**
 * Dry-run endpoint: compute diffs but do NOT modify the DB
 */
app.get('/api/admin/recompute-like-counts/dry', verifyToken, async (req, res) => {
    try {
        if (!isAdmin(req)) return sendError(res, HTTP_STATUS.FORBIDDEN, 'Only admins can perform this action');
        const targets = ['posts', 'designItems', 'staticBlogItems', 'achievers'];
        const diff = await computeLikeCountsDiff(targets);
        sendOk(res, HTTP_STATUS.OK, { diff });
    } catch (err) {
        console.error('❌ Admin dry-run error:', err);
        sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
    }
});

async function auditIndexes() {
    const info = {};
    const collections = await db.listCollections().toArray();
    for (const c of collections) {
        try {
            const idx = await db.collection(c.name).indexes();
            info[c.name] = idx;
        } catch (err) {
            info[c.name] = { error: err.message };
        }
    }
    return info;
}

/**
 * @swagger
 * /api/admin/recompute-like-counts:
 *   post:
 *     summary: Recompute like counts across collections (Admin only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 */
app.post('/api/admin/recompute-like-counts', verifyToken, async (req, res) => {
    try {
        if (!isAdmin(req)) return sendError(res, HTTP_STATUS.FORBIDDEN, 'Only admins can perform this action');

        // Collections to target — only those that may carry likeCount/likedBy fields
        const targets = ['posts', 'designItems', 'staticBlogItems', 'achievers'];
        const result = await recomputeLikeCountsForCollections(targets);
        console.log('🛠️ Admin recompute performed by', req.user.username);

        // Persist audit record for history and UI
        try {
            const auditsCol = db.collection('adminAudits');
            await auditsCol.insertOne({
                action: 'recompute-like-counts',
                user: req.user.username,
                timestamp: new Date(),
                result
            });
        } catch (err) {
            console.error('❌ Failed to persist admin audit record:', err.message);
        }

        sendOk(res, HTTP_STATUS.OK, { result });
    } catch (err) {
        console.error('❌ Admin recompute error:', err);
        sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
    }
});

/**
 * @swagger
 * /api/admin/audit-indexes:
 *   get:
 *     summary: Audit DB indexes across collections (Admin only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 */
app.get('/api/admin/audit-indexes', verifyToken, async (req, res) => {
    try {
        if (!isAdmin(req)) return sendError(res, HTTP_STATUS.FORBIDDEN, 'Only admins can perform this action');
        const idx = await auditIndexes();
        sendOk(res, HTTP_STATUS.OK, { indexes: idx });
    } catch (err) {
        console.error('❌ Admin audit indexes error:', err);
        sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
    }
});

// Return recent admin audit records
app.get('/api/admin/audits', verifyToken, async (req, res) => {
    try {
        if (!isAdmin(req)) return sendError(res, HTTP_STATUS.FORBIDDEN, 'Only admins can perform this action');
        const col = db.collection('adminAudits');
        const rows = await col.find().sort({ timestamp: -1 }).limit(100).toArray();
        sendOk(res, HTTP_STATUS.OK, { audits: rows });
    } catch (err) {
        console.error('❌ Error fetching admin audits:', err);
        sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
    }
});


// ==================== Authentication ====================

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: User login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: JWT token returned
 *       401:
 *         description: Invalid credentials
 */
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return sendError(res, HTTP_STATUS.BAD_REQUEST, 'Username and password are required');
        }
        
        const user = VALID_USERS[username];
        if (!user) {
            return sendError(res, HTTP_STATUS.UNAUTHORIZED, 'Invalid credentials');
        }
        
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
            return sendError(res, HTTP_STATUS.UNAUTHORIZED, 'Invalid credentials');
        }
        
        const token = generateToken({ username, role: user.role });
        console.log(`🔑 User logged in: ${username} (${user.role})`);
        sendOk(res, HTTP_STATUS.OK, { token, username, role: user.role });
    } catch (err) {
        console.error('❌ Login error:', err);
        sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
    }
});

// ==================== Swagger UI ====================

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ==================== Static Routes ====================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'LOGIN_PAGE.html')));
app.get('/homepage.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'homepage.html')));

// ==================== 404 Handler ====================

app.use((req, res) => {
    res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 — Page Not Found | UniBlog</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.1/css/all.min.css" crossorigin="anonymous" />
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Quicksand:wght@400;500&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #faf9f6 0%, #eeede8 100%);
            font-family: 'Quicksand', sans-serif;
            color: #1e1e2e;
        }
        .error-wrap {
            text-align: center;
            padding: 2rem;
        }
        .error-code {
            font-family: 'Playfair Display', serif;
            font-size: 8rem;
            font-weight: 700;
            color: #c7901e;
            line-height: 1;
            margin-bottom: 0.5rem;
        }
        .error-title {
            font-family: 'Playfair Display', serif;
            font-size: 2rem;
            margin-bottom: 0.8rem;
        }
        .error-desc {
            color: #6b6b7a;
            font-size: 1.1rem;
            margin-bottom: 2rem;
            max-width: 480px;
            margin-left: auto;
            margin-right: auto;
        }
        .error-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.8rem 2rem;
            background: #1e1e2e;
            color: #f0ede8;
            text-decoration: none;
            border-radius: 999px;
            font-weight: 500;
            font-size: 1rem;
            transition: all 0.3s ease;
        }
        .error-btn:hover {
            background: #c7901e;
            color: #1a1a28;
            box-shadow: 0 8px 24px rgba(199, 144, 30, 0.3);
        }
    </style>
</head>
<body>
    <div class="error-wrap">
        <div class="error-code">404</div>
        <h1 class="error-title">Page Not Found</h1>
        <p class="error-desc">The page you're looking for doesn't exist or has been moved. Let's get you back on track.</p>
        <a href="/homepage.html" class="error-btn"><i class="fas fa-home"></i> Back to Home</a>
    </div>
</body>
</html>`);
});

// ==================== Server Start ====================

async function startServer() {
    hashPasswords();
    await connectDB();
    app.listen(port, () => {
        console.log(`\n🚀 Blog Server running at: http://localhost:${port}`);
        console.log('   Homepage: http://localhost:' + port + '/homepage.html');
        console.log('   Add Post: http://localhost:' + port + '/blog.html');
        console.log('   Login:    http://localhost:' + port + '/LOGIN_PAGE.html');
        console.log('   Health:   http://localhost:' + port + '/api/health');
        console.log('   API Docs: http://localhost:' + port + '/api-docs\n');
    });
}

startServer();
