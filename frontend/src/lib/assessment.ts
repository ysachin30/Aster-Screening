export const ASSESSMENT_SEQUENCE_START = 2793;

const ASSESSMENT_SEQUENCE_SESSION_KEY = "aestr-current-sequence";
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

function readStoredAssessmentSequence() {
  if (typeof window === "undefined") return null;
  const reserved = Number(window.sessionStorage.getItem(ASSESSMENT_SEQUENCE_SESSION_KEY));
  return Number.isFinite(reserved) && reserved >= ASSESSMENT_SEQUENCE_START ? reserved : null;
}

export async function reserveAssessmentSequence() {
  const stored = readStoredAssessmentSequence();
  if (stored !== null) {
    return stored;
  }

  if (typeof window === "undefined") return ASSESSMENT_SEQUENCE_START;

  const response = await fetch(`${BACKEND}/api/assessment-sequence/reserve`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Unable to reserve assessment sequence.");
  }
  const data = await response.json();
  const sequence = Number(data?.sequence);
  if (!Number.isFinite(sequence) || sequence < ASSESSMENT_SEQUENCE_START) {
    throw new Error("Invalid assessment sequence received.");
  }
  window.sessionStorage.setItem(ASSESSMENT_SEQUENCE_SESSION_KEY, String(sequence));
  return sequence;
}

export function getStoredAssessmentSequence() {
  return readStoredAssessmentSequence();
}
