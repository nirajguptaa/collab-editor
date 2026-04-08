# CodeCollab — Real-Time Collaborative Code Editor

A collaborative code editor where multiple users can write and run code together in real time. Think Google Docs but for code — with a built-in compiler.

---

## What it does

- Multiple users open the same room and edit code simultaneously
- Changes appear on everyone's screen instantly
- Anyone in the room can run the code and everyone sees the output
- Supports C++, Python, and JavaScript execution
- Syntax highlighting for 14+ languages

---

## Demo

> Two users editing and running C++ code at the same time

![Editor Screenshot](image.png)

---

## Tech Stack

| What | Technology |
|------|-----------|
| Frontend | React  |
| Code Editor | Monaco Editor (same engine as VS Code) |
| Real-time | Socket.io (WebSockets) |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Cache & Messaging | Redis |
| Code Execution | Docker containers |
| Auth | JWT (JSON Web Tokens) |
| Infrastructure | Docker Compose  |

---

## Features

**Collaboration**
- Real-time code sync — what you type appears on all screens instantly
- Conflict resolution — if two users type at the same time, both edits are preserved correctly
- Live presence — see who else is in the room
- Language sync — when someone changes the language, it updates for everyone

**Code Execution**
- Run C++, Python, and JavaScript directly in the browser
- Provide input (stdin) to your program via the input box
- Output appears for all users in the room simultaneously
- Safe execution — code runs in an isolated Docker container with resource limits

**Authentication**
- Register and login with email and password
- JWT-based auth — stays logged in across sessions
- Room access control — private rooms for members only

---

## How It Works

### Real-time editing

When you type a character, it gets sent to the server as an "operation" (insert or delete). The server applies the operation to the document and broadcasts it to everyone else in the room via WebSockets.

### Conflict resolution (Operational Transformation)

The hard problem: what if two users type on the same line at the exact same millisecond?

Example — document is `"hello"`:
- User A types `X` at position 2 → wants `"heXllo"`
- User B types `Y` at position 2 → wants `"heYllo"`

Without any handling, the result would be wrong. The server uses **Operational Transformation (OT)** to adjust the position of each operation based on what happened concurrently. Both edits land correctly and every user ends up with the same document.

### Code execution

When you click Run:
1. Your code is sent to the server
2. The server writes it to a temp file and spins up a fresh Docker container
3. The container compiles and runs the code with a 15-second time limit
4. Output is sent back and broadcast to everyone in the room
5. The container is destroyed immediately after

The container runs with `--network=none` (no internet access), memory limits, and CPU limits — so malicious or infinite-loop code can't affect the server.

### Why Redis

The backend can run as multiple instances. Redis acts as a message bus between them — when one instance receives a keystroke, it publishes to Redis, and all other instances pick it up and forward it to their connected users.

---

## Project Structure

```
collab-editor/
├── backend/
│   └── src/
│       ├── config/          — database and Redis connections
│       ├── controllers/     — route handlers (auth, rooms, users)
│       ├── middleware/       — JWT auth, error handling
│       ├── models/
│       │   └── schema.sql   — PostgreSQL tables
│       ├── routes/          — API endpoints
│       ├── services/
│       │   ├── ot.service.js       — Operational Transformation engine
│       │   └── executor.service.js — sandboxed code execution
│       └── socket/
│           └── index.js     — WebSocket server and real-time logic
├── frontend/
│   └── src/
│       ├── components/editor/  — Monaco editor + output panel
│       ├── hooks/              — useSocket (real-time connection)
│       ├── pages/              — Login, Register, Dashboard, Room
│       ├── services/           — API client, socket client
│       └── store/              — auth and editor state (Zustand)
├── docker/
│   └── nginx.conf           — reverse proxy config
├── docker-compose.yml
└── .env.example
```

---

## Running Locally

**Requirements:** Docker Desktop, Node.js 18+

```bash
# 1. Clone the repo
git clone https://github.com/nirajguptaa/collab-editor
cd collab-editor

# 2. Set up environment
cp .env.example .env
# Open .env and fill in JWT_ACCESS_SECRET and JWT_REFRESH_SECRET
# (make them any long random strings)

# 3. Start everything
docker compose up --build
```

Open **http://localhost** in your browser.

First startup pulls Docker images and takes 2–3 minutes. After that it's fast.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/rooms` | List your rooms |
| POST | `/api/rooms` | Create a room |
| GET | `/api/rooms/:slug` | Get room + document |
| POST | `/api/rooms/:slug/execute` | Run code |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join-room` | client → server | Join a room, get current document |
| `operation` | client → server | Send a keystroke (insert or delete) |
| `remote-operation` | server → client | Receive someone else's keystroke |
| `cursor-move` | client → server | Update cursor position |
| `presence` | server → client | Who is currently in the room |
| `execution-result` | server → client | Output from a code run |

---

## Environment Variables

```env
# Server
NODE_ENV=development
PORT=4000

# Database
DATABASE_URL=postgresql://collab:collab_secret@postgres:5432/collab_editor

# Redis
REDIS_URL=redis://redis:6379

# Auth — change these to any long random strings
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# Optional — for AI autocomplete feature
# ANTHROPIC_API_KEY=sk-ant-...
```

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Accounts — username, email, hashed password |
| `refresh_tokens` | Login sessions |
| `rooms` | Collaborative rooms with a shareable slug |
| `room_members` | Who has access to which room |
| `documents` | Current code snapshot for each room |
| `operations` | Full history of every edit ever made |
| `room_activity` | Who joined and left, and when |

---

## Supported Languages

| Language | Execution | Syntax Highlighting |
|----------|-----------|-------------------|
| C++ | ✅ | ✅ |
| Python | ✅ | ✅ |
| JavaScript | ✅ | ✅ |
| TypeScript | — | ✅ |
| Java | — | ✅ |
| Go | — | ✅ |
| Rust | — | ✅ |
| HTML/CSS | — | ✅ |
| SQL | — | ✅ |

---

## Security

- Passwords hashed with bcrypt (cost factor 12)
- JWT access tokens expire in 15 minutes
- Refresh tokens stored as SHA-256 hashes in the database
- Code execution runs in isolated Docker containers with:
  - No network access (`--network=none`)
  - 128MB memory limit
  - 0.5 CPU limit
  - 15-second timeout
  - Container destroyed after every run

---

## What I Learned Building This

- How real-time collaborative editing works under the hood (OT algorithm)
- Why distributed systems need a message broker like Redis
- How to safely run untrusted code using Docker sandboxing
- JWT authentication with token refresh flow
- WebSocket event design for a multi-user application
- Docker Compose for local development with multiple services