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

function deriveRollupsNullable(
  academic: { correctness: number; understanding: number; reasoning_depth: number } | null,
  personality: {
    confidence: number;
    communication: number;
    curiosity: number;
    exploratory_thinking: number;
    comprehension: number;
  } | null,
) {
  const academicPart = academic
    ? {
        academic_correctness: clamp010(academic.correctness),
        academic_understanding: clamp010(academic.understanding),
        academic_reasoning: clamp010(academic.reasoning_depth),
        academic_score:
          (clamp010(academic.correctness) * 0.35 +
            clamp010(academic.understanding) * 0.4 +
            clamp010(academic.reasoning_depth) * 0.25) *
          10,
      }
    : {
        academic_correctness: null,
        academic_understanding: null,
        academic_reasoning: null,
        academic_score: null,
      };

  const personalityPart = personality
    ? {
        conf_score: clamp010(personality.confidence),
        communication_score: clamp010(personality.communication),
        curiosity_score: clamp010(personality.curiosity),
        exploratory_score: clamp010(personality.exploratory_thinking),
        comprehension_score: clamp010(personality.comprehension),
        personality_score:
          ((clamp010(personality.confidence) +
            clamp010(personality.communication) +
            clamp010(personality.curiosity) +
            clamp010(personality.exploratory_thinking) +
            clamp010(personality.comprehension)) /
            5) *
          10,
      }
    : {
        conf_score: null,
        communication_score: null,
        curiosity_score: null,
        exploratory_score: null,
        comprehension_score: null,
        personality_score: null,
      };

  if (!academic || !personality) {
    return {
      ...academicPart,
      ...personalityPart,
      overall_score: null,
      band: null,
      shortlist_status: null,
      decision_reason: "Pending review: insufficient evidence for reliable automatic scoring.",
    };
  }

  return deriveRollups(academic, personality);
}

function deriveQuestionScore(academic: { correctness?: number | null; understanding?: number | null; reasoning_depth?: number | null }) {
  if (
    academic.correctness === null || academic.correctness === undefined ||
    academic.understanding === null || academic.understanding === undefined ||
    academic.reasoning_depth === null || academic.reasoning_depth === undefined
  ) {
    return null;
  }
  const correctness = clamp010(Number(academic.correctness));
  const understanding = clamp010(Number(academic.understanding));
  const reasoning_depth = clamp010(Number(academic.reasoning_depth));
  return (correctness * 0.35 + understanding * 0.4 + reasoning_depth * 0.25) * 10;
}

function hasAcademicSignal(academic: { correctness: number; understanding: number; reasoning_depth: number }) {
  return [academic.correctness, academic.understanding, academic.reasoning_depth].some((n) => clamp010(n) > 0);
}

function hasPersonalitySignal(personality: {
  confidence: number;
  communication: number;
  curiosity: number;
  exploratory_thinking: number;
  comprehension: number;
}) {
  return [
    personality.confidence,
    personality.communication,
    personality.curiosity,
    personality.exploratory_thinking,
    personality.comprehension,
  ].some((n) => clamp010(n) > 0);
}

