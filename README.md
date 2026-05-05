# GyanVihar — AI-Driven Admissions Interview

A 10-minute voice + vision AI screening for engineering admissions. The AI
interviewer speaks with the student, watches a shared interactive playground,
and scores them on **curiosity, exploratory thinking, and confidence**.

## Services

This monorepo contains three independently-deployable services (LiveKit Cloud
handles WebRTC infrastructure, so no repo is needed for that):

| Service      | Stack                                    | Path                |
|--------------|------------------------------------------|---------------------|
| `frontend`   | Next.js 14, LiveKit React, Tailwind      | `./frontend`        |
| `backend`    | Node.js, Express, PostgreSQL             | `./backend`         |
| `ai-agent`   | Python, livekit-agents, Gemini Live      | `./ai-agent`        |

Each folder is meant to be its own git repo. See per-service READMEs.

## Architecture

```
  Student Browser                 LiveKit Cloud (WebRTC SFU)              AI Agent Worker
  ┌──────────────────┐            ┌───────────────────────┐            ┌───────────────────┐
  │ Next.js frontend │──mic──────▶│                       │──mic──────▶│ MultimodalAgent   │
  │  + <canvas>      │──playground▶│   room: interview-N   │──video───▶│  Gemini Live API  │
  │  .captureStream()│            │                       │◀─voice────│  (voice in+out)   │
  └──────────────────┘◀──voice────└───────────────────────┘            └────────┬──────────┘
           ▲                                                                     │
           │  POST /api/getToken                                                 │ POST /api/evaluation
           ▼                                                                     ▼
  ┌────────────────────────────────────────────────────────────────────────────────────┐
  │                            Backend (Express + Postgres)                            │
  │  - mints LiveKit JWTs   - stores students & evaluations   - serves admin data      │
  └────────────────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- **Docker Desktop** ≥ 24 (for the backend + Postgres)
- **Node.js** ≥ 20 (for the frontend)
- **Python** ≥ 3.11 (for the AI agent)
- A **LiveKit Cloud** project — https://cloud.livekit.io → copy `URL`, `API Key`, `API Secret`
- A **Google AI Studio** API key for Gemini — https://aistudio.google.com/apikey

---

## Run all services

### 1 — Backend (Docker, includes Postgres)

```bash
cd backend
cp .env.example .env
# Edit .env — fill: LIVEKIT_API_KEY, LIVEKIT_API_SECRET
# DATABASE_URL is already set correctly for Docker; leave it.

docker compose up --build -d
# API  →  http://localhost:4000
# Postgres  →  localhost:5432  (auto-migrated)
```

### 2 — AI Agent

```bash
cd ai-agent
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — fill: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, GOOGLE_API_KEY

python agent.py dev
# Agent registers with LiveKit Cloud and waits for rooms to dispatch into
```

### 3 — Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local — fill: NEXT_PUBLIC_LIVEKIT_URL, NEXT_PUBLIC_BACKEND_URL=http://localhost:4000

npm install
npm run dev
# Frontend  →  http://localhost:3000
```

---

Open **http://localhost:3000**, enter a student ID + name, click **Start Interview**.
LiveKit dispatches the AI Agent into the room and the 10-minute session begins.

### Useful commands

```bash
# Backend logs
docker compose -f backend/docker-compose.yml logs -f

# Stop backend + DB
docker compose -f backend/docker-compose.yml down

# Wipe DB volume (reset all data)
docker compose -f backend/docker-compose.yml down -v

# Re-build backend image after code changes
docker compose -f backend/docker-compose.yml up --build -d
```
