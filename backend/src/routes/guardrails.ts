import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";

export const guardrailsRouter = Router();

// Add attempt tracking to students table
const StudentAttemptSchema = z.object({
  student_id: z.string(),
  max_attempts: z.number().min(1).default(3),
  cooldown_minutes: z.number().min(0).default(60),
});

// Check if student can start interview
guardrailsRouter.post("/check-eligibility", async (req, res) => {
  const { student_id } = req.body;
  if (!student_id) return res.status(400).json({ error: "student_id required" });

  try {
    // Check recent attempts
    const { rows } = await pool.query(
      `SELECT * FROM evaluations 
       WHERE student_id = $1 
       AND created_at > NOW() - INTERVAL '1 hour'
       ORDER BY created_at DESC`,
      [student_id]
    );

    const recentAttempts = rows.length;
    const maxAttempts = 3; // Configurable

    if (recentAttempts >= maxAttempts) {
      const lastAttempt = rows[0];
      const cooldownEnd = new Date(lastAttempt.created_at);
      cooldownEnd.setMinutes(cooldownEnd.getMinutes() + 60); // 1 hour cooldown

      return res.status(429).json({
        eligible: false,
        reason: "Too many recent attempts",
        attempts: recentAttempts,
        maxAttempts,
        cooldownUntil: cooldownEnd,
        message: `You've reached the maximum attempts. Please try again after ${cooldownEnd.toLocaleString()}.`
      });
    }

    res.json({
      eligible: true,
      attempts: recentAttempts,
      maxAttempts,
      remainingAttempts: maxAttempts - recentAttempts
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Log interview start for guardrails
guardrailsRouter.post("/log-interview-start", async (req, res) => {
  const { student_id, room } = req.body;
  if (!student_id || !room) return res.status(400).json({ error: "student_id and room required" });

  try {
    // Ensure student exists
    await pool.query(
      `INSERT INTO students (student_id, name) VALUES ($1, $2) ON CONFLICT (student_id) DO NOTHING`,
      [student_id, student_id]
    );

    // Log interview attempt
    await pool.query(
      `INSERT INTO interview_attempts (student_id, room, started_at) VALUES ($1, $2, NOW())`,
      [student_id, room]
    );

    res.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get student statistics
guardrailsRouter.get("/student-stats/:student_id", async (req, res) => {
  try {
    const { rows: attempts } = await pool.query(
      `SELECT * FROM interview_attempts WHERE student_id = $1 ORDER BY started_at DESC`,
      [req.params.student_id]
    );

    const { rows: evaluations } = await pool.query(
      `SELECT * FROM evaluations WHERE student_id = $1 ORDER BY created_at DESC`,
      [req.params.student_id]
    );

    res.json({
      totalAttempts: attempts.length,
      completedInterviews: evaluations.length,
      lastAttempt: attempts[0]?.started_at || null,
      averageScores: evaluations.length > 0 ? {
        curiosity: evaluations.reduce((sum, e) => sum + parseFloat(e.curiosity), 0) / evaluations.length,
        exploratory: evaluations.reduce((sum, e) => sum + parseFloat(e.exploratory), 0) / evaluations.length,
        confidence: evaluations.reduce((sum, e) => sum + parseFloat(e.confidence), 0) / evaluations.length,
      } : null
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