function average(nums: number[]) {
  if (!nums.length) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function isRollupEligibleQuestionRow(row: any) {
  return row && (row.status === "scored" || row.status === "final");
}

function rowEvidenceWeight(row: any) {
  if (!isRollupEligibleQuestionRow(row)) return 0;
  return row.needs_review ? 0.35 : 1;
}

function weightedAverage(values: Array<{ value: number; weight: number }>) {
  const usable = values.filter(({ value, weight }) => Number.isFinite(value) && weight > 0);
  if (!usable.length) return null;
  const totalWeight = usable.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return null;
  return usable.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

function deriveAcademicFromQuestionRows(rows: any[]) {
  const correctness = weightedAverage(
    rows
      .filter((r) => r.academic_correctness !== null)
      .map((r) => ({ value: Number(r.academic_correctness), weight: rowEvidenceWeight(r) })),
  );
  const understanding = weightedAverage(
    rows
      .filter((r) => r.academic_understanding !== null)
      .map((r) => ({ value: Number(r.academic_understanding), weight: rowEvidenceWeight(r) })),
  );
  const reasoning_depth = weightedAverage(
    rows
      .filter((r) => r.academic_reasoning !== null)
      .map((r) => ({ value: Number(r.academic_reasoning), weight: rowEvidenceWeight(r) })),
  );
  if (correctness === null || understanding === null || reasoning_depth === null) return null;
  return { correctness, understanding, reasoning_depth };
}

function derivePersonalityFromQuestionRows(rows: any[]) {
  const confidence = weightedAverage(
    rows
      .filter((r) => r.confidence_score !== null)
      .map((r) => ({ value: Number(r.confidence_score), weight: rowEvidenceWeight(r) })),
  );
  const communication = weightedAverage(
    rows
      .filter((r) => r.communication_score !== null)
      .map((r) => ({ value: Number(r.communication_score), weight: rowEvidenceWeight(r) })),
  );
  const curiosity = weightedAverage(
    rows
      .filter((r) => r.curiosity_score !== null)
      .map((r) => ({ value: Number(r.curiosity_score), weight: rowEvidenceWeight(r) })),
  );
  const exploratory_thinking = weightedAverage(
    rows
      .filter((r) => r.exploratory_score !== null)
      .map((r) => ({ value: Number(r.exploratory_score), weight: rowEvidenceWeight(r) })),
  );
  const comprehension = weightedAverage(
    rows
      .filter((r) => r.comprehension_score !== null)
      .map((r) => ({ value: Number(r.comprehension_score), weight: rowEvidenceWeight(r) })),
  );
  if (
    confidence === null ||
    communication === null ||
    curiosity === null ||
    exploratory_thinking === null ||
    comprehension === null
  ) {
    return null;
  }
  return { confidence, communication, curiosity, exploratory_thinking, comprehension };
}

function mapQuestionScoreRow(row: any, includeAudio = false) {
  const mapped = {
    id: row.id,
    report_id: row.report_id,
    student_id: row.student_id,
    room: row.room,
    question_id: row.question_id,
    part: Number(row.part) === 0 ? null : Number(row.part),
    question_key: row.question_key,
    status: row.status,
    academic: {
      correctness: row.academic_correctness === null ? null : Number(row.academic_correctness),
      understanding: row.academic_understanding === null ? null : Number(row.academic_understanding),
      reasoning_depth: row.academic_reasoning === null ? null : Number(row.academic_reasoning),
    },
    question_score: row.question_score === null ? null : Number(row.question_score),
    personality_snapshot: {
      confidence: row.confidence_score === null ? null : Number(row.confidence_score),
      communication: row.communication_score === null ? null : Number(row.communication_score),
      curiosity: row.curiosity_score === null ? null : Number(row.curiosity_score),
      exploratory_thinking: row.exploratory_score === null ? null : Number(row.exploratory_score),
      comprehension: row.comprehension_score === null ? null : Number(row.comprehension_score),
    },
    transcript_confidence: row.transcript_confidence === null ? null : Number(row.transcript_confidence),
    grading_mode: row.grading_mode,
    needs_review: Boolean(row.needs_review),
    summary: row.summary,
    transcript_excerpt: row.transcript_excerpt,
    activity_json: row.activity_json,
    audio_mime_type: row.audio_mime_type,
    created_at: row.created_at,
    updated_at: row.updated_at,
    artifact_ready_at: row.artifact_ready_at,
    transcribed_at: row.transcribed_at,
    scored_at: row.scored_at,
    finalized_at: row.finalized_at,
  };
  return includeAudio ? { ...mapped, audio_base64: row.audio_base64 } : mapped;
}

async function getQuestionScoreRowsByRoom(room: string) {
  const { rows } = await pool.query(
    `SELECT * FROM interview_question_scores
      WHERE room = $1
      ORDER BY question_id ASC, part ASC, updated_at ASC`,
    [room],
  );
  return rows;
}

const AcademicSchema = z.object({
  correctness: z.coerce.number(),
  understanding: z.coerce.number(),
  reasoning_depth: z.coerce.number(),
});

const PersonalitySchema = z.object({
  confidence: z.coerce.number(),
  communication: z.coerce.number(),
  curiosity: z.coerce.number(),
  exploratory_thinking: z.coerce.number(),
  comprehension: z.coerce.number(),
});

const PartialAcademicSchema = z.object({
  correctness: z.coerce.number().optional(),
  understanding: z.coerce.number().optional(),
  reasoning_depth: z.coerce.number().optional(),
});

const PartialPersonalitySchema = z.object({
  confidence: z.coerce.number().optional(),
  communication: z.coerce.number().optional(),
  curiosity: z.coerce.number().optional(),
  exploratory_thinking: z.coerce.number().optional(),
  comprehension: z.coerce.number().optional(),
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

const UpsertQuestionScoreBody = z.object({
  report_id: z.string().uuid().optional(),
  student_id: z.string().min(1),
  room: z.string().min(1),
  question_id: z.coerce.number().int().positive(),
  part: z.coerce.number().int().nonnegative().optional(),
  question_key: z.string().min(1).optional(),
  status: z.enum(["pending", "artifact_ready", "transcribed", "scored", "final", "insufficient_data"]).optional(),
  academic: PartialAcademicSchema.nullable().optional(),
  personality_snapshot: PartialPersonalitySchema.nullable().optional(),
  question_score: z.coerce.number().optional(),
  summary: z.string().optional(),
  transcript_excerpt: z.string().optional(),
  transcript_confidence: z.coerce.number().optional(),
  grading_mode: z.string().optional(),
  needs_review: z.coerce.boolean().optional(),
  activity_json: z.record(z.string(), z.unknown()).optional(),
  audio_mime_type: z.string().optional(),
  audio_base64: z.string().optional(),
});

reportRouter.post("/question-score", async (req, res) => {
  const parsed = UpsertQuestionScoreBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const {
    report_id,
    student_id,
    room,
    question_id,
    part,
    question_key,
    status,
    academic,
    personality_snapshot,
    question_score,
    summary,
    transcript_excerpt,
    transcript_confidence,
    grading_mode,
    needs_review,
    activity_json,
    audio_mime_type,
    audio_base64,
  } = parsed.data;

  const normalizedPart = part ?? 0;
  const effectiveQuestionKey = question_key || `Q${question_id}${normalizedPart > 0 ? `-P${normalizedPart}` : ""}`;
  const normalizedStatus = status ?? "pending";
  const isScoredStatus = normalizedStatus === "scored" || normalizedStatus === "final";
  const computedQuestionScore =
    isScoredStatus
      ? (question_score ?? (academic ? deriveQuestionScore(academic) : undefined))
      : undefined;

  try {
    await pool.query(
      `INSERT INTO students (student_id, name) VALUES ($1, $2) ON CONFLICT (student_id) DO NOTHING`,
      [student_id, student_id],
    );

    const { rows } = await pool.query(
      `INSERT INTO interview_question_scores (
        report_id, student_id, room, question_id, part, question_key, status,
        academic_correctness, academic_understanding, academic_reasoning, question_score,
        confidence_score, communication_score, curiosity_score, exploratory_score, comprehension_score,
        grading_mode, transcript_confidence, needs_review, summary, transcript_excerpt,
        activity_json, audio_mime_type, audio_base64,
        artifact_ready_at, transcribed_at, scored_at, finalized_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22::jsonb, $23, $24,
        CASE WHEN $7 IN ('artifact_ready','transcribed','scored','final','insufficient_data') THEN NOW() ELSE NULL END,
        CASE WHEN $7 IN ('transcribed','scored','final') THEN NOW() ELSE NULL END,
        CASE WHEN $7 IN ('scored','final','insufficient_data') THEN NOW() ELSE NULL END,
        CASE WHEN $7 = 'final' THEN NOW() ELSE NULL END,
        NOW()
      )
      ON CONFLICT (room, question_id, part) DO UPDATE SET
        report_id = COALESCE(EXCLUDED.report_id, interview_question_scores.report_id),
        student_id = EXCLUDED.student_id,
        question_key = COALESCE(EXCLUDED.question_key, interview_question_scores.question_key),
        status = CASE
          WHEN EXCLUDED.status = 'final' THEN 'final'
          WHEN interview_question_scores.status = 'final' THEN 'final'
          WHEN EXCLUDED.status = 'scored' THEN 'scored'
          WHEN interview_question_scores.status = 'scored' AND EXCLUDED.status IN ('pending','artifact_ready','transcribed') THEN interview_question_scores.status
          WHEN EXCLUDED.status = 'insufficient_data' AND interview_question_scores.status IN ('pending','artifact_ready','transcribed','insufficient_data') THEN 'insufficient_data'
          WHEN interview_question_scores.status = 'insufficient_data' AND EXCLUDED.status IN ('pending','artifact_ready','transcribed') THEN interview_question_scores.status
          WHEN EXCLUDED.status = 'transcribed' AND interview_question_scores.status IN ('pending','artifact_ready','transcribed') THEN 'transcribed'
          WHEN EXCLUDED.status = 'artifact_ready' AND interview_question_scores.status = 'pending' THEN 'artifact_ready'
          ELSE interview_question_scores.status
        END,
        academic_correctness = COALESCE(EXCLUDED.academic_correctness, interview_question_scores.academic_correctness),
        academic_understanding = COALESCE(EXCLUDED.academic_understanding, interview_question_scores.academic_understanding),
        academic_reasoning = COALESCE(EXCLUDED.academic_reasoning, interview_question_scores.academic_reasoning),
        question_score = COALESCE(EXCLUDED.question_score, interview_question_scores.question_score),
        confidence_score = COALESCE(EXCLUDED.confidence_score, interview_question_scores.confidence_score),
        communication_score = COALESCE(EXCLUDED.communication_score, interview_question_scores.communication_score),
        curiosity_score = COALESCE(EXCLUDED.curiosity_score, interview_question_scores.curiosity_score),
        exploratory_score = COALESCE(EXCLUDED.exploratory_score, interview_question_scores.exploratory_score),
        comprehension_score = COALESCE(EXCLUDED.comprehension_score, interview_question_scores.comprehension_score),
        grading_mode = COALESCE(EXCLUDED.grading_mode, interview_question_scores.grading_mode),
        transcript_confidence = COALESCE(EXCLUDED.transcript_confidence, interview_question_scores.transcript_confidence),
        needs_review = COALESCE(EXCLUDED.needs_review, interview_question_scores.needs_review),
        summary = COALESCE(EXCLUDED.summary, interview_question_scores.summary),
        transcript_excerpt = COALESCE(EXCLUDED.transcript_excerpt, interview_question_scores.transcript_excerpt),
        activity_json = COALESCE(EXCLUDED.activity_json, interview_question_scores.activity_json),
        audio_mime_type = COALESCE(EXCLUDED.audio_mime_type, interview_question_scores.audio_mime_type),
        audio_base64 = COALESCE(EXCLUDED.audio_base64, interview_question_scores.audio_base64),
        artifact_ready_at = COALESCE(interview_question_scores.artifact_ready_at, EXCLUDED.artifact_ready_at),
        transcribed_at = COALESCE(interview_question_scores.transcribed_at, EXCLUDED.transcribed_at),
        scored_at = COALESCE(
          interview_question_scores.scored_at,
          EXCLUDED.scored_at
        ),
        finalized_at = COALESCE(interview_question_scores.finalized_at, EXCLUDED.finalized_at),
        updated_at = NOW()
      RETURNING *`,
      [
        report_id ?? null,
        student_id,
        room,
        question_id,
        normalizedPart,
        effectiveQuestionKey,
        normalizedStatus,
        academic?.correctness ?? null,
        academic?.understanding ?? null,
        academic?.reasoning_depth ?? null,
        computedQuestionScore ?? null,
        personality_snapshot?.confidence ?? null,
        personality_snapshot?.communication ?? null,
        personality_snapshot?.curiosity ?? null,
        personality_snapshot?.exploratory_thinking ?? null,
        personality_snapshot?.comprehension ?? null,
        grading_mode ?? null,
        transcript_confidence ?? null,
        needs_review ?? null,
        summary ?? null,
        transcript_excerpt ?? null,
        activity_json ? JSON.stringify(activity_json) : null,
        audio_mime_type ?? null,
        audio_base64 ?? null,
      ],
    );

    res.json({ ok: true, item: mapQuestionScoreRow(rows[0], true) });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

reportRouter.get("/question-score/live/:room", async (req, res) => {
  try {
    const rows = await getQuestionScoreRowsByRoom(req.params.room);
    res.json({ items: rows.map((row) => mapQuestionScoreRow(row, true)) });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
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

  try {
    const questionRows = await getQuestionScoreRowsByRoom(room);
    const questionBreakdown = questionRows.map((row) => mapQuestionScoreRow(row));
    const fallbackAcademic = deriveAcademicFromQuestionRows(questionRows);
    const fallbackPersonality = derivePersonalityFromQuestionRows(questionRows);
    const transcriptAcademic = hasAcademicSignal(academic) ? academic : null;
    const transcriptPersonality = hasPersonalitySignal(personality) ? personality : null;
    const useAcademicFallback = fallbackAcademic !== null;
    const usePersonalityFallback = transcriptPersonality === null && fallbackPersonality !== null;
    const effectiveAcademic = fallbackAcademic ?? transcriptAcademic;
    const effectivePersonality = fallbackPersonality ?? transcriptPersonality;
    const roll = deriveRollupsNullable(effectiveAcademic, effectivePersonality);
    const strengthsArr = strengths?.slice(0, 10) ?? [];
    const improvementsArr = improvements?.slice(0, 10) ?? [];
    const statusCounts = questionBreakdown.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});

    const mergedReportJson = {
      academic: effectiveAcademic,
      personality: effectivePersonality,
      summary: summary ?? null,
      strengths: strengthsArr,
      improvements: improvementsArr,
      question_scores: questionBreakdown,
      capture_guardrails: {
        used_live_question_academic_fallback: useAcademicFallback,
        used_live_question_personality_fallback: usePersonalityFallback,
        review_needed_count: questionBreakdown.filter((item) => item.needs_review).length,
        insufficient_data_count: statusCounts.insufficient_data ?? 0,
        transcribed_count: statusCounts.transcribed ?? 0,
        scored_count: (statusCounts.scored ?? 0) + (statusCounts.final ?? 0),
        artifact_ready_count: statusCounts.artifact_ready ?? 0,
        rollup_sources: {
          academic: useAcademicFallback ? "question_scores" : "full_interview_grade",
          personality: usePersonalityFallback ? "question_scores" : "full_interview_grade",
        },
      },
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

    await pool.query(
      `UPDATE interview_question_scores
          SET report_id = $1,
              status = CASE WHEN status = 'scored' THEN 'final' ELSE status END,
              updated_at = NOW()
        WHERE room = $2`,
      [rows[0].report_id, room],
    );

    res.json({ ok: true, ...rows[0], question_scores: questionBreakdown });
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
    const questionRows = await getQuestionScoreRowsByRoom(rows[0].room);
    res.json({ ...rows[0], question_scores: questionRows.map((row) => mapQuestionScoreRow(row)) });
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
    const questionRows = await getQuestionScoreRowsByRoom(rows[0].room);
    res.json({ ...rows[0], question_scores: questionRows.map((row) => mapQuestionScoreRow(row)) });
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
