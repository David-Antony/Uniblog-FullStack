const request = require('supertest');
const { setupTestApp, teardownTestApp, getAdminToken, getStudentToken } = require('./setup');

let app;
let adminToken;
let studentToken;

beforeAll(async () => {
    const result = await setupTestApp();
    app = result.app;
    adminToken = getAdminToken();
    studentToken = getStudentToken();
});

afterAll(async () => {
    await teardownTestApp();
});

describe('UniBlog API', () => {
    let postId;

    // Test 1: Health check
    test('GET /api/health returns 200 with status ok', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.dbConnected).toBe(true);
    });

    // Test 2: Login with valid admin credentials
    test('POST /api/login with admin creds returns token', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ username: 'admin', password: 'admin123' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBeDefined();
        expect(res.body.role).toBe('admin');
    });

    // Test 3: Login with wrong password
    test('POST /api/login with wrong password returns 401', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ username: 'admin', password: 'wrongpassword' });
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    // Test 4: Login with missing fields
    test('POST /api/login with missing fields returns 400', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ username: 'admin' });
        expect(res.status).toBe(400);
    });

    // Test 5: Create post as admin
    test('POST /posts with admin token creates post', async () => {
        const res = await request(app)
            .post('/posts')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'Test Post',
                description: 'A test post description',
                content: 'Test content here',
                image: 'data:image/png;base64,test123',
                category: 'General'
            });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.id).toBeDefined();
        postId = res.body.id;
    });

    // Test 6: Get paginated posts
    test('GET /posts returns paginated response', async () => {
        const res = await request(app).get('/posts?page=1&limit=3');
        expect(res.status).toBe(200);
        expect(res.body.items).toBeDefined();
        expect(res.body.totalItems).toBeDefined();
        expect(res.body.totalPages).toBeDefined();
        expect(res.body.page).toBe(1);
        expect(Array.isArray(res.body.items)).toBe(true);
    });

    // Test 7: Get single post
    test('GET /posts/:id returns post', async () => {
        const res = await request(app).get(`/posts/${postId}`);
        expect(res.status).toBe(200);
        expect(res.body.title).toBe('Test Post');
    });

    // Test 8: Update post as admin
    test('PUT /posts/:id with admin token updates post', async () => {
        const res = await request(app)
            .put(`/posts/${postId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'Updated Post',
                description: 'Updated description',
                content: 'Updated content',
                category: 'News'
            });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    // Test 9: Like a post as student
    test('POST /posts/:id/like toggles like', async () => {
        const res = await request(app)
            .post(`/posts/${postId}/like`)
            .set('Authorization', `Bearer ${studentToken}`);
        expect(res.status).toBe(200);
        expect(res.body.liked).toBe(true);
        expect(res.body.likeCount).toBe(1);
    });

    // Test 10: Unlike a post
    test('POST /posts/:id/like again unlikes', async () => {
        const res = await request(app)
            .post(`/posts/${postId}/like`)
            .set('Authorization', `Bearer ${studentToken}`);
        expect(res.status).toBe(200);
        expect(res.body.liked).toBe(false);
        expect(res.body.likeCount).toBe(0);
    });

    // Test 11: Add comment
    test('POST /posts/:postId/comments adds comment', async () => {
        const res = await request(app)
            .post(`/posts/${postId}/comments`)
            .set('Authorization', `Bearer ${studentToken}`)
            .send({ body: 'Great post!' });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    // Test 12: Get comments
    test('GET /posts/:postId/comments returns comments', async () => {
        const res = await request(app).get(`/posts/${postId}/comments`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(1);
        expect(res.body[0].body).toBe('Great post!');
    });

    // Test 13: Delete post as admin
    test('DELETE /posts/:id with admin token deletes post', async () => {
        const res = await request(app)
            .delete(`/posts/${postId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    // Test 14: Unauthorized create
    test('POST /posts without auth returns 401', async () => {
        const res = await request(app)
            .post('/posts')
            .send({ title: 'Unauthorized', description: 'Test', content: 'Test', image: 'test' });
        expect(res.status).toBe(401);
    });

    // Test 15: Student cannot create posts
    test('POST /posts with student token returns 403', async () => {
        const res = await request(app)
            .post('/posts')
            .set('Authorization', `Bearer ${studentToken}`)
            .send({ title: 'Student Post', description: 'Test', content: 'Test', image: 'test' });
        expect(res.status).toBe(403);
    });
});
