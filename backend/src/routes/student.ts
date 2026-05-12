import { Router } from "express";
import { pool } from "../db.js";

export const studentRouter = Router();

const ASSESSMENT_SEQUENCE_START = 2793;

async function reserveAssessmentSequenceNumber() {
  await pool.query(
    `CREATE SEQUENCE IF NOT EXISTS assessment_sequence_seq
      AS BIGINT
      START WITH ${ASSESSMENT_SEQUENCE_START}
      INCREMENT BY 1
      MINVALUE ${ASSESSMENT_SEQUENCE_START}`,
  );
  const { rows } = await pool.query<{ seq: string | number }>(
    `SELECT nextval('assessment_sequence_seq') AS seq`,
  );
  const sequence = Number(rows[0]?.seq);
  if (!Number.isFinite(sequence) || sequence < ASSESSMENT_SEQUENCE_START) {
    throw new Error("failed to reserve assessment sequence");
  }
  return sequence;
}

studentRouter.post("/assessment-sequence/reserve", async (_req, res) => {
  try {
    const sequence = await reserveAssessmentSequenceNumber();
    res.json({ sequence });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message ?? "failed to reserve sequence" });
  }
});

studentRouter.get("/student/:id", async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM students WHERE student_id = $1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "not found" });
  res.json(rows[0]);
});

studentRouter.post("/student", async (req, res) => {
  const { student_id, name, email, jee_score, phone, whatsapp_consent } = req.body || {};
  if (!student_id || !name) return res.status(400).json({ error: "student_id and name required" });
  const consent =
    whatsapp_consent === undefined || whatsapp_consent === null ? true : Boolean(whatsapp_consent);
  await pool.query(
    `INSERT INTO students (student_id, name, email, jee_score, phone, whatsapp_consent)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (student_id) DO UPDATE SET
       name = EXCLUDED.name,
       email = EXCLUDED.email,
       jee_score = EXCLUDED.jee_score,
       phone = COALESCE(EXCLUDED.phone, students.phone),
       whatsapp_consent = EXCLUDED.whatsapp_consent`,
    [student_id, name, email || null, jee_score ?? null, phone || null, consent],
  );
  res.json({ ok: true });
});
