# 🚀 Deploy Guide — make it live on the internet

The frontend (Vercel) alone can't log in — it needs a **backend** (API) and a
**database**. The full live stack is:

```
Vercel (frontend)  ──HTTPS──►  Render (Express API)  ──►  MongoDB Atlas (database)
```

Why login currently fails on the deployed site: the frontend calls `/api/...`,
but no backend is connected, so those requests return the HTML page instead of
JSON. Fix = deploy the API and point the frontend at it.

---

## Step 1 — MongoDB Atlas (free database)

1. Create a free cluster at https://www.mongodb.com/cloud/atlas
2. Database Access → add a user (username + password).
3. Network Access → allow `0.0.0.0/0` (or Render's IPs).
4. Connect → "Drivers" → copy the connection string, e.g.
   `mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/assessment_app`
   (add `/assessment_app` as the db name before the `?`).

Keep this as **`MONGO_URI`**.

---

## Step 2 — Backend on Render (free)

1. https://dashboard.render.com → **New +** → **Blueprint** → connect this repo.
   Render reads `render.yaml` and creates the `assessment-api` web service.
   **Set the branch to the one with the new code** (e.g. `feature/saas-platform`
   or `master` after merging — see Step 4).
2. When prompted, set these env vars (render.yaml marks them `sync:false`):
   - `MONGO_URI` = the Atlas string from Step 1
   - `CLIENT_ORIGIN` = your Vercel URL, e.g. `https://assessment-manager-five.vercel.app`
   - `ANTHROPIC_API_KEY` = (optional) your Claude key to enable AI features
   - `JWT_SECRET` is auto-generated; `JWT_EXPIRES_IN` / `NODE_ENV` are preset.
3. Deploy. You'll get a backend URL like `https://assessment-api-xxxx.onrender.com`.
   Verify: open `https://assessment-api-xxxx.onrender.com/api/health` → should
   return `{"status":"ok",...}` (JSON).

> Note: Render free tier sleeps after inactivity (first request is slow to wake).
> Uploaded files use local disk, which is wiped on redeploy — fine for a demo,
> swap to S3/Cloudinary for production.

---

## Step 3 — Point the frontend at the backend (Vercel)

The client reads `VITE_API_URL` at **build time** (`baseURL = VITE_API_URL + '/api'`).

1. Vercel project → **Settings → Environment Variables** → add:
   - `VITE_API_URL` = `https://assessment-api-xxxx.onrender.com` (the Render URL, no trailing slash)
2. Make sure the project's **Root Directory = `client`** (Settings → General).
3. **Redeploy** (Deployments → Redeploy) so the new env var is baked into the build.

After this, login works with the seeded accounts (all password `demo1234`):
`admin@demo.com`, `recruiter@demo.com`, `candidate@demo.com`, `super@demo.com`.

---

## Step 4 — Deploy the NEW code

The current deploy is from the old default branch. Get the new code live by
either:

- **Merge** `feature/saas-platform` into your production branch (`master`) and
  push — Vercel + Render auto-redeploy; **or**
- Point Vercel's Production Branch (and Render's branch) to
  `feature/saas-platform` directly.

---

## Quick local run (no cloud needed)

```bash
# Backend (in-memory DB, seeded)
cd server && PORT=5055 JWT_SECRET=dev node dev-local.mjs
# Frontend (proxies /api to the backend)
cd client && VITE_API_TARGET=http://localhost:5055 npm run dev
# open http://localhost:5173  → login admin@demo.com / demo1234
```
