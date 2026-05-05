import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";

export const evaluationRouter = Router();

const EvalBody = z.object({
  student_id: z.string(),
  room: z.string(),
  transcript: z.string(),
  scores: z.object({
    curiosity: z.number().min(0).max(10),
    exploratory: z.number().min(0).max(10),
    confidence: z.number().min(0).max(10),
  }),
  summary: z.string().optional(),
});

// The AI Agent posts the final grading JSON here after the interview ends.
evaluationRouter.post("/evaluation", async (req, res) => {
  const parsed = EvalBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { student_id, room, transcript, scores, summary } = parsed.data;

  try {
    // Auto-register student if not already present (avoids FK violation)
    await pool.query(
      `INSERT INTO students (student_id, name) VALUES ($1, $2) ON CONFLICT (student_id) DO NOTHING`,
      [student_id, student_id],
    );
    await pool.query(
      `INSERT INTO evaluations (student_id, room, transcript, curiosity, exploratory, confidence, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [student_id, room, transcript, scores.curiosity, scores.exploratory, scores.confidence, summary || null],
    );
    res.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

evaluationRouter.get("/evaluation/:student_id", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM evaluations WHERE student_id = $1 ORDER BY created_at DESC`,
    [req.params.student_id],
  );
  res.json(rows);
});
