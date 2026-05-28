# 🚀 Blog Website — Project Reference

> **Quick Intro:** A full-stack blog platform where **Admins** publish & manage content (posts, announcements, achievers) and **Students** browse, like, comment & share. Features JWT authentication, bcrypt password hashing, rich text editing, dark mode, pagination, Swagger API docs, and Docker support. Built with vanilla **HTML/CSS/JS** on the frontend and **Express.js + MongoDB** on the backend.

---

## 📁 Project File Structure

```
blog-website/
├── .env.example              # Template for environment variables
├── .gitignore                # Excludes .env, node_modules/, logs, IDE files, OS files, data/
├── .dockerignore             # Files excluded from Docker build
├── Dockerfile                # Docker container definition (Node 20 Alpine)
├── docker-compose.yml        # Multi-container setup (app + MongoDB)
├── jest.config.js            # Jest test configuration
├── package.json              # Project metadata, scripts, dependencies
├── package-lock.json         # Dependency lockfile
├── server.js                 # Express.js server (API routes, MongoDB, auth)
├── PROJECT_REFERENCE.md      # ← THIS FILE
├── __tests__/
│   ├── setup.js              # In-memory MongoDB test app builder
│   └── api.test.js           # 15 API integration tests
└── public/
    ├── homepage.html         # Main page: blog grid, announcements, achievers carousel
    ├── blog.html             # Admin-only blog post editor (create/edit posts)
    ├── LOGIN_PAGE.html       # Login form (admin / student)
    ├── logout.html           # Clears auth data on logout
    ├── robots.txt            # Search engine crawl rules
    ├── sitemap.xml           # Site URL map for SEO
    ├── scripts.js            # All frontend logic (~1300 lines)
    ├── style.css             # All styles, animations, responsive layout
    └── images/
        ├── news-1.png
        ├── news-2.png
        ├── news-3.png
        ├── news-4.png
        ├── RATAN TATA.jpg
        └── ratan-tata-2.jpg
```

---

## 🧠 How It Works (High-Level)

```
┌──────────────┐      HTTP Requests       ┌──────────────┐      Queries       ┌──────────────┐
│   Browser    │ ────────────────────────► │  Express.js  │ ─────────────────► │   MongoDB    │
│  (HTML/CSS/  │ ◄──────────────────────── │   Server     │ ◄───────────────── │   (blogDB)   │
│   JS Client) │      JSON Responses       │  (server.js) │      Results       │ Collections: │
│              │                           │              │                    │ • posts      │
│ Auth:        │                           │ Auth Check:  │                    │ • designItems│
│ localStorage │                           │ JWT Token    │                    │ • staticBlog │
│ (JWT,        │                           │ (Bearer)     │                    │   Items      │
│  role)       │                           │              │                    │ • achievers  │
└──────────────┘                           └──────────────┘                    └──────────────┘
```

**Flow:**
1. User logs in → [`LOGIN_PAGE.html`](public/LOGIN_PAGE.html) sends credentials to `/api/login`
2. Server validates with bcrypt → returns `{ username, role, token }` → JWT stored in `localStorage`
3. Every API request includes `Authorization: Bearer <token>` header for auth
4. **Admin** can create/edit/delete any content; **Student** can only read, like, comment & share
5. Frontend fetches data from API endpoints and renders dynamically

---

## 🛠️ Technology Stack (A → Z)

### Languages

