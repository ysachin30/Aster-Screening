import { Router } from "express";
import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";
import { z } from "zod";

export const tokenRouter = Router();

const Body = z.object({
  room: z.string().min(3),
  identity: z.string().min(1),
  name: z.string().min(1),
});

tokenRouter.post("/getToken", async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { room, identity, name } = parsed.data;

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

  // Dispatch AI agent — skip if one already exists for this room
  try {
    const dispatch = new AgentDispatchClient(
      process.env.LIVEKIT_URL!,
      apiKey!,
      apiSecret!
    );
    const existing = await dispatch.listDispatch(room);
    if (existing.length === 0) {
      await dispatch.createDispatch(room, "", { metadata: JSON.stringify({ studentName: name, studentId: identity }) });
      console.log("[dispatch] agent dispatched to room", room);
    } else {
      console.log("[dispatch] agent already dispatched to room", room, "— skipping");
    }
  } catch (e: any) {
    console.warn("[dispatch] agent dispatch failed (non-fatal):", e?.message);
  }

  res.json({ token, room, identity });
});
