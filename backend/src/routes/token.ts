import { Router } from "express";
import { AccessToken, AgentDispatchClient, RoomServiceClient, DataPacket_Kind } from "livekit-server-sdk";
import { z } from "zod";

export const tokenRouter = Router();

// Relay frontend question_changed events to the agent via LiveKit data channel
tokenRouter.post("/question-changed", async (req, res) => {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) return res.status(500).json({ error: "LiveKit creds missing" });

  const httpUrl = (process.env.LIVEKIT_URL || "")
    .replace(/^wss:\/\//, "https://")
    .replace(/^ws:\/\//, "http://");

  const { room, payload } = req.body as { room: string; payload: any };
  if (!room || !payload) return res.status(400).json({ error: "room and payload required" });

  try {
    const client = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    // Send data to all participants in the room (agent will receive via data_received)
    await client.sendData(room, new TextEncoder().encode(JSON.stringify(payload)), DataPacket_Kind.RELIABLE);
    console.log("[relay] question_changed sent to room:", room, payload);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("[relay] failed:", e?.message);
    res.status(500).json({ error: e?.message });
  }
});

const McqOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
});

const QuestionPartMcqSchema = z.object({
  part: z.number(),
  options: z.array(McqOptionSchema),
  correct_option_id: z.string(),
});

const QuestionSchema = z.object({
  id: z.number(),
  kind: z.string().optional(),
  question: z.string(),
  context: z.string().optional(),
  hints: z.array(z.string()).optional(),
  answer: z.string().optional(),
  format: z.enum(["objective", "verbal"]).optional(),
  options: z.array(McqOptionSchema).optional(),
  correct_option_id: z.string().optional(),
  part_mcq: z.array(QuestionPartMcqSchema).optional(),
});

const Body = z.object({
  room: z.string().min(3),
  identity: z.string().min(1),
  name: z.string().min(1),
  // New: full question list
  questions: z.array(QuestionSchema).optional(),
  // Legacy single-question fields (kept for backwards compat)
  questionText: z.string().optional(),
  questionContext: z.string().optional(),
  questionHints: z.array(z.string()).optional(),
});

tokenRouter.post("/getToken", async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { room, identity, name, questions, questionText, questionContext, questionHints } = parsed.data;
  const hasQuestionList = Array.isArray(questions) && questions.length > 0;
  const hasLegacyQuestion = Boolean(questionText?.trim());
  if (!hasQuestionList && !hasLegacyQuestion) {
    return res.status(400).json({ error: "questions are required for LiveKit dispatch" });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) return res.status(500).json({ error: "LiveKit creds missing" });

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: 15 * 60, // 15 minutes — 10 min interview + buffer
  });
  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  const httpUrl = (process.env.LIVEKIT_URL || "")
    .replace(/^wss:\/\//, "https://")
    .replace(/^ws:\/\//, "http://");
  const dispatchMetadata = {
    studentName: name,
    studentId: identity,
    // New: full list of questions
    questions: questions || [],
    // Legacy single-question fields are also populated from Q1 so older/partial agents still start with context.
    questionText: questionText || questions?.[0]?.question || "",
    questionContext: questionContext || questions?.[0]?.context || "",
    questionHints: questionHints || questions?.[0]?.hints || [],
  };
  const dispatchMetadataJson = JSON.stringify(dispatchMetadata);
  console.log("[dispatch] metadata prepared", {
    room,
    identity,
    questions_count: questions?.length ?? 0,
    metadata_bytes: Buffer.byteLength(dispatchMetadataJson, "utf8"),
  });

  // 1. Pre-create the room so it exists when we dispatch
  try {
    const rooms = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    await rooms.createRoom({ name: room, emptyTimeout: 900, maxParticipants: 10 });
    console.log("[room] created:", room);
  } catch (e: any) {
    console.warn("[room] create warning (may already exist):", e?.message);
  }

  // 2. Dispatch agent only if one is not already assigned to this room
  try {
    const dispatch = new AgentDispatchClient(httpUrl, apiKey, apiSecret);
    const existing = await dispatch.listDispatch(room);
    if (existing.length > 0) {
      console.log("[dispatch] Agent already dispatched for room:", room, "— skipping", {
        count: existing.length,
        questions_count: questions?.length ?? 0,
        metadata_bytes: Buffer.byteLength(dispatchMetadataJson, "utf8"),
      });
    } else {
      const result = await dispatch.createDispatch(room, "", {
        metadata: dispatchMetadataJson,
      });
      console.log("[dispatch] ✓ dispatched — id:", result.id, "room:", room, {
        questions_count: questions?.length ?? 0,
        metadata_bytes: Buffer.byteLength(dispatchMetadataJson, "utf8"),
      });
    }
  } catch (e: any) {
    console.error("[dispatch] ✗ FAILED:", e?.message);
    return res.status(500).json({ error: "LiveKit agent dispatch failed" });
  }

  res.json({ token, room, identity, questions_count: questions?.length ?? (hasLegacyQuestion ? 1 : 0) });
});