| Technology | Where Used |
|---|---|
| **JavaScript (ES6+)** | [`server.js`](server.js) (Node.js backend), [`scripts.js`](public/scripts.js) (frontend), inline scripts in [`blog.html`](public/blog.html), [`LOGIN_PAGE.html`](public/LOGIN_PAGE.html) |
| **HTML5** | All `.html` files — semantic elements (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`) |
| **CSS3** | [`style.css`](public/style.css) + inline `<style>` blocks in HTML files |
| **JSON** | API request/response format between frontend ↔ backend |

### Backend

| Technology | Purpose |
|---|---|
| **Node.js** | JavaScript runtime — runs the server |
| **Express.js v5** | Web framework — routing, middleware, static file serving |
| **MongoDB v7** | NoSQL database — stores all content |
| **MongoDB Native Driver** | Direct MongoDB connection (no Mongoose ODM) |
| **body-parser** | Parses JSON request bodies (up to 50MB for Base64 images) |
| **express-rate-limit** | Rate limiting — 100 requests per 15 minutes per IP |
| **dotenv** | Loads environment variables from `.env` file |
| **bcrypt** | Password hashing (10 salt rounds) |
| **jsonwebtoken (JWT)** | Token-based authentication with 24h expiry |
| **helmet** | HTTP security headers (CSP, X-Frame-Options, etc.) |
| **cors** | Cross-Origin Resource Sharing |
| **swagger-jsdoc + swagger-ui-express** | Auto-generated interactive API docs at `/api-docs` |

### Database

| Detail | Value |
|---|---|
| **Database** | MongoDB |
| **Database Name** | `blogDB` |
| **Collections** | `posts`, `designItems`, `staticBlogItems`, `achievers` |
| **Indexes** | `posts.createdAt` (descending), `posts.category`, `posts.viewCount` (descending), `posts.likeCount` (descending), `posts.commentCount` (descending) |
| **Connection** | `mongodb://localhost:27017/blogDB` (configurable via `MONGO_URI` in `.env`) |

### Frontend (No Frameworks — Pure Vanilla)

| Technology | Purpose |
|---|---|
| **Vanilla JavaScript** | All DOM manipulation, API calls, event handling |
| **CSS Grid** | Blog post grid layout, design items grid |
| **CSS Flexbox** | Navbar, card content, modal form layouts |
| **CSS Variables (Custom Properties)** | Theming — colors, spacing, border-radius, z-index, typography |
| **CSS Keyframe Animations** | Float animation, modal slide-in |
| **CSS Media Queries** | Responsive design — mobile, tablet, desktop breakpoints |
| **Font Awesome** | Icons (heart, share, edit, delete, plus, search, etc.) |
| **Google Fonts** | Typography (loaded via CDN in HTML `<head>`) |
| **Quill.js** | Rich text editor (WYSIWYG) for blog content |

### Testing

| Technology | Purpose |
|---|---|
| **Jest** | JavaScript test runner |
| **Supertest** | HTTP assertion library for API testing |
| **mongodb-memory-server** | In-memory MongoDB instance for tests |

### APIs & Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | None | Health check (DB status) |
| `POST` | `/api/login` | None | User login |
| `GET` | `/posts` | None | Fetch all blog posts |
| `GET` | `/posts/:id` | None | Fetch single post |
| `POST` | `/posts` | Admin | Create post |
| `PUT` | `/posts/:id` | Admin | Update post |
| `DELETE` | `/posts/:id` | Admin | Delete post |
| `POST` | `/posts/:id/like` | Auth | Toggle like/unlike |
| `POST` | `/posts/:id/share` | None | Increment share count |
| `POST` | `/posts/:postId/comments` | Auth | Add comment |
| `GET` | `/posts/:postId/comments` | None | Get all comments for a post |
| `GET` | `/posts/:postId/comments/count` | None | Get comment count |
| `DELETE` | `/posts/:postId/comments/:id` | Auth | Delete comment |
| `GET` | `/posts/popular` | None | Top 5 posts by view count |
| `GET` | `/api-docs` | None | Swagger UI |
| `GET` | `/design-items` | None | Fetch all announcements |
| `POST` | `/design-items` | Admin | Create announcement |
| `PUT` | `/design-items/:id` | Admin | Update announcement |
| `DELETE` | `/design-items/:id` | Admin | Delete announcement |
| `POST` | `/design-items/:id/like` | Auth | Toggle like/unlike |
| `GET` | `/static-blog-items` | None | Fetch all static blog items |
| `POST` | `/static-blog-items` | Admin | Create static blog item |
| `PUT` | `/static-blog-items/:id` | Admin | Update static blog item |
| `DELETE` | `/static-blog-items/:id` | Admin | Delete static blog item |
| `GET` | `/achievers` | None | Fetch all achievers |
| `POST` | `/achievers` | Admin | Create achiever |
| `PUT` | `/achievers/:id` | Admin | Update achiever |
| `DELETE` | `/achievers/:id` | Admin | Delete achiever |

---

## 🔐 Authentication & Roles

| Role | Credentials (default) | Permissions |
|---|---|---|
| **Admin** | `admin` / `admin123` | Full CRUD on all content, access to blog editor, see admin UI buttons |
| **Student** | `student` / `student123` | Read-only, like posts & announcements, comment on posts, share posts |

> 🔐 Passwords are hashed with **bcrypt** (10 salt rounds). Authentication uses **JWT tokens** with 24-hour expiry. API routes are protected via `verifyToken` middleware.

**Auth Flow:**
- Login → credentials checked with bcrypt against `.env` values
- Success → `{ username, role, token }` returned (JWT with 24h expiry)
- JWT stored in `localStorage`, sent as `Authorization: Bearer <token>` header
- Backend `verifyToken` middleware validates the token on protected routes

---

## 🎨 UI Features & Effects

### Animations
| Effect | Implementation | Where |
|---|---|---|
| **Scroll Reveal** | `IntersectionObserver` API — elements fade in + slide up on scroll | Blog posts, design items, blog cards |
| **3D Tilt Effect** | `mousemove` event → CSS `perspective()` + `rotateX/Y` transforms | Blog post cards, design item cards |
| **Floating Animation** | CSS `@keyframes float` — gentle up/down bob | Hero section decorative elements |
| **Modal Slide-In** | CSS `@keyframes modalSlideIn` — slides down from top | All modals |
| **Page Loader** | Overlay div that fades out after 500ms on page load | Homepage |
| **Transition Delays** | Staggered `transitionDelay` per card (`index * 60ms`) | Scroll-revealed cards |
| **Button Loading Spinner** | Font Awesome spinner icon + disabled state during API calls | Like buttons, share buttons |
| **Dark Mode Transition** | Smooth `background-color` + `color` transition on theme switch (0.3s) | Theme toggle |

### Interactions
| Feature | Description |
|---|---|
| **Like/Unlike Toggle** | Click heart to like (fills red), click again to unlike (outline). Updates count live. |
| **Share** | Uses Web Share API on mobile, clipboard copy fallback on desktop |
| **Search** | Debounced (300ms) text search — filters posts by title & description |
| **Category Filters** | Checkboxes (Announcement, Design, News, General) — toggle to filter posts |
| **Hamburger Menu** | Mobile responsive — toggles nav links with smooth transition |
| **Achievers Carousel** | Previous/Next buttons cycle through achiever profiles |
| **Confirmation Modal** | Custom "Are you sure?" dialog for delete operations |
| **ESC to Close** | Press Escape key to close any open modal |
| **Click-Outside to Close** | Click backdrop area of modal to dismiss |
| **Read More Modal** | Opens full post content in a modal overlay |
| **Image Upload** | "Browse" button → FileReader → Base64 conversion → auto-fills URL field |
| **Image Validation** | Accepts URLs, relative paths (`images/...`), and Base64 data URIs |
| **5MB Upload Limit** | Client-side file size check before Base64 conversion |
| **Rich Text Editor** | Quill.js WYSIWYG editor with bold, italic, underline, headings, lists, links, images |
| **Nested Comments** | Reply to specific comments, threaded display |
| **Pagination Controls** | Page numbers with Previous/Next, ellipsis for large page counts |
| **Dark Mode Toggle** | Sun/Moon icon button in navbar, persists across sessions |
| **View Count** | Tracks and displays how many times each post has been read |
| **Read Time** | Estimated reading time based on word count (200 wpm) |

### Responsive Design
| Breakpoint | Behavior |
|---|---|
| **Desktop (>992px)** | Multi-column grid, full navbar, side-by-side layouts |
| **Tablet (768–992px)** | Reduced columns, adjusted font sizes |
| **Mobile (<768px)** | Single column, hamburger menu, stacked cards, compact forms |

---

## ⚙️ Architecture Patterns

### Backend (`server.js`)
| Pattern | Description |
|---|---|
| **CRUD Route Factory** | `createCrudRoutes()` function generates all 5 HTTP routes per collection from a single config object |
| **Like Route Factory** | `addLikeRoute()` generates like/unlike toggle endpoint for any collection with `likedBy[]` + `likeCount` |
| **Response Helpers** | `sendOk()` / `sendError()` — standardized JSON `{ success, ...data }` format |
| **JWT Middleware** | `verifyToken()` — validates Bearer token or legacy headers |
| **Security Headers** | Helmet sets 11+ security headers automatically |
| **Auth Middleware** | `isAdmin(headers)` / `isAuthenticated(headers)` check JWT or `x-role` header |
| **Rate Limiting** | Applied to `/api/*` routes — 100 req/15min per IP |
| **Environment Config** | All secrets in `.env` via `dotenv`; defaults in code for local dev |

### Frontend (`scripts.js`)
| Pattern | Description |
|---|---|
| **Shared Delete Helper** | `deleteEntity()` — handles confirm → DELETE → refresh for all entities |
| **Shared Form Submit Helper** | `submitEntityForm()` — handles validate → POST/PUT → close → refresh for all forms |
| **Shared Like Cache Updater** | `updateCacheLike()` — updates `likedBy[]` + `likeCount` in cache for all like-toggles |
| **Exponential Backoff Retry** | `fetchWithRetry()` — retries failed API calls with increasing delays |
| **Debounced Search** | `debounce()` utility — 300ms delay before search triggers |
| **XSS Sanitization** | `sanitizeHTML()` — renders user content as text (not HTML) to prevent injection |
| **Component Rendering** | Each entity has `createXElement()` + `renderXItems()` + `fetchXItems()` pattern |
| **State Caching** | All fetched data stored in `postsCache`, `designItemsCache`, `staticBlogItemsCache`, `achieversCache` |
| **Dark Mode** | CSS custom properties swap via `[data-theme="dark"]`, localStorage persistence |
| **Comment Threading** | Nested comment tree with parent/child relationships |
| **Pagination** | Server-side pagination with page number controls, ellipsis |

---

## 📦 npm Scripts

| Command | What It Does |
|---|---|
| `npm start` | Runs `node server.js` — starts the production server |
| `npm run dev` | Runs `nodemon server.js` — auto-restart on file changes |
| `npm test` | Runs all 15 Jest API integration tests |
| `npm run docker:up` | Starts app + MongoDB via Docker Compose |
| `npm run docker:down` | Stops Docker containers |

---

## 🔐 Security Measures

| Measure | Where |
|---|---|
| **`.env` excluded from Git** | Sensitive credentials never committed |
| **`node_modules/` excluded** | Dependencies installed via `npm install` |
| **Rate Limiting** | 100 requests per 15 minutes per IP on `/api/*` |
| **XSS Prevention** | `sanitizeHTML()` renders user input as text nodes, not HTML |
| **Admin-Only Routes** | Backend checks `x-role: admin` header on all POST/PUT/DELETE |
| **Body Size Limit** | 50MB JSON limit (for Base64 images) |
| **No Secrets in Frontend** | Credentials only in server-side `.env` and `server.js` |
| **bcrypt Hashing** | Passwords hashed with bcrypt (10 rounds) — never stored in plain text |
| **JWT Tokens** | Tamper-proof authentication tokens with expiry |
| **Helmet.js** | 11+ HTTP security headers (CSP, X-Content-Type, etc.) |
| **Input Validation** | Server-side required field validation on all POST/PUT routes |

---

## 🐳 Docker Support

| File | Purpose |
|---|---|
| [`Dockerfile`](Dockerfile) | Node.js 20 Alpine image, production dependencies only |
| [`docker-compose.yml`](docker-compose.yml) | Two services: `app` (Express) + `mongo` (MongoDB 7 with healthcheck and persistent volume) |
| [`.dockerignore`](.dockerignore) | Excludes node_modules, .git, .env, tests, logs |

One-command startup: `docker compose up --build`

---

## 🧪 Testing

The project includes 15 automated API tests using **Jest** + **Supertest** with an in-memory MongoDB database. Tests cover:

| Category | Tests |
|---|---|
| Health Check | Server + DB connectivity |
| Authentication | Login (valid, wrong password, missing fields), JWT token generation |
| Authorization | Admin-only CRUD (403), unauthenticated requests (401) |
| Posts CRUD | Create, Read (single + paginated), Update, Delete |
| Likes | Toggle like/unlike, like count tracking |
| Comments | Add comment, get comments |

Run tests: `npm test`

---

## 🚀 How to Run

```bash
# 1. Install dependencies
npm install

# 2. Create .env file with your credentials
#    MONGO_URI=mongodb://localhost:27017/blogDB
#    ADMIN_PASSWORD=your_admin_password
#    STUDENT_PASSWORD=your_student_password
#    PORT=3001
#    JWT_SECRET=your_jwt_secret

# 3. Start MongoDB (must be running locally)
mongod

# 4. Start the server
npm start

# 5. Open in browser
#    Login:    http://localhost:3001
#    Homepage: http://localhost:3001/homepage.html

# OR — Using Docker (no MongoDB install needed):
docker compose up --build
```

---

## 📊 Database Schema (MongoDB Collections)

### `posts`
```json
{
  "_id": "ObjectId",
  "title": "String",
  "description": "String",
  "content": "String",
  "image": "String (URL or Base64)",
  "category": "String (Announcement|Design|News|General)",
  "likeCount": "Number",
  "likedBy": ["String (username)"],
  "shareCount": "Number",
  "viewCount": "Number",
  "readTime": "String",
  "comments": [
    {
      "_id": "ObjectId",
      "username": "String",
      "text": "String",
      "parentId": "ObjectId (null for top-level)",
      "createdAt": "Date"
    }
  ],
  "commentCount": "Number",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### `designItems`
```json
{
  "_id": "ObjectId",
  "title": "String",
  "imageUrl": "String (URL or Base64)",
  "category": "String",
  "likeCount": "Number",
  "likedBy": ["String (username)"],
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### `staticBlogItems`
```json
{
  "_id": "ObjectId",
  "title": "String",
  "description": "String",
  "content": "String",
  "imageUrl": "String (URL or Base64)",
  "date": "String (e.g., '20 January, 2020')",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### `achievers`
```json
{
  "_id": "ObjectId",
  "name": "String",
  "years": "String (e.g., '2020–2024')",
  "image": "String (URL or Base64)",
  "desc1": "String (paragraph 1)",
  "desc2": "String (paragraph 2)",
  "quote": "String",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

---

## 📝 Key Terms Glossary

| Term | Meaning |
|---|---|
| **CRUD** | Create, Read, Update, Delete — the 4 basic data operations |
| **API** | Application Programming Interface — how frontend talks to backend |
| **REST** | Representational State Transfer — API design style using HTTP methods (GET/POST/PUT/DELETE) |
| **MongoDB** | NoSQL document database — stores JSON-like documents in collections |
| **Express.js** | Minimal Node.js web framework — handles routing & middleware |
| **Middleware** | Functions that run between request and response (auth check, rate limit, JSON parse) |
| **Base64** | Text encoding of binary data — used to embed images directly in API requests |
| **XSS** | Cross-Site Scripting — security vulnerability prevented by `sanitizeHTML()` |
| **Debouncing** | Limiting how often a function runs — used for search (waits 300ms after typing stops) |
| **IntersectionObserver** | Browser API that detects when elements enter the viewport — used for scroll animations |
| **localStorage** | Browser storage that persists across page reloads — stores auth info |
| **sessionStorage** | Browser storage cleared on tab close — stores edit pre-fill data |
| **CSS Grid** | 2D layout system — used for blog post & design item cards |
| **CSS Flexbox** | 1D layout system — used for navbars, card internals, and forms |
| **CSS Variables** | Reusable values defined once (`--primary`, `--danger`, etc.) — used for theming |
| **Rate Limiting** | Restricting how many requests an IP can make — prevents abuse |
| **ObjectId** | MongoDB's unique identifier (12-byte hex string) for each document |
| **Web Share API** | Browser-native sharing (mobile share sheet) — fallback to clipboard copy |
| **FileReader API** | Reads files selected via `<input type="file">` — converts to Base64 |
| **Exponential Backoff** | Retry strategy — wait 1s, 2s, 4s between retries on failure |
| **JWT** | JSON Web Token — signed, tamper-proof authentication token |
| **bcrypt** | Password hashing algorithm — makes stored passwords unreadable |
| **Helmet** | Express middleware that sets HTTP security headers |
| **Swagger/OpenAPI** | API documentation standard — interactive docs at `/api-docs` |
| **Quill** | Rich text/WYSIWYG editor library |
| **Pagination** | Splitting large data sets into pages (e.g., page 1 of 5) |
| **Docker** | Container platform — packages app + dependencies into an isolated unit |

---

> **Last Updated:** May 2026 &nbsp;|&nbsp; **Project Type:** Full-Stack Web Application &nbsp;|&nbsp; **License:** ISC
