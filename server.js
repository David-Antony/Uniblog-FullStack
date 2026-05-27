require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const rateLimit = require('express-rate-limit');

// ==================== Configuration & Constants ====================

const app = express();
const port = process.env.PORT || 3001;
const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/blogDB';
const DB_NAME = 'blogDB';

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

// Valid user credentials (loaded from environment variables for security)
const VALID_CREDENTIALS = {
    'admin': { password: process.env.ADMIN_PASSWORD || 'admin123', role: 'admin' },
    'student': { password: process.env.STUDENT_PASSWORD || 'student123', role: 'student' }
};

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

function isAdmin(headers) { return headers['x-role'] === 'admin'; }
function isAuthenticated(headers) { return headers['x-role'] === 'student' || headers['x-role'] === 'admin'; }

// ==================== Middleware ====================

app.use(bodyParser.json({ limit: '50mb' }));  // Large limit for Base64 images
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting — 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', apiLimiter);

// ==================== CRUD Route Factory ====================

// Generic CRUD route builder for a MongoDB collection
// Config: { path, collection, label, requiredFields, buildDoc, buildUpdate, extraRoutes }
function createCrudRoutes(config) {
    const { path: basePath, collection, label, requiredFields, buildDoc, buildUpdate, extraRoutes } = config;
    const col = () => db.collection(collection);
    const notFoundMsg = `${label} not found`;
    const logLabel = label.toLowerCase();

    // GET all
    app.get(basePath, async (req, res) => {
        try {
            const items = await col().find().sort({ createdAt: -1 }).toArray();
            console.log(`📋 Fetched ${items.length} ${logLabel}s`);
            res.json(items);
        } catch (err) {
            console.error(`❌ Error fetching ${logLabel}s:`, err);
            sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
        }
    });

    // GET by ID
    app.get(`${basePath}/:id`, async (req, res) => {
        try {
            const item = await col().findOne({ _id: new ObjectId(req.params.id) });
            if (!item) return sendError(res, HTTP_STATUS.NOT_FOUND, notFoundMsg);
            res.json(item);
        } catch (err) {
            console.error(`❌ Error fetching ${logLabel}:`, err);
            sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
        }
    });

    // POST (create) — admin only
    app.post(basePath, async (req, res) => {
        try {
            if (!isAdmin(req.headers)) return sendError(res, HTTP_STATUS.FORBIDDEN, 'Only admins can perform this action');

            const missing = requiredFields.filter(f => !req.body[f]);
            if (missing.length) return sendError(res, HTTP_STATUS.BAD_REQUEST, `Required fields missing: ${missing.join(', ')}`);

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
    app.put(`${basePath}/:id`, async (req, res) => {
        try {
            if (!isAdmin(req.headers)) return sendError(res, HTTP_STATUS.FORBIDDEN, 'Only admins can perform this action');

            const missing = requiredFields.filter(f => !req.body[f]);
            if (missing.length) return sendError(res, HTTP_STATUS.BAD_REQUEST, `Required fields missing: ${missing.join(', ')}`);

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
    app.delete(`${basePath}/:id`, async (req, res) => {
        try {
            if (!isAdmin(req.headers)) return sendError(res, HTTP_STATUS.FORBIDDEN, 'Only admins can perform this action');

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
    app.post(`${basePath}/:id/like`, async (req, res) => {
        try {
            const username = req.headers['x-username'];
            if (!username) return sendError(res, HTTP_STATUS.BAD_REQUEST, 'Username is required');
            if (!isAuthenticated(req.headers)) return sendError(res, HTTP_STATUS.FORBIDDEN, 'Authentication required');

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

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', dbConnected: !!db, timestamp: new Date().toISOString() });
});

// ==================== Blog Posts (with like + share) ====================

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
        shareCount: 0
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

// ==================== Design Items (Announcements, with like) ====================

createCrudRoutes({
    path: '/design-items',
    collection: 'designItems',
    label: 'Design item',
    requiredFields: ['title', 'imageUrl', 'category'],
    buildDoc: (body) => ({
        title: body.title,
        imageUrl: body.imageUrl,
        category: body.category,
        likeCount: body.likeCount || 0,
        likedBy: []
    }),
    buildUpdate: (body) => {
        const data = { title: body.title, imageUrl: body.imageUrl, category: body.category };
        if (body.likeCount !== undefined) data.likeCount = body.likeCount;
        return data;
    },
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

// ==================== Authentication ====================

// Note: For production, use bcrypt hashing and JWT-based auth
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = VALID_CREDENTIALS[username];
        if (!user || user.password !== password) {
            return sendError(res, HTTP_STATUS.UNAUTHORIZED, 'Invalid credentials');
        }
        sendOk(res, HTTP_STATUS.OK, { username, role: user.role });
    } catch (err) {
        console.error('❌ Login error:', err);
        sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error occurred');
    }
});

// ==================== Static Routes ====================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'LOGIN_PAGE.html')));
app.get('/homepage.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'homepage.html')));

// ==================== Server Start ====================

async function startServer() {
    await connectDB();
    app.listen(port, () => {
        console.log(`\n🚀 Blog Server running at: http://localhost:${port}`);
        console.log('   Homepage: http://localhost:' + port + '/homepage.html');
        console.log('   Add Post: http://localhost:' + port + '/blog.html');
        console.log('   Login:    http://localhost:' + port + '/LOGIN_PAGE.html');
        console.log('   Health:   http://localhost:' + port + '/api/health\n');
    });
}

startServer();
