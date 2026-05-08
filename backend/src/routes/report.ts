import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";

export const reportRouter = Router();

function clamp010(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(10, Math.max(0, n));
}

function deriveRollups(
  academic: { correctness: number; understanding: number; reasoning_depth: number },
  personality: {
    confidence: number;
    communication: number;
    curiosity: number;
    exploratory_thinking: number;
    comprehension: number;
  },
) {
  const correctness = clamp010(academic.correctness);
  const understanding = clamp010(academic.understanding);
  const reasoning_depth = clamp010(academic.reasoning_depth);
  const academic_score = (correctness * 0.35 + understanding * 0.4 + reasoning_depth * 0.25) * 10;

  const confidence = clamp010(personality.confidence);
  const communication = clamp010(personality.communication);
  const curiosity = clamp010(personality.curiosity);
  const exploratory_thinking = clamp010(personality.exploratory_thinking);
  const comprehension = clamp010(personality.comprehension);
  const personality_score =
    ((confidence + communication + curiosity + exploratory_thinking + comprehension) / 5) * 10;

  const overall_score = 0.55 * academic_score + 0.45 * personality_score;
  const band: "A" | "B" | "C" | "D" =
    overall_score >= 85 ? "A" : overall_score >= 70 ? "B" : overall_score >= 50 ? "C" : "D";
  const criticalFail = academic_score < 50 || communication < 5 || comprehension < 5;
  const shortlist_status: "shortlist" | "borderline" | "reject" =
    criticalFail || band === "D" ? "reject" : band === "C" ? "borderline" : "shortlist";

  const parts: string[] = [];
  if (criticalFail) {
    if (academic_score < 50) parts.push("academic below 50");
    if (communication < 5) parts.push("communication below 5");
    if (comprehension < 5) parts.push("comprehension below 5");
  }
  const decision_reason =
    shortlist_status === "reject"
      ? criticalFail
        ? `Reject (critical): ${parts.join("; ")}`
        : "Reject: band D"
      : shortlist_status === "borderline"
        ? "Borderline: band C, no critical fail"
        : `Shortlist: band ${band}, no critical fail`;

  return {
    academic_correctness: correctness,
    academic_understanding: understanding,
    academic_reasoning: reasoning_depth,
    academic_score,
    conf_score: confidence,
    communication_score: communication,
    curiosity_score: curiosity,
    exploratory_score: exploratory_thinking,
    comprehension_score: comprehension,
    personality_score,
    overall_score,
    band,
    shortlist_status,
    decision_reason,
  };
}

const AcademicSchema = z.object({
  correctness: z.number(),
  understanding: z.number(),
  reasoning_depth: z.number(),
});

const PersonalitySchema = z.object({
  confidence: z.number(),
  communication: z.number(),
  curiosity: z.number(),
  exploratory_thinking: z.number(),
  comprehension: z.number(),
});

