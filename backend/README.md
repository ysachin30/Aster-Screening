# GyanVihar AI Interview — Backend

Node.js + Express + TypeScript API. Issues LiveKit access tokens, stores student profiles and receives final evaluations from the AI Agent.

## Stack
- Express 4, TypeScript, ESM
- `livekit-server-sdk` for token minting
- PostgreSQL (`pg`)
- `zod` for input validation

## Endpoints
- `GET  /health`
- `POST /api/getToken` — `{ room, identity, name }` → `{ token }`
- `POST /api/student` — upsert a student profile
- `GET  /api/student/:id`
- `POST /api/evaluation` — AI Agent posts final grading JSON
- `GET  /api/evaluation/:student_id`

## Setup (Docker — recommended)
```bash
cp .env.example .env
# fill LIVEKIT_API_KEY and LIVEKIT_API_SECRET
# DATABASE_URL is set automatically by docker-compose; leave it as-is in .env

docker compose up --build -d
```

- **Postgres** starts on `localhost:5432` (volume: `pgdata`).
- `db/schema.sql` is auto-applied on first boot via `docker-entrypoint-initdb.d`.
- **API** starts on `http://localhost:4000`.

```bash
docker compose logs -f api      # stream API logs
docker compose down             # stop everything
docker compose down -v          # stop + wipe the DB volume
```

## Setup (local — no Docker)
```bash
cp .env.example .env
# fill all vars including DATABASE_URL
createdb gyanvihar
psql gyanvihar -f db/schema.sql
npm install
npm run dev
```

Server listens on `http://localhost:4000`.
