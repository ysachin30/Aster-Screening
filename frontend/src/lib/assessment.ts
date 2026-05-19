export const ASSESSMENT_SEQUENCE_START = 2793;

const ASSESSMENT_SEQUENCE_SESSION_KEY = "aestr-current-sequence";
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const SEQUENCE_RESERVE_TIMEOUT_MS = 4000;

function readStoredAssessmentSequence() {
  if (typeof window === "undefined") return null;
  const reserved = Number(window.sessionStorage.getItem(ASSESSMENT_SEQUENCE_SESSION_KEY));
  return Number.isFinite(reserved) && reserved >= ASSESSMENT_SEQUENCE_START ? reserved : null;
}

function storeAssessmentSequence(sequence: number) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ASSESSMENT_SEQUENCE_SESSION_KEY, String(sequence));
}

export function createFallbackAssessmentSequence() {
  const stored = readStoredAssessmentSequence();
  if (stored !== null) return stored;

  const secondsSince2026 = Math.max(0, Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 1000));
  const fallback = ASSESSMENT_SEQUENCE_START + secondsSince2026;
  storeAssessmentSequence(fallback);
  return fallback;
}

export async function reserveAssessmentSequence() {
  const stored = readStoredAssessmentSequence();
  if (stored !== null) {
    return stored;
  }

  if (typeof window === "undefined") return ASSESSMENT_SEQUENCE_START;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SEQUENCE_RESERVE_TIMEOUT_MS);
  const response = await fetch(`${BACKEND}/api/assessment-sequence/reserve`, {
    method: "POST",
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeout));
  if (!response.ok) {
    throw new Error("Unable to reserve assessment sequence.");
  }
  const data = await response.json();
  const sequence = Number(data?.sequence);
  if (!Number.isFinite(sequence) || sequence < ASSESSMENT_SEQUENCE_START) {
    throw new Error("Invalid assessment sequence received.");
  }
  storeAssessmentSequence(sequence);
  return sequence;
}

export async function reserveAssessmentSequenceWithFallback() {
  try {
    return await reserveAssessmentSequence();
  } catch (err) {
    console.warn("[assessment-sequence] using fallback sequence", err);
    return createFallbackAssessmentSequence();
  }
}

export function getStoredAssessmentSequence() {
  return readStoredAssessmentSequence();
}
