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

- The frontend runs on port `3000`
- The backend API runs on port `5001`
- The frontend rewrites `/api/*` to `http://localhost:5001/api/*` via `frontend/next.config.ts`
- The backend entrypoint starts both the scheduler thread and the API service

## Repository Structure

```text
.
├── backend/                  # Flask API, scheduled jobs, data access, market integrations
├── frontend/                 # Next.js web application
├── scripts/                  # Docker deployment and auto-deploy scripts
├── Dockerfile                # Unified frontend + backend image build
├── .env.example              # Backend environment variables example
├── frontend/.env.example     # Frontend environment variables example
└── SECURITY_CHECKLIST.md     # Security hardening and investigation guide
```

## Quick Start

### Requirements

- Node.js 20+
- npm
- Python 3.12+
- Docker (for containerized deployment)

### 1. Configure environment variables

Frontend `frontend/.env`, based on `frontend/.env.example`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5001
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Backend `.env`, based on the root `.env.example`:

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

### 2. Start the frontend

```bash
cd frontend
npm ci
npm run dev
```

Available frontend scripts:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

### 3. Start the backend

```bash
cd backend
pip install -r requirements.txt
python app/main.py
```

Default local endpoints after startup:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5001`
- Health check: `http://localhost:5001/api/stock-analysis/health`

## Deployment

The repository includes a unified Docker build and deployment flow:

- `Dockerfile` uses a multi-stage build for the frontend and installs backend dependencies in the runtime image
- The container runs scheduled jobs, the Gunicorn backend, and the Next.js frontend together
- `scripts/deploy.sh` pulls the image, loads `.env`, starts the container, and waits for the health check

Common deployment command:

```bash
./scripts/deploy.sh
```

The deployment script exposes:

- `3000` for the frontend
- `5001` for the backend

## Security and Operations

A dedicated hardening guide is included:

- `SECURITY_CHECKLIST.md`

It covers container security, image inspection, dependency scanning, runtime monitoring, and incident investigation steps.

## Notes

- The project currently supports `en` and `zh` locale routes
- The root route redirects to a locale-prefixed page
- For deployment and hardening details, refer to `scripts/deploy.sh`, `Dockerfile`, and `SECURITY_CHECKLIST.md`
