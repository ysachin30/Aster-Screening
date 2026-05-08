# GyanVihar AI Interview — Backend

Node.js + Express + TypeScript API. Issues LiveKit access tokens, stores student profiles, and receives rich interview reports from the AI Agent (legacy `/api/evaluation` remains for older agents).

## Stack
- Express 4, TypeScript, ESM
- `livekit-server-sdk` for token minting
- PostgreSQL (`pg`)
- `zod` for input validation

## Endpoints
- `GET  /health`
- `POST /api/getToken` — `{ room, identity, name }` → `{ token }`
- `POST /api/student` — upsert a student profile (`phone`, `whatsapp_consent` optional)
- `GET  /api/student/:id`
- `POST /api/evaluation` — **legacy** AI Agent posts `{ curiosity, exploratory, confidence }`
- `GET  /api/evaluation/:student_id`
- `POST /api/report` — AI Agent posts academic + personality sub-scores; server computes overall, band, shortlist
- `GET  /api/report/:student_id` — latest report for a student
- `GET  /api/report/by-id/:report_id` — one report by UUID
- `GET  /api/admin/shortlist` — query `?status=&minScore=&limit=&offset=`
- `PATCH /api/admin/report/:report_id/override` — `{ status, by }` manual shortlist override
- `PATCH /api/admin/report/:report_id/delivery` — `{ status: "sent" | "not_sent" }` after manual WhatsApp

**Existing DB volume:** `db/schema.sql` runs only on first Postgres init. If you already have a `pgdata` volume, apply new DDL manually (e.g. run the `ALTER` / `CREATE` sections from `db/schema.sql` against your DB) or `docker compose down -v` to recreate.

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
