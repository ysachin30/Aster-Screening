CREATE TABLE IF NOT EXISTS students (
  student_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  jee_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_evaluations_student ON evaluations(student_id);