const PostReportBody = z.object({
  student_id: z.string().min(1),
  room: z.string().min(1),
  transcript_full: z.string(),
  academic: AcademicSchema,
  personality: PersonalitySchema,
  summary: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  improvements: z.array(z.string()).optional(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
  duration_secs: z.number().int().nonnegative().optional(),
  report_json: z.record(z.string(), z.unknown()).optional(),
});

reportRouter.post("/report", async (req, res) => {
  const parsed = PostReportBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const {
    student_id,
    room,
    transcript_full,
    academic,
    personality,
    summary,
    strengths,
    improvements,
    started_at,
    completed_at,
    duration_secs,
    report_json: extraJson,
  } = parsed.data;

  const roll = deriveRollups(academic, personality);
  const strengthsArr = strengths?.slice(0, 10) ?? [];
  const improvementsArr = improvements?.slice(0, 10) ?? [];

  const mergedReportJson = {
    academic,
    personality,
    summary: summary ?? null,
    strengths: strengthsArr,
    improvements: improvementsArr,
    server: {
      academic_score: roll.academic_score,
      personality_score: roll.personality_score,
      overall_score: roll.overall_score,
      band: roll.band,
      shortlist_status: roll.shortlist_status,
      decision_reason: roll.decision_reason,
    },
    ...(extraJson && Object.keys(extraJson).length ? { client: extraJson } : {}),
  };

  try {
    await pool.query(
      `INSERT INTO students (student_id, name) VALUES ($1, $2) ON CONFLICT (student_id) DO NOTHING`,
      [student_id, student_id],
    );

    const { rows } = await pool.query(
      `INSERT INTO interview_reports (
        student_id, room, started_at, completed_at, duration_secs,
        academic_correctness, academic_understanding, academic_reasoning, academic_score,
        conf_score, communication_score, curiosity_score, exploratory_score, comprehension_score, personality_score,
        overall_score, band, shortlist_status, decision_reason,
        summary, strengths, improvements, transcript_full, report_json
      ) VALUES (
        $1, $2, $3::timestamptz, COALESCE($4::timestamptz, NOW()), $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, $22, $23, $24::jsonb
      )
      RETURNING report_id, shortlist_status, overall_score, band`,
      [
        student_id,
        room,
        started_at ?? null,
        completed_at ?? null,
        duration_secs ?? null,
        roll.academic_correctness,
        roll.academic_understanding,
        roll.academic_reasoning,
        roll.academic_score,
        roll.conf_score,
        roll.communication_score,
        roll.curiosity_score,
        roll.exploratory_score,
        roll.comprehension_score,
        roll.personality_score,
        roll.overall_score,
        roll.band,
        roll.shortlist_status,
        roll.decision_reason,
        summary ?? null,
        strengthsArr.length ? strengthsArr : null,
        improvementsArr.length ? improvementsArr : null,
        transcript_full,
        JSON.stringify(mergedReportJson),
      ],
    );

    res.json({ ok: true, ...rows[0] });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/** Must be registered before GET /report/:student_id */
reportRouter.get("/report/by-id/:report_id", async (req, res) => {
  const report_id = req.params.report_id;
  if (!z.string().uuid().safeParse(report_id).success) {
    return res.status(400).json({ error: "invalid report_id" });
  }
  try {
    const { rows } = await pool.query(`SELECT * FROM interview_reports WHERE report_id = $1`, [report_id]);
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

reportRouter.get("/report/:student_id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM interview_reports WHERE student_id = $1 ORDER BY completed_at DESC NULLS LAST LIMIT 1`,
      [req.params.student_id],
    );
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

reportRouter.get("/admin/shortlist", async (req, res) => {
  const q = z
    .object({
      status: z.enum(["shortlist", "borderline", "reject"]).optional(),
      minScore: z.coerce.number().optional(),
      limit: z.coerce.number().min(1).max(200).default(50),
      offset: z.coerce.number().min(0).default(0),
    })
    .safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: q.error.flatten() });

  const { status, minScore, limit, offset } = q.data;
  const parts: string[] = ["1=1"];
  const params: unknown[] = [];
  let n = 1;
  if (status) {
    parts.push(`r.shortlist_status = $${n++}`);
    params.push(status);
  }
  if (minScore !== undefined) {
    parts.push(`r.overall_score >= $${n++}`);
    params.push(minScore);
  }
  const lim = n++;
  const off = n++;
  params.push(limit, offset);
  const where = parts.join(" AND ");

  try {
    const sql = `
      SELECT r.*, s.name AS student_name, s.phone, s.email
      FROM interview_reports r
      LEFT JOIN students s ON s.student_id = r.student_id
      WHERE ${where}
      ORDER BY r.completed_at DESC NULLS LAST
      LIMIT $${lim} OFFSET $${off}
    `;
    const { rows } = await pool.query(sql, params);
    res.json({ items: rows, limit, offset });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const OverrideBody = z.object({
  status: z.enum(["shortlist", "borderline", "reject"]),
  by: z.string().min(1),
});

reportRouter.patch("/admin/report/:report_id/override", async (req, res) => {
  const report_id = req.params.report_id;
  if (!z.string().uuid().safeParse(report_id).success) {
    return res.status(400).json({ error: "invalid report_id" });
  }
  const parsed = OverrideBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { status, by } = parsed.data;

  try {
    const { rows } = await pool.query(
      `UPDATE interview_reports SET
        manual_override_status = $1,
        manual_override_by = $2,
        manual_override_at = NOW()
      WHERE report_id = $3
      RETURNING *`,
      [status, by, report_id],
    );
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const DeliveryBody = z.object({
  status: z.enum(["sent", "not_sent"]),
});

reportRouter.patch("/admin/report/:report_id/delivery", async (req, res) => {
  const report_id = req.params.report_id;
  if (!z.string().uuid().safeParse(report_id).success) {
    return res.status(400).json({ error: "invalid report_id" });
  }
  const parsed = DeliveryBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { status } = parsed.data;

  const delivery_status = status === "sent" ? "sent" : "not_sent";
  const delivered_at = status === "sent" ? new Date() : null;

  try {
    const { rows } = await pool.query(
      `UPDATE interview_reports SET
        delivery_status = $1,
        delivered_at = $2
      WHERE report_id = $3
      RETURNING *`,
      [delivery_status, delivered_at, report_id],
    );
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
