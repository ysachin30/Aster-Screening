import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { pool } from "../db.js";

export const whatsappOtpRouter = Router();

const OTP_TTL_SECONDS = 5 * 60;
const MAX_VERIFY_ATTEMPTS = 5;

const SendOtpBody = z.object({
  student_id: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(8),
});

const VerifyOtpBody = z.object({
  student_id: z.string().min(1),
  name: z.string().min(1).optional(),
  phone: z.string().min(8),
  otp: z.string().regex(/^\d{6}$/),
});

function normalizePhone(rawPhone: string) {
  const compact = rawPhone.trim().replace(/[\s().-]/g, "");
  if (/^\d{10}$/.test(compact)) return `+91${compact}`;
  if (/^00[1-9]\d{7,14}$/.test(compact)) return `+${compact.slice(2)}`;
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  throw new Error("Enter a valid WhatsApp number in E.164 format, e.g. +919876543210");
}

function makeOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashOtp(otp: string, studentId: string, phone: string) {
  const secret = process.env.OTP_HASH_SECRET || process.env.WHATSAPP_TOKEN || "local-dev-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(`${studentId}:${phone}:${otp}`)
    .digest("hex");
}

async function ensureOtpTable() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_otp_verifications (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id      TEXT NOT NULL,
      phone           TEXT NOT NULL,
      otp_hash        TEXT NOT NULL,
      expires_at      TIMESTAMPTZ NOT NULL,
      verified_at     TIMESTAMPTZ,
      attempt_count   INTEGER NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_student_otp_lookup
      ON student_otp_verifications(student_id, phone, created_at DESC)
  `);
}

async function sendWhatsAppOtp(phone: string, otp: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_OTP_TEMPLATE || "otp_login";
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v22.0";
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";

  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp credentials are not configured");
  }

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone.replace(/^\+/, ""),
      type: "template",
      template: {
        name: template,
        language: { code: languageCode },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: otp }],
          },
        ],
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`WhatsApp OTP send failed (${response.status}): ${body.slice(0, 300)}`);
  }
}

whatsappOtpRouter.post("/otp/send", async (req, res) => {
  const parsed = SendOtpBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "student_id, name, and valid phone are required" });

  try {
    await ensureOtpTable();
    const { student_id } = parsed.data;
    const phone = normalizePhone(parsed.data.phone);
    const otp = makeOtp();

    await sendWhatsAppOtp(phone, otp);

    await pool.query(
      `INSERT INTO student_otp_verifications (student_id, phone, otp_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4::text || ' seconds')::interval)`,
      [student_id.trim(), phone, hashOtp(otp, student_id.trim(), phone), OTP_TTL_SECONDS],
    );

    res.json({ ok: true, expires_in_seconds: OTP_TTL_SECONDS });
  } catch (err: any) {
    console.error("[whatsapp-otp/send]", err?.message || err);
    res.status(500).json({ error: "Failed to send OTP. Please try again." });
  }
});

whatsappOtpRouter.post("/otp/verify", async (req, res) => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "student_id, phone, and 6-digit otp are required" });

  try {
    await ensureOtpTable();
    const studentId = parsed.data.student_id.trim();
    const phone = normalizePhone(parsed.data.phone);
    const otpHash = hashOtp(parsed.data.otp, studentId, phone);

    const { rows } = await pool.query<{
      id: string;
      otp_hash: string;
      attempt_count: number;
      expires_at: string;
      verified_at: string | null;
    }>(
      `SELECT id, otp_hash, attempt_count, expires_at, verified_at
       FROM student_otp_verifications
       WHERE student_id = $1 AND phone = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [studentId, phone],
    );

    const latest = rows[0];
    if (!latest || latest.verified_at || Number(latest.attempt_count) >= MAX_VERIFY_ATTEMPTS) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    if (new Date(latest.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    if (latest.otp_hash !== otpHash) {
      await pool.query(
        `UPDATE student_otp_verifications SET attempt_count = attempt_count + 1 WHERE id = $1`,
        [latest.id],
      );
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    await pool.query(
      `UPDATE student_otp_verifications
       SET verified_at = NOW(), attempt_count = attempt_count + 1
       WHERE id = $1`,
      [latest.id],
    );

    if (parsed.data.name?.trim()) {
      await pool.query(
        `INSERT INTO students (student_id, name, phone, whatsapp_consent)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (student_id) DO UPDATE SET
           name = EXCLUDED.name,
           phone = EXCLUDED.phone,
           whatsapp_consent = TRUE`,
        [studentId, parsed.data.name.trim(), phone],
      );
    }

    res.json({ ok: true, verified: true });
  } catch (err: any) {
    console.error("[whatsapp-otp/verify]", err?.message || err);
    res.status(500).json({ error: "Failed to verify OTP. Please try again." });
  }
});
