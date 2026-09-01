# Deployment Guide

This guide details the standard deployment topology for Batwa, intended for production or staging environments.

## Architecture Topology

The application is deployed as two decoupled services:

1.  **Frontend (React SPA):** Hosted on Vercel or Render Static Site.
2.  **Backend (FastAPI):** Hosted on a Render Web Service (Free Tier) or Railway.

---

## Backend Deployment (Render)

### Prerequisites
- A GitHub repository containing the Batwa backend code.
- A Render account.

### Configuration
1. Connect your repository to Render and create a **New Web Service**.
2. **Environment:** Python 3.10+
3. **Build Command:**
   ```bash
   pip install -r backend/requirements.txt && python backend/seed.py
   ```
   *(Note: `seed.py` creates the SQLite database file on deployment. Since Render free tier has an ephemeral filesystem, the database will reset on every deploy. This is intended for demo environments. For persistent production, attach a Render Disk and update the SQLite path in `backend/database.py`.)*
4. **Start Command:**
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port $PORT
   ```

### Environment Variables
| Variable | Description | Default |
|---|---|---|
| `BATWA_ADMIN_PIN` | Override the default `2468` admin dashboard PIN. | `2468` |
| `JWT_SECRET_KEY` | Secret key for signing Admin bearer tokens. | Generated randomly |
| `CORS_ORIGIN` | Allowed origin for frontend requests (e.g. `https://batwa.vercel.app`). | `*` |

### Cold Starts & Warm-Up
Render free tier spins down instances after 15 minutes of inactivity. When a request hits a sleeping instance, it can take up to 60 seconds to wake up (a "cold start"), which will cause frontend API requests to time out.

**Solution:** Use the `warmup.py` script before demonstrating the app.
```bash
python scripts/warmup.py https://your-backend-url.onrender.com
```
This script aggressively pings the health endpoint until awake, then exercises all 9 critical API paths to load Python modules and SQLite connections into memory.

---

## Frontend Deployment (Vercel)

### Configuration
1. Connect your repository to Vercel.
2. **Framework Preset:** Vite
3. **Root Directory:** `frontend/agent-portal`
4. **Build Command:** `pnpm build`
5. **Install Command:** `pnpm install`

### Environment Variables
Set the following environment variables in your Vercel project settings:

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | The URL of your deployed backend (e.g. `https://batwa-xrt4.onrender.com`). Do not include a trailing slash. |
| `VITE_TRANSLATION_API_URL` | URL for the MyMemory translation service (defaults to public endpoint if omitted). |

### SPA Routing (The "White Screen" Bug)
Because the frontend is a React Single Page Application (SPA) using React Router 7, deep linking directly to paths like `/admin` or refreshing the page can result in a 404 from the static hosting provider if not configured correctly.

We provide a `vercel.json` file in `frontend/agent-portal/vercel.json` that instructs Vercel to rewrite all incoming traffic to `/index.html`:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
If deploying the frontend to Render Static Sites instead of Vercel, you must manually add a Rewrite rule in the Render dashboard:
- **Source:** `/*`
- **Destination:** `/index.html`
- **Action:** Rewrite
