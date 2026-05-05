import { Router } from "express";
import { AccessToken, AgentDispatchClient, RoomServiceClient } from "livekit-server-sdk";
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

  const httpUrl = (process.env.LIVEKIT_URL || "")
    .replace(/^wss:\/\//, "https://")
    .replace(/^ws:\/\//, "http://");

  // 1. Pre-create the room so it exists when we dispatch
  try {
    const rooms = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    await rooms.createRoom({ name: room, emptyTimeout: 900, maxParticipants: 10 });
    console.log("[room] created:", room);
  } catch (e: any) {
    console.warn("[room] create warning (may already exist):", e?.message);
  }

  // 2. Dispatch agent — agent_name "" matches the Python worker registered with agent_name=""
  try {
    const dispatch = new AgentDispatchClient(httpUrl, apiKey, apiSecret);
    const result = await dispatch.createDispatch(room, "", {
      metadata: JSON.stringify({ studentName: name, studentId: identity }),
    });
    console.log("[dispatch] ✓ dispatched — id:", result.id, "room:", room);
  } catch (e: any) {
    console.error("[dispatch] ✗ FAILED:", e?.message);
  }

  res.json({ token, room, identity });
});
