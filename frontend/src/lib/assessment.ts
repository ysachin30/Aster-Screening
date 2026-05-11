export const ASSESSMENT_SEQUENCE_START = 2793;

const ASSESSMENT_SEQUENCE_STORAGE_KEY = "aestr-sequence-counter";
const ASSESSMENT_SEQUENCE_SESSION_KEY = "aestr-current-sequence";
const ASSESSMENT_SEQUENCE_SEED = ASSESSMENT_SEQUENCE_START - 1;

export function reserveAssessmentSequence() {
  if (typeof window === "undefined") return ASSESSMENT_SEQUENCE_START;

  const reserved = window.sessionStorage.getItem(ASSESSMENT_SEQUENCE_SESSION_KEY);
  const reservedValue = Number(reserved);
  if (Number.isFinite(reservedValue) && reservedValue >= ASSESSMENT_SEQUENCE_START) {
    return reservedValue;
  }

  const last = Number(window.localStorage.getItem(ASSESSMENT_SEQUENCE_STORAGE_KEY));
  const next = Number.isFinite(last)
    ? Math.max(last, ASSESSMENT_SEQUENCE_SEED) + 1
    : ASSESSMENT_SEQUENCE_START;

  window.localStorage.setItem(ASSESSMENT_SEQUENCE_STORAGE_KEY, String(next));
  window.sessionStorage.setItem(ASSESSMENT_SEQUENCE_SESSION_KEY, String(next));
  return next;
}

export function getStoredAssessmentSequence() {
  if (typeof window === "undefined") return ASSESSMENT_SEQUENCE_START;

  const reserved = Number(window.sessionStorage.getItem(ASSESSMENT_SEQUENCE_SESSION_KEY));
  if (Number.isFinite(reserved) && reserved >= ASSESSMENT_SEQUENCE_START) {
    return reserved;
  }

  return reserveAssessmentSequence();
}
