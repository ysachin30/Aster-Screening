import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const START_TIMEOUT_MS = 10000;

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), START_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  let body: {
    student_id?: string;
    name?: string;
    phone?: string;
    whatsapp_consent?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const studentId = String(body.student_id || "").trim();
  const name = String(body.name || "").trim();

  if (!studentId || !name) {
    return jsonError("Student ID and full name are required.", 400);
  }

  try {
    const studentResponse = await fetchWithTimeout(`${BACKEND}/api/student`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        name,
        phone: body.phone || undefined,
        whatsapp_consent: Boolean(body.whatsapp_consent),
      }),
    });

    if (!studentResponse.ok) {
      return jsonError("Unable to save student details.", 502);
    }

    const sequenceResponse = await fetchWithTimeout(`${BACKEND}/api/assessment-sequence/reserve`, {
      method: "POST",
    });

    if (!sequenceResponse.ok) {
      return jsonError("Unable to allocate assessment sequence.", 502);
    }

    const sequencePayload = await sequenceResponse.json().catch(() => ({}));
    const sequence = Number(sequencePayload?.sequence);
    if (!Number.isFinite(sequence) || sequence <= 0) {
      return jsonError("Invalid assessment sequence received.", 502);
    }

    const room = `interview-${studentId}-${Date.now()}`;
    return NextResponse.json({ room, sequence });
  } catch (err) {
    console.warn("[start-interview]", err);
    return jsonError("Unable to start the assessment right now. Please try again.", 502);
  }
}
