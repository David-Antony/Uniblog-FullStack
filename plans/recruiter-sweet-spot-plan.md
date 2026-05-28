# 🎯 Recruiter Sweet Spot — Implementation Plan

> **Goal:** Transform from "basic blog" to "production-ready full-stack application" via 12 high-impact items.  
> **Depends on:** Group A → B → C → D → E (order matters)

---

## Execution Order

```
GROUP A — Foundation (no deps):
  Item 11: .env.example
  Item 2:  helmet.js + CORS

GROUP B — Auth Overhaul (blocks tests, comments):
  Item 1:  bcrypt + JWT auth

GROUP C — Core Features:
  Item 12: View counts + read time
  Item 4:  Pagination
  Item 3:  Swagger API docs
  Item 5:  Rich text editor (Quill)
  Item 6:  SEO meta tags

GROUP D — New Feature + UX:
  Item 7:  Comments system
  Item 8:  Dark mode toggle

GROUP E — DevOps & Quality:
  Item 10: Jest + Supertest tests
  Item 9:  Docker + docker-compose
```

---

## Item-by-Item Technical Specs

### Item 11: `.env.example`
**New file:** `.env.example`
```
MONGO_URI=mongodb://localhost:27017/blogDB
PORT=3001
JWT_SECRET=your-secret-key-change-me
ADMIN_PASSWORD=your_admin_password
STUDENT_PASSWORD=your_student_password
```

### Item 2: helmet.js + CORS
**New deps:** `helmet`, `cors`  
**Changes in server.js:**
- `const helmet = require('helmet');` + `const cors = require('cors');`
- `app.use(helmet());` after bodyParser
- `app.use(cors({ origin: '*', allowedHeaders: ['Content-Type', 'Authorization', 'x-username', 'x-role'] }));`
- CSP configured to allow inline scripts, Font Awesome, Google Fonts, and Quill CDN

### Item 1: bcrypt + JWT Auth
**New deps:** `bcrypt`, `jsonwebtoken`  
**server.js changes:**
- Add `JWT_SECRET` env var, `JWT_EXPIRY = '24h'`
- Replace `VALID_CREDENTIALS` plain-text with bcrypt-hashed passwords (use bcrypt.hashSync for static creds)
- Add `generateToken(user)` → `jwt.sign({ username, role }, JWT_SECRET, { expiresIn: JWT_EXPIRY })`
- Add `verifyToken(req, res, next)` middleware → extracts `Authorization: Bearer <token>`, verifies, sets `req.user = { username, role }`
- Replace `isAdmin(headers)` → `isAdmin(req)` checking `req.user?.role`
- Replace `isAuthenticated(headers)` → `isAuthenticated(req)` checking `req.user` exists
- Rewrite `POST /api/login` → bcrypt.compare → generateToken → return `{ success: true, token, username, role }`
- Apply `verifyToken` middleware to all POST/PUT/DELETE in `createCrudRoutes()` and `addLikeRoute()`
- Also accept legacy `x-username/x-role` headers as fallback for backwards compat

**scripts.js changes:**
- `getAuthHeaders()` → return `{ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }` (keep x-headers as fallback)
- `isAuthenticated()` → check token exists in localStorage
- Add `getStoredUsername()` / `getStoredRole()` for navbar display (stored separately from token)
- Login handler in LOGIN_PAGE.html: store `token`, `username`, `role` from response
- `logout.html`: remove `token`, `username`, `role` from localStorage

### Item 12: View Counts + Read Time
**Database:** Add `viewCount: 0` to posts `buildDoc`  
**server.js:**
- In `GET /posts/:id` → after fetch, `$inc: { viewCount: 1 }` + return updated doc
- Add `GET /posts/popular` route: `.sort({ viewCount: -1 }).limit(5)` before the main routes

**scripts.js:**
- Add `calculateReadTime(content)` → `Math.max(1, Math.ceil(content.replace(/<[^>]*>/g, '').split(/\s+/).length / 200))` (strips HTML, counts words, 200 wpm)
- `createPostElement(post)` → add `<span class="post-stat">⏱️ ${readTime} min read</span>` + `<span class="post-stat">👁️ ${viewCount} views</span>` in card footer

**style.css:** Add `.post-stats` row styling (flex, gap, muted color, small font)

### Item 4: Pagination
**server.js:** Modify GET all in `createCrudRoutes()`:
- Accept `req.query.page` (default 1), `req.query.limit` (default 6)
- Query: `.skip((page-1)*limit).limit(limit)`
- Return: `{ page, limit, totalPages: Math.ceil(total/limit), totalItems: total, items: [...] }`

**scripts.js:**
- State: `let currentPage = 1; const POSTS_PER_PAGE = 6;`
- `fetchPosts(page)` → passes `?page=${page}&limit=${POSTS_PER_PAGE}`
- Update cache and render with pagination response
- `renderPaginationControls(totalPages, currentPage)` → creates page buttons
- "Previous" / "Next" + page numbers with active state

**homepage.html:** Add `<div id="pagination-controls" class="pagination-container">` after blog container

