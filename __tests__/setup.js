const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

let mongoServer;
let client;
let db;
let app;

const JWT_SECRET = 'test-secret';
const JWT_EXPIRY = '1h';

const HTTP_STATUS = {
    OK: 200, CREATED: 201, BAD_REQUEST: 400,
    UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500
};

function sendError(res, code, msg) {
    return res.status(code).json({ success: false, message: msg });
}

function sendOk(res, code, data = {}) {
    return res.status(code).json({ success: true, ...data });
}

function isAdmin(req) { return req.user && req.user.role === 'admin'; }
function isAuthenticated(req) { return !!req.user; }

function generateToken(user) {
    return jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            req.user = jwt.verify(token, JWT_SECRET);
            return next();
        } catch {
            return sendError(res, HTTP_STATUS.UNAUTHORIZED, 'Invalid token');
        }
    }
    // Legacy fallback
    if (req.headers['x-username'] && req.headers['x-role']) {
        req.user = { username: req.headers['x-username'], role: req.headers['x-role'] };
        return next();
    }
    return sendError(res, HTTP_STATUS.UNAUTHORIZED, 'Authentication required');
}

// CRUD Route Factory (simplified version from server.js)
function createCrudRoutes(config) {
    const { path: basePath, collection, label, requiredFields, buildDoc, buildUpdate } = config;
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
            res.json({ page, limit, totalPages: Math.ceil(totalItems / limit), totalItems, items });
        } catch (err) { sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error'); }
    });

    // GET by ID (with view count increment)
    app.get(`${basePath}/:id`, async (req, res) => {
        try {
            const item = await col().findOne({ _id: new (require('mongodb').ObjectId)(req.params.id) });
            if (!item) return sendError(res, HTTP_STATUS.NOT_FOUND, notFoundMsg);
            col().updateOne({ _id: item._id }, { $inc: { viewCount: 1 } }).catch(() => {});
            res.json(item);
        } catch (err) { sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error'); }
    });

    // POST
    app.post(basePath, verifyToken, async (req, res) => {
        try {
            if (!isAdmin(req)) return sendError(res, HTTP_STATUS.FORBIDDEN, 'Only admins can perform this action');
            const missing = requiredFields.filter(f => !req.body[f]);
            if (missing.length) return sendError(res, HTTP_STATUS.BAD_REQUEST, `Required: ${missing.join(', ')}`);
            const doc = buildDoc ? buildDoc(req.body) : req.body;
            const result = await col().insertOne({ ...doc, createdAt: new Date() });
            sendOk(res, HTTP_STATUS.CREATED, { id: result.insertedId });
        } catch (err) { sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error'); }
    });

    // PUT
    app.put(`${basePath}/:id`, verifyToken, async (req, res) => {
        try {
            if (!isAdmin(req)) return sendError(res, HTTP_STATUS.FORBIDDEN, 'Only admins');
            const updateData = buildUpdate ? buildUpdate(req.body) : req.body;
            updateData.updatedAt = new Date();
            const result = await col().updateOne(
                { _id: new (require('mongodb').ObjectId)(req.params.id) },
                { $set: updateData }
            );
            if (result.matchedCount === 0) return sendError(res, HTTP_STATUS.NOT_FOUND, notFoundMsg);
            sendOk(res, HTTP_STATUS.OK);
        } catch (err) { sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error'); }
    });

    // DELETE
    app.delete(`${basePath}/:id`, verifyToken, async (req, res) => {
        try {
            if (!isAdmin(req)) return sendError(res, HTTP_STATUS.FORBIDDEN, 'Only admins');
            const result = await col().deleteOne({ _id: new (require('mongodb').ObjectId)(req.params.id) });
            if (result.deletedCount === 0) return sendError(res, HTTP_STATUS.NOT_FOUND, notFoundMsg);
            sendOk(res, HTTP_STATUS.OK);
        } catch (err) { sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error'); }
    });
}

// Like route helper
function addLikeRoute(basePath, collection) {
    const col = () => db.collection(collection);
    app.post(`${basePath}/:id/like`, verifyToken, async (req, res) => {
        try {
            const item = await col().findOne({ _id: new (require('mongodb').ObjectId)(req.params.id) });
            if (!item) return sendError(res, HTTP_STATUS.NOT_FOUND, 'Not found');
            const likedBy = item.likedBy || [];
            const alreadyLiked = likedBy.includes(req.user.username);
            const newLikedBy = alreadyLiked ? likedBy.filter(u => u !== req.user.username) : [...likedBy, req.user.username];
            const newLikeCount = Math.max(0, (item.likeCount || 0) + (alreadyLiked ? -1 : 1));
            await col().updateOne({ _id: item._id }, { $set: { likedBy: newLikedBy, likeCount: newLikeCount } });
            sendOk(res, HTTP_STATUS.OK, { liked: !alreadyLiked, likeCount: newLikeCount, likedBy: newLikedBy });
        } catch (err) { sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error'); }
    });
}

async function setupTestApp() {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('testDB');

    // Hash passwords
    const adminHash = await bcrypt.hash('admin123', 10);
    const studentHash = await bcrypt.hash('student123', 10);

    // Create Express app
    app = express();
    app.use(bodyParser.json({ limit: '50mb' }));

    // Register routes
    app.get('/api/health', (req, res) => res.json({ status: 'ok', dbConnected: true }));

    app.post('/api/login', async (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) return sendError(res, HTTP_STATUS.BAD_REQUEST, 'Username and password are required');
        const users = { admin: adminHash, student: studentHash };
        const hash = users[username];
        if (!hash) return sendError(res, HTTP_STATUS.UNAUTHORIZED, 'Invalid credentials');
        const match = await bcrypt.compare(password, hash);
        if (!match) return sendError(res, HTTP_STATUS.UNAUTHORIZED, 'Invalid credentials');
        const token = generateToken({ username, role: username === 'admin' ? 'admin' : 'student' });
        sendOk(res, HTTP_STATUS.OK, { token, username, role: username === 'admin' ? 'admin' : 'student' });
    });

    // Posts
    createCrudRoutes({
        path: '/posts', collection: 'posts', label: 'Post',
        requiredFields: ['title', 'description', 'content', 'image'],
        buildDoc: (body) => ({ title: body.title, description: body.description, content: body.content, image: body.image, category: body.category || 'General', likeCount: 0, likedBy: [], shareCount: 0, viewCount: 0 }),
        buildUpdate: (body) => ({ title: body.title, description: body.description, content: body.content, category: body.category || 'General', ...(body.image && { image: body.image }) })
    });
    addLikeRoute('/posts', 'posts');

    // Comments
    const commentsCol = () => db.collection('comments');
    app.get('/posts/:postId/comments', async (req, res) => {
        try {
            const comments = await commentsCol().find({ postId: req.params.postId }).sort({ createdAt: 1 }).toArray();
            res.json(comments);
        } catch { sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error'); }
    });
    app.post('/posts/:postId/comments', verifyToken, async (req, res) => {
        try {
            if (!req.body.body) return sendError(res, HTTP_STATUS.BAD_REQUEST, 'Body required');
            const comment = { postId: req.params.postId, author: req.user.username, body: req.body.body, parentId: req.body.parentId || null, createdAt: new Date() };
            const result = await commentsCol().insertOne(comment);
            sendOk(res, HTTP_STATUS.CREATED, { id: result.insertedId });
        } catch { sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error'); }
    });
    app.delete('/posts/:postId/comments/:id', verifyToken, async (req, res) => {
        try {
            const comment = await commentsCol().findOne({ _id: new (require('mongodb').ObjectId)(req.params.id) });
            if (!comment) return sendError(res, HTTP_STATUS.NOT_FOUND, 'Not found');
            if (!isAdmin(req) && req.user.username !== comment.author) return sendError(res, HTTP_STATUS.FORBIDDEN, 'Not authorized');
            await commentsCol().deleteOne({ _id: comment._id });
            sendOk(res, HTTP_STATUS.OK);
        } catch { sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Server error'); }
    });

    return { app, db };
}

async function teardownTestApp() {
    if (client) await client.close();
    if (mongoServer) await mongoServer.stop();
}

// Generate a valid token for testing
function getAdminToken() {
    return generateToken({ username: 'admin', role: 'admin' });
}

function getStudentToken() {
    return generateToken({ username: 'student', role: 'student' });
}

module.exports = { setupTestApp, teardownTestApp, getAdminToken, getStudentToken };
