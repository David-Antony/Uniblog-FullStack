# UniBlog — Campus News & Blog Platform

A full-stack blog platform built for university communities. Features role-based access (Admin & Student), rich text editing, comments, dark mode, and a modern responsive design.

![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen) ![Express](https://img.shields.io/badge/express-5.x-blue) ![MongoDB](https://img.shields.io/badge/mongodb-7.x-green) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## Features

- **Role-Based Access** — Admin (full CRUD) and Student (read-only + likes/comments)
- **Rich Text Editor** — Quill.js WYSIWYG editor for blog content
- **Comments** — Nested threaded comments on every post
- **Dark Mode** — Warm academic dark theme with persistent preference
- **Toast Notifications** — Non-blocking toast messages instead of browser alerts
- **Pagination** — Server-side pagination for blog posts
- **Search & Filter** — Full-text search and category filtering
- **View Counts & Read Time** — Engagement metrics on every post
- **Achievers Carousel** — Tilt-effect image carousel for featured achievers
- **JWT Authentication** — bcrypt-hashed passwords with JWT token auth
- **Security** — Helmet.js HTTP headers, CORS, rate limiting, XSS sanitization
- **API Documentation** — Swagger/OpenAPI docs at `/api-docs`
- **Docker Support** — Dockerfile + docker-compose.yml for containerized deployment
- **Test Suite** — 15 Jest/Supertest integration tests with in-memory MongoDB

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, Express 5 |
| **Database** | MongoDB 7 (native driver), Mongoose-free |
| **Auth** | bcrypt + jsonwebtoken (JWT) |
| **Security** | Helmet, CORS, DOMPurify, rate limiting |
| **Editor** | Quill.js (rich text) |
| **Docs** | Swagger (swagger-jsdoc + swagger-ui-express) |
| **Testing** | Jest + Supertest + mongodb-memory-server |
| **Container** | Docker + Docker Compose |
| **Frontend** | Vanilla JavaScript, CSS3 Custom Properties |

---

## Quick Start

### Prerequisites
- **Node.js** >= 18
- **MongoDB** 7.x running locally (`mongod`)

### Setup

```bash
git clone https://github.com/David-Antony/Uniblog-FullStack.git
cd Uniblog-FullStack
npm install
cp .env.example .env
```

Edit `.env` with your configuration:
```env
MONGO_URI=mongodb://localhost:27017
PORT=3001
JWT_SECRET=your-secret-key-here
ADMIN_PASSWORD=admin123
STUDENT_PASSWORD=student123
```

### Run

```bash
node server.js
```

Visit **http://localhost:3001** and log in.

### Default Accounts

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Student | `student` | `student123` |

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | Login (returns JWT) |

### Posts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/posts` | List all posts (paginated) |
| GET | `/posts/:id` | Get single post |
| POST | `/posts` | Create post (Admin) |
| PUT | `/posts/:id` | Update post (Admin) |
| DELETE | `/posts/:id` | Delete post (Admin) |
| POST | `/posts/:id/like` | Toggle like |

### Comments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/posts/:postId/comments` | List comments |
| POST | `/posts/:postId/comments` | Add comment |
| DELETE | `/posts/:postId/comments/:id` | Delete comment |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api-docs` | Swagger UI |
| GET | `/health` | Health check |

---

## Project Structure

```
Uniblog-FullStack/
├── server.js              # Express backend
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── jest.config.js
├── __tests__/
│   ├── setup.js
│   └── api.test.js
└── public/
    ├── homepage.html       # Main page
    ├── blog.html           # Blog editor
    ├── LOGIN_PAGE.html     # Login page
    ├── logout.html
    ├── style.css           # All styles (light + dark mode)
    ├── scripts.js          # All client-side logic
    ├── robots.txt
    ├── sitemap.xml
    └── images/             # Site images
```

---

## Testing

```bash
npm test
```

Runs 15 integration tests covering:
- Health check
- Login (valid, wrong password, missing fields)
- Post CRUD (create, read, update, delete)
- Pagination (correct page/limit/totals)
- Like/unlike toggle
- Comments (create + list)
- Auth enforcement (401 unauthorized, 403 forbidden)

---

## Docker

```bash
docker compose up --build
```

Starts the app on port 3001 with a MongoDB 7 container.

---

## License

MIT