### Item 3: Swagger API Docs
**New deps:** `swagger-jsdoc`, `swagger-ui-express`  
**server.js:**
- Define `swaggerDefinition` with info, servers, securityDefinitions (Bearer)
- Write JSDoc `@swagger` annotations in comment blocks above routes
- `app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec))`
- Log `📚 API Docs: http://localhost:${port}/api-docs` in startServer

### Item 5: Rich Text Editor (Quill)
**blog.html:**
- Add Quill CDN: `<link href="https://cdn.quilljs.com/1.3.6/quill.snow.css">` + `<script src="https://cdn.quilljs.com/1.3.6/quill.min.js">`
- Replace `<textarea id="content">` with `<div id="content-editor" style="height: 300px;">`
- Initialize Quill with toolbar: bold, italic, underline, |, heading, |, list-ordered, list-bullet, |, link, image, |, clean
- Store quill instance as `window.quill`

**scripts.js:**
- `editPost(id)` → set `window.quill.root.innerHTML = post.content`
- Form submission → extract content via `window.quill.root.innerHTML`
- `openReadMoreModal(id)` → render with `innerHTML` (content is now HTML from Quill)

**style.css:** Quill theme overrides to match site aesthetic (font, border-radius, colors)

### Item 6: SEO Meta Tags
**All .html files:** Add to `<head>`:
```html
<meta name="description" content="UniBlog — A full-stack blog platform for university news, announcements, and student achievements.">
<meta property="og:title" content="UniBlog — University Blog Platform">
<meta property="og:description" content="...">
<meta property="og:type" content="website">
<meta property="og:image" content="/images/news-1.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="UniBlog">
<meta name="robots" content="index, follow">
<link rel="canonical" href="http://localhost:3001/">
```

**New files:** `public/robots.txt`, `public/sitemap.xml`

### Item 7: Comments System
**Database:** New collection `comments`  
Schema: `{ postId: ObjectId, author: String, body: String, parentId: ObjectId|null, createdAt: Date }`

**server.js:** New route group:
- `GET /posts/:postId/comments` → `.find({ postId }).sort({ createdAt: 1 })` (chronological)
- `POST /posts/:postId/comments` → auth required, inserts `{ postId, author, body, parentId, createdAt }`
- `DELETE /posts/:postId/comments/:id` → admin or author can delete

**scripts.js:**
- `fetchComments(postId)` → returns array
- `renderComments(comments, container)` → builds nested tree (top-level + replies indented)
- `submitComment(postId, body, parentId)` → POST, refresh comments
- Update `openReadMoreModal(postId)` to include comments section + form

**style.css:** `.comment-thread`, `.comment-item`, `.comment-reply`, `.comment-form` styles  
**homepage.html:** Add `<div id="comments-section">` in read-more modal; comment count badge on cards

### Item 8: Dark Mode Toggle
**style.css:**
```css
[data-theme="dark"] {
  --dark: #f5f5f5;
  --card-bg: #1e1e2e;
  --muted: #a0a0b0;
  --soft: #16161e;
  --gray-light: #2a2a3a;
  --gray-medium: #3a3a4a;
  /* ... all relevant overrides */
  background: linear-gradient(135deg, #0f0f1a, #1a1a2e);
}
```

**scripts.js:**
- `applyTheme(theme)` → `document.documentElement.setAttribute('data-theme', theme)` + `localStorage.setItem('theme', theme)`
- `toggleTheme()` → switch and update icon (moon ⇄ sun)
- Init on page load: read localStorage, default 'light'
- Create/populate `#theme-toggle` button with Font Awesome moon/sun icon

**All HTML pages:** Add `<button id="theme-toggle" class="theme-toggle-btn">` in navbar

### Item 10: Tests
**New deps (dev):** `jest`, `supertest`, `mongodb-memory-server`  

**New files:**
- `jest.config.js` — `testEnvironment: 'node'`, `testMatch: ['**/__tests__/**/*.test.js']`
- `__tests__/setup.js` — start MongoMemoryServer, connect with native driver, export `{ app, mongoServer, db, getToken }`
- `__tests__/api.test.js` — 12 test cases covering health, auth, CRUD, pagination, likes, comments

**package.json:** `"test": "jest --forceExit --detectOpenHandles"`

### Item 9: Docker
**New files:**
- `Dockerfile` — node:20-alpine, WORKDIR /app, COPY package*.json, RUN npm ci --only=production, COPY . ., EXPOSE 3001, CMD ["node", "server.js"]
- `docker-compose.yml` — services: app (build: ., ports: 3001:3001, env_file: .env, depends_on: mongo), mongo (image: mongo:7, volumes: mongo-data:/data/db, ports: 27017:27017)
- `.dockerignore` — node_modules, .git, .env, logs, data, .aider*, plans, __tests__

**server.js:** Default MONGO_URI → `mongodb://localhost:27017/blogDB` (document override for Docker: `mongodb://mongo:27017/blogDB`)  

**package.json:** Add `"docker:up": "docker compose up --build"`, `"docker:down": "docker compose down"`
