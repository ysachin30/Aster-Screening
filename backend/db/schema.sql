CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS students (
  student_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  jee_score INTEGER,
  phone TEXT,
  whatsapp_consent BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE students ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_consent BOOLEAN DEFAULT TRUE;

-- Legacy: kept for backward compatibility with POST /api/evaluation
CREATE TABLE IF NOT EXISTS evaluations (
  id SERIAL PRIMARY KEY,
  student_id TEXT REFERENCES students(student_id),
  room TEXT NOT NULL,
  transcript TEXT,
  curiosity NUMERIC(4,2),
  exploratory NUMERIC(4,2),
  confidence NUMERIC(4,2),
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interview_attempts (
  id SERIAL PRIMARY KEY,
  student_id TEXT REFERENCES students(student_id),
  room TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'aborted'))
);

CREATE TABLE IF NOT EXISTS interview_reports (
  report_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     TEXT NOT NULL REFERENCES students(student_id),
  room           TEXT NOT NULL,
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ DEFAULT NOW(),
  duration_secs  INTEGER,

  academic_correctness     NUMERIC(4,2),
  academic_understanding   NUMERIC(4,2),
  academic_reasoning       NUMERIC(4,2),
  academic_score           NUMERIC(5,2),

  conf_score               NUMERIC(4,2),
  communication_score      NUMERIC(4,2),
  curiosity_score          NUMERIC(4,2),
  exploratory_score        NUMERIC(4,2),
  comprehension_score      NUMERIC(4,2),
  personality_score        NUMERIC(5,2),

  overall_score            NUMERIC(5,2),
  band                     CHAR(1) CHECK (band IN ('A','B','C','D')),
  shortlist_status         TEXT CHECK (shortlist_status IN ('shortlist','borderline','reject')),
  decision_reason          TEXT,
  manual_override_status   TEXT,
  manual_override_by       TEXT,
  manual_override_at       TIMESTAMPTZ,

  summary                  TEXT,
  strengths                TEXT[],
  improvements             TEXT[],

  transcript_full          TEXT,
  report_json              JSONB,

  delivery_status          TEXT DEFAULT 'pending_review'
                           CHECK (delivery_status IN ('pending_review','sent','not_sent')),
  delivered_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_evaluations_student ON evaluations(student_id);
CREATE INDEX IF NOT EXISTS idx_interview_attempts_student ON interview_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_interview_attempts_time ON interview_attempts(started_at);
CREATE INDEX IF NOT EXISTS idx_reports_student ON interview_reports(student_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_shortlist ON interview_reports(shortlist_status, overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_reports_delivery ON interview_reports(delivery_status);
