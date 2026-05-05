# GyanVihar AI Interview — AI Agent

Python worker that joins each LiveKit interview room as the "AI Interviewer".
Uses **Gemini Multimodal Live** for native voice-to-voice conversation and
subscribes to the student's mic + the frontend-published `playground` video
track so the model can literally watch the student work.

## Stack
- `livekit-agents` worker framework
- `livekit-plugins-google` → Gemini Multimodal Live (`gemini-2.0-flash-exp`)
- `google-generativeai` → Gemini 1.5 Pro for final grading JSON
- `httpx` to POST final evaluation to the backend

## Setup
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# fill LIVEKIT_*, GOOGLE_API_KEY, BACKEND_URL
```

## Run
```bash
# Dev mode — registers with LiveKit and dispatches one job per new room.
python agent.py dev

# Production
python agent.py start
```

## Behaviour
- Greets the student by name, runs the 10-minute flow from the system prompt.
- After `INTERVIEW_SECONDS` (default 600), asks Gemini 1.5 Pro to grade the
  transcript on **curiosity / exploratory / confidence** (0–10) and a summary.
- POSTs JSON to `${BACKEND_URL}/api/evaluation`.

## Notes
- The frontend publishes the canvas as a named video track (`playground`).
  The Multimodal Live plugin automatically forwards subscribed video frames to
  Gemini, so the model "sees" it without extra glue code.
- If you prefer OpenAI Realtime (GPT-4o), swap `livekit-plugins-google` for
  `livekit-plugins-openai` and replace the `RealtimeModel` instantiation.
