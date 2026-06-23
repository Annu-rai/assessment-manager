# Assessment Management Application (MERN)

A full-stack application for building structured assessments, taking them, and
reviewing the submitted responses.

Hierarchy: **Category → Factor → Questions**, built through an accordion UI with
configurable question types, a reusable category library, and per-user data
isolation behind JWT authentication.

- **Stack:** MongoDB · Express · React (Vite) · Node.js
- **Sections:** Builder · Assessments · Launch Pad · Reports

---

## Table of contents

1. [Features](#features)
2. [Project structure](#project-structure)
3. [Setup instructions](#setup-instructions)
4. [Architecture overview](#architecture-overview)
5. [Key decisions](#key-decisions)
6. [API reference](#api-reference)
7. [Deployment](#deployment)
8. [AI usage summary](#ai-usage-summary)

---

## Features

| Requirement | Implementation |
|---|---|
| **Authentication** | Register / login with hashed passwords (bcrypt) and JWT. Every app route is gated; the API rejects unauthenticated requests with `401`. |
| **Navigation** | Top nav with Builder, Assessments, Launch Pad, Reports. |
| **Builder** | Accordion hierarchy Category → Factor → Questions. Inline edit of every name/question. Add/remove at each level. |
| **Question configuration** | A settings popup defines the question *types* and the *number per type* before the blank question slots are generated. |
| **Category management** | "Load Categories" popup lists previously saved categories and **appends** the selected ones to the current build. |
| **Save & reset** | Saving validates the tree, persists the assessment, resets the Builder to empty, and redirects to Assessments. |
| **Launch Pad** | Renders all questions for a selected assessment with the correct input per type and submits responses. |
| **Reports** | Lists submissions grouped Category → Factor → Question/Answer. |
| **Validation & errors** | Server-side validation (`express-validator` + Mongoose) and a central error handler; client surfaces messages inline. |

Supported question types: **multiple choice (select many)**, **single choice**,
**rating (scale)**, **text**, **yes/no**.

---

## Project structure

```
Kongu/
├── server/                 # Express + Mongoose API
│   ├── src/
│   │   ├── config/db.js     # Mongo connection
│   │   ├── models/          # User, Category, Assessment, Response
│   │   ├── controllers/     # Route handlers
│   │   ├── routes/          # Express routers
│   │   ├── middleware/      # auth, validation, error handling
│   │   ├── utils/           # token helpers, seed script
│   │   └── index.js         # app entry
│   └── .env.example
└── client/                 # React + Vite SPA
    ├── src/
    │   ├── api/             # axios client + id helper
    │   ├── context/         # AuthContext (JWT + user)
    │   ├── components/      # Navbar, modals, editors, route guard
    │   ├── pages/           # Login, Register, Builder, Assessments, LaunchPad, Reports
    │   ├── App.jsx          # routing
    │   └── index.css        # styling
    └── .env.example
```

---

## Setup instructions

### Prerequisites

- **Node.js 18+** (built and tested on Node 24)
- **MongoDB** — either a local `mongod` or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### 1. Backend

```bash
cd server
npm install
cp .env.example .env        # then edit .env
npm run dev                 # http://localhost:5000  (npm start for production)
```

`.env` values:

| Variable | Description |
|---|---|
| `PORT` | API port (default `5000`) |
| `MONGO_URI` | Mongo connection string (local or Atlas) |
| `JWT_SECRET` | Long random string used to sign tokens |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `CLIENT_ORIGIN` | Allowed CORS origin(s), comma-separated |

Optional — load demo data (creates `demo@example.com` / `demo1234` and a sample assessment):

```bash
npm run seed
```

### 2. Frontend

```bash
cd client
npm install
cp .env.example .env        # leave VITE_API_URL blank to use the dev proxy
npm run dev                 # http://localhost:5173
```

In development the Vite dev server proxies `/api` to `http://localhost:5000`, so
no extra config is needed. Open <http://localhost:5173>, register an account, and
start in the Builder.

---

## Architecture overview

### Data model

```
User  ──┐
        │ owns
        ├──► Category      (reusable template: name → factors[] → questions[])
        ├──► Assessment    (title + embedded snapshot of categories tree)
        └──► Response      (answers[] → ref Assessment)
```

- **Category** documents are the reusable library that powers *Load Categories*.
- An **Assessment embeds a full snapshot** of its category tree rather than
  referencing Category documents. Editing a template later therefore never
  mutates an assessment that has already been launched or answered.
- A **Response denormalises** each answer's category/factor/question text and
  type, so Reports render without re-walking the assessment and stay correct
  even if the source assessment changes afterwards. Each embedded question has a
  Mongo `_id`, which answers reference and the server validates on submit.

### Request flow

```
React (axios)  ──Authorization: Bearer <jwt>──►  Express
                                                   │
   protect middleware ─ verifies JWT, loads user ──┤
                                                   │
   express-validator ─ validates body ────────────┤
                                                   │
   controller ─ owner-scoped Mongoose query ───────┤
                                                   │
   errorHandler ─ normalises Mongoose/JWT errors ──┘
```

### Auth

JWT issued on register/login, stored in `localStorage`, attached to every
request by an axios interceptor. `AuthContext` validates the token on load via
`GET /auth/me` and exposes `login` / `register` / `logout`. `ProtectedRoute`
guards the client routes; the `protect` middleware guards the API. Every query
is scoped to `req.user.id`, so users only ever see their own data.

---

## Key decisions

1. **Embed-and-snapshot over normalised references.** Assessments embed the
   category tree. This trades a little duplication for correctness and read
   simplicity — a launched assessment is immutable regardless of later template
   edits, and rendering needs no `$lookup`/populate gymnastics.
2. **Categories mirrored to a library on save.** When an assessment is saved its
   categories are also written as standalone `Category` docs, which is what
   *Load Categories* reads from. Keeps the builder flow single-step while still
   building up a reusable library.
3. **Denormalised responses.** Reports must remain accurate and cheap to read,
   so answers carry their own question metadata.
4. **JWT in localStorage + axios interceptor.** Simplest correct approach for a
   SPA of this scope; keeps the API stateless. (A production app handling
   sensitive data would move to httpOnly cookies.)
5. **Validation in two layers.** `express-validator` for request shape and
   Mongoose schema/enum for data integrity, funnelled through one error handler
   that maps duplicate-key/validation/cast errors to clean status codes.
6. **No component library.** Hand-written CSS keeps the bundle small and the UI
   easy to reason about; the design system lives in CSS variables in
   `index.css`.

---

## API reference

All `/api/*` routes except `register`/`login`/`health` require
`Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create account, returns `{ user, token }` |
| `POST` | `/api/auth/login` | Authenticate, returns `{ user, token }` |
| `GET` | `/api/auth/me` | Current user |
| `GET` | `/api/categories` | List reusable categories (Load Categories) |
| `POST` | `/api/categories` | Create a category template |
| `PUT` | `/api/categories/:id` | Update a category template |
| `DELETE` | `/api/categories/:id` | Delete a category template |
| `GET` | `/api/assessments` | List the user's assessments |
| `GET` | `/api/assessments/:id` | Full assessment with question tree |
| `POST` | `/api/assessments` | Save a built assessment |
| `DELETE` | `/api/assessments/:id` | Delete an assessment |
| `POST` | `/api/responses` | Submit answers (Launch Pad) |
| `GET` | `/api/responses` | List submissions (Reports), `?assessmentId=` filter |
| `GET` | `/api/responses/:id` | A single submission |

---

## Deployment

The two apps deploy independently.

**Backend (Render / Railway / Fly):**
1. Create a MongoDB Atlas cluster; copy its connection string.
2. New Web Service from the repo, root directory `server`.
   - Build: `npm install` — Start: `npm start`
   - Env vars: `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_ORIGIN` (your
     deployed frontend URL), `NODE_ENV=production`.

**Frontend (Vercel / Netlify):**
1. New project from the repo, root directory `client`.
   - Build: `npm run build` — Output: `dist`
   - Env var: `VITE_API_URL` = deployed backend origin (e.g. `https://your-api.onrender.com`).

Set the backend's `CLIENT_ORIGIN` to the deployed frontend URL so CORS allows it.

---

## AI usage summary

This project was built with AI-assisted development (Claude / Claude Code).

### Tools used
- **Claude Code** — scaffolding, full-file generation, running an end-to-end
  smoke test, and fixing the bug it surfaced.

### Sample prompts used
- *"Design the Mongoose models for a Category → Factor → Question hierarchy where
  assessments are immutable snapshots and responses are denormalised for
  reporting."*
- *"Build a React accordion Builder: add/edit/remove categories, factors and
  questions, with a settings popup to choose question types and counts before
  generating question slots."*
- *"Implement a Load Categories modal that fetches saved categories and appends
  the selected ones to the current builder draft."*
- *"Write an end-to-end smoke test that boots an in-memory MongoDB, starts the
  real server, and exercises register → build → submit → report."*

### Generated vs manually implemented
- **AI-generated:** initial file scaffolding, REST controllers/routes, Mongoose
  schemas, React pages/components, CSS, and the smoke test harness.
- **Reviewed / directed manually:** the data-modelling decision to snapshot
  assessments and denormalise responses; the Builder state-update strategy;
  validation rules and error mapping; and verifying behaviour by running the
  smoke test (which caught a real bug — the `questionCount` virtual crashing on
  field-subset population — that was then fixed and re-verified).

> The smoke test in development uses `mongodb-memory-server`; it is a `devDependency`
> and not required to run the app.
