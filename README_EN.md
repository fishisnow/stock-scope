[简体中文](./README.md) | English

<div align="center">

# StockScope

A full-stack project for stock research, market tracking, and investment opportunity discovery.

Built with `Next.js` + `Flask`, it combines market data collection, AI analysis, trading record management, market breadth statistics, and scheduled briefings in one repository.

</div>

---

## Value

- Brings together the core capabilities needed for stock research, trade review, and market observation
- Keeps the frontend, backend API, scheduled jobs, and deployment scripts in one maintainable codebase
- Provides a runnable engineering foundation for AI-driven opportunity discovery and market briefings

## Features

- AI-powered stock analysis and investment opportunity discovery
- Market breadth and sector-level data statistics
- Trading record import, query, and profit summaries
- Scheduled market data collection and briefing generation
- Locale-aware routing for `zh` and `en`
- Local development and Docker-based deployment

## Strengths

- Unified architecture: frontend, backend, scheduled jobs, and deployment scripts evolve together in one repository
- Dual runtime modes: supports both local split startup and unified Docker deployment
- Research-oriented scope: covers opportunity discovery, market breadth, AI briefings, and trading records
- Extendable structure: App Router on the frontend and Blueprint-based APIs on the backend make ongoing iteration straightforward

## Architecture Overview

### Frontend

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS 4
- `next-intl`
- Supabase JS

### Backend

- Python
- Flask
- Gunicorn
- Supabase
- Futu API
- OpenAI / DeepSeek

### Runtime

Production and Docker **do not run a Next.js server**. Instead:

1. **Build**: `next build` static export → `frontend/out`
2. **Runtime**: Flask (Gunicorn) on port **5001** serves both:
   - Static pages from `frontend/out`
   - Backend APIs under `/api/*`

Local workflows:

| Mode | Frontend | Backend | URLs |
|------|----------|---------|------|
| **Development** (HMR) | `npm run dev` → 3000 | `python app/main.py` → 5001 | UI at `http://localhost:3000`, API at `http://localhost:5001/api` |
| **Production-like** | `npm run build` → `out/` | Flask static + API → 5001 | Everything at `http://localhost:5001` |

`frontend/next.config.ts` uses `output: 'export'`. There is **no** Next.js dev proxy; set `NEXT_PUBLIC_API_URL` to reach the backend during development.

## Repository Structure

```text
.
├── backend/                  # Flask API, scheduled jobs, data access, market integrations
├── frontend/                 # Next.js web application
├── scripts/                  # Docker deployment and auto-deploy scripts
├── Dockerfile                # Multi-stage: static frontend + Python runtime
├── .env.example              # Backend env (includes NEXT_PUBLIC_* for Docker build)
└── SECURITY_CHECKLIST.md     # Security hardening and investigation guide
```

## Quick Start

### Requirements

- Node.js 20+
- npm
- Python 3.12+
- Docker (for containerized deployment)

### 1. Configure environment variables

**Backend** — root `.env` (see `.env.example`):

```bash
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

BOCHA_API_KEY=sk-your-bocha-api-key-here

DEEPSEEK_API_KEY=sk-your-deepseek-key
# or
OPENAI_API_KEY=sk-your-openai-key

OPENCLAW_AGENT_REPORT_KEY=your-openclaw-report-key
BRIEFING_REPORT_API_URL=http://localhost:5001
```

Note: AI analysis requires at least one of `DEEPSEEK_API_KEY` or `OPENAI_API_KEY`.

**Frontend (local dev)** — `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5001/api
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

**Docker build** — set in root `.env` (passed as `--build-arg` by `scripts/push_to_aliyun.sh`):

```bash
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### 2. Local development (split servers, best for UI work)

Terminal 1 — backend:

```bash
cd backend
pip install -r requirements.txt
python app/main.py
```

Terminal 2 — frontend with HMR:

```bash
cd frontend
npm ci
npm run dev
```

Open:

- UI: `http://localhost:3000/en`
- Health: `http://localhost:5001/api/stock-analysis/health`

### 3. Local production-like (single port, matches Docker)

```bash
cd frontend && npm ci && npm run build
cd ../backend && pip install -r requirements.txt && python app/main.py
```

Open: `http://localhost:5001/en` (static assets and API both served by Flask in `backend/app/api/api_app.py`).

## Deployment

The Docker image is a **single container on port 5001**:

- **Build stage** (Node 20): `npm run build` → `frontend/out` static export
- **Runtime** (Python 3.12): Gunicorn serves `/api/*` and static files from `frontend/out`; scheduler runs in the same container
- **No Next.js runtime** in production

Scripts:

- `scripts/push_to_aliyun.sh` — build and push; requires `NEXT_PUBLIC_*` in `.env` (use `NEXT_PUBLIC_API_URL=/api` for same-origin deploy)
- `scripts/deploy.sh` — pull image, load `.env`, expose **5001**, health check

```bash
./scripts/deploy.sh
```

After deploy: `http://<host>:5001` (UI and API on the same origin; API paths under `/api/...`).

## Security and Operations

A dedicated hardening guide is included:

- `SECURITY_CHECKLIST.md`

It covers container security, image inspection, dependency scanning, runtime monitoring, and incident investigation steps.

## Notes

- The project currently supports `en` and `zh` locale routes
- The root route redirects to a locale-prefixed page
- For deployment and hardening details, refer to `scripts/deploy.sh`, `Dockerfile`, and `SECURITY_CHECKLIST.md`
