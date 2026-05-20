import { NextResponse } from "next/server";
import { QUESTIONS } from "@/lib/interviewQuestions";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const TOKEN_TIMEOUT_MS = 10000;

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  let body: { room?: string; identity?: string; name?: string };

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const room = String(body.room || "").trim();
  const identity = String(body.identity || "").trim();
  const name = String(body.name || "").trim() || "Student";

  if (!room || !identity) {
    return jsonError("Room and identity are required.", 400);
  }

  const questions = QUESTIONS.map((q) => ({
    id: q.id,
    kind: q.kind,
    question: q.question,
    context: q.context,
    hints: q.hints,
    answer: q.answer,
    format: q.format,
    options: q.options,
    correct_option_id: q.correct_option_id,
    part_mcq: q.partMcq,
  }));

  if (!questions.length) {
    return jsonError("Interview questions are not configured.", 500);
  }

  try {
    const response = await fetchWithTimeout(`${BACKEND}/api/getToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, identity, name, questions }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return jsonError(payload.error || "Unable to prepare interview token.", 502);
    }
    if (typeof payload.token !== "string" || !payload.token) {
      return jsonError("Token response missing token.", 502);
    }

    return NextResponse.json({
      token: payload.token,
      room: payload.room || room,
      identity: payload.identity || identity,
      questions_count: payload.questions_count ?? questions.length,
    });
  } catch (err) {
    console.warn("[get-token]", err);
    return jsonError("Unable to prepare interview token.", 502);
  }
}
