# GyanVihar AI Interview — Frontend

Next.js 14 student portal for the 10-minute AI cognitive screening. Joins a LiveKit room, publishes mic audio, and streams the interactive playground `<canvas>` as a video track so the AI Interviewer can see what the student is doing.

## Stack
- Next.js 14 (App Router), TypeScript
- Tailwind CSS
- `@livekit/components-react`, `livekit-client`

## Setup
```bash
cp .env.example .env.local
# fill NEXT_PUBLIC_LIVEKIT_URL (wss://...livekit.cloud) and NEXT_PUBLIC_BACKEND_URL
npm install
npm run dev
```

Visit http://localhost:3000

## Flow
1. `/` — student enters ID + name, clicks Start.
2. `/interview?room=...` — fetches a LiveKit token from the backend (`POST /api/getToken`), connects to the room, publishes mic, and publishes the playground canvas as a named video track (`playground`).
3. The AI Agent (separate service) joins the same room, subscribes to the audio + playground tracks, and runs the voice interview.
4. After 10 minutes, the UI freezes the playground and the Agent emits a grading JSON to the backend.

## Notes
- Linter errors before `npm install` are expected (missing `node_modules`).
- The playground is a minimal node-graph; swap in Tldraw or React Flow if desired.
