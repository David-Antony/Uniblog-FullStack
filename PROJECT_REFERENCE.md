# 🚀 Blog Website — Project Reference

> **Quick Intro:** A full-stack blog platform where **Admins** publish & manage content (posts, announcements, achievers) and **Students** browse, like & share. Built with vanilla **HTML/CSS/JS** on the frontend and **Express.js + MongoDB** on the backend.

---

## 📁 Project File Structure

```
blog-website/
├── .gitignore              # Excludes .env, node_modules/, logs, IDE files, OS files, data/
├── package.json            # Project metadata, scripts, dependencies
├── package-lock.json       # Dependency lockfile
├── server.js               # Express.js server (API routes, MongoDB, auth)
├── PROJECT_REFERENCE.md    # ← THIS FILE
└── public/
    ├── homepage.html       # Main page: blog grid, announcements, achievers carousel
    ├── blog.html           # Admin-only blog post editor (create/edit posts)
    ├── LOGIN_PAGE.html     # Login form (admin / student)
    ├── logout.html         # Clears auth data on logout
    ├── scripts.js          # All frontend logic (~1300 lines)
    ├── style.css           # All styles, animations, responsive layout
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
│ localStorage │                           │ x-username   │                    │ • staticBlog │
│ (username,   │                           │ x-role       │                    │   Items      │
│  role)       │                           │ header       │                    │ • achievers  │
└──────────────┘                           └──────────────┘                    └──────────────┘
```

**Flow:**
1. User logs in → [`LOGIN_PAGE.html`](public/LOGIN_PAGE.html) sends credentials to `/api/login`
2. Server validates → returns `{ username, role }` → stored in `localStorage`
3. Every API request includes `x-username` and `x-role` headers for auth
4. **Admin** can create/edit/delete any content; **Student** can only read, like & share
5. Frontend fetches data from 4 API endpoints and renders dynamically

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
| **MongoDB v6** | NoSQL database — stores all content |
| **MongoDB Native Driver** | Direct MongoDB connection (no Mongoose ODM) |
| **body-parser** | Parses JSON request bodies (up to 50MB for Base64 images) |
| **express-rate-limit** | Rate limiting — 100 requests per 15 minutes per IP |
| **dotenv** | Loads environment variables from `.env` file |

### Database

| Detail | Value |
|---|---|
| **Database** | MongoDB |
| **Database Name** | `blogDB` |
| **Collections** | `posts`, `designItems`, `staticBlogItems`, `achievers` |
| **Indexes** | `posts.createdAt` (descending), `posts.category` |
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
| **Student** | `student` / `student123` | Read-only, like posts & announcements, share posts |

> ⚠️ **Production Note:** Credentials are stored in `.env` (never pushed to GitHub). For real production, use **bcrypt** password hashing and **JWT** tokens instead of plain-text comparison and HTTP headers.

**Auth Flow:**
- Login → credentials checked against `.env` values
- Success → `{ username, role }` stored in `localStorage`
- Every API call includes `x-username` and `x-role` headers
- Backend middleware checks headers for admin-only routes

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
| **Auth Middleware** | `isAdmin(headers)` / `isAuthenticated(headers)` check `x-role` header |
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

---

## 📦 npm Scripts

| Command | What It Does |
|---|---|
| `npm start` | Runs `node server.js` — starts the production server |
| `npm run dev` | Runs `nodemon server.js` — auto-restart on file changes |
| `npm test` | Placeholder — no tests configured yet |

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

# 3. Start MongoDB (must be running locally)
mongod

# 4. Start the server
npm start

# 5. Open in browser
#    Login:    http://localhost:3001
#    Homepage: http://localhost:3001/homepage.html
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

---

> **Last Updated:** May 2026 &nbsp;|&nbsp; **Project Type:** Full-Stack Web Application &nbsp;|&nbsp; **License:** ISC
