"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ASSESSMENT_SEQUENCE_START,
  reserveAssessmentSequence,
} from "@/lib/assessment";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export default function Home() {
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState<"send" | "verify" | null>(null);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sequence, setSequence] = useState<number>(ASSESSMENT_SEQUENCE_START);
  const [sequenceReady, setSequenceReady] = useState(false);
  const [sequenceError, setSequenceError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void reserveAssessmentSequence()
      .then((reservedSequence) => {
        if (cancelled) return;
        setSequence(reservedSequence);
        setSequenceReady(true);
        setSequenceError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[assessment-sequence]", err);
        setSequenceReady(false);
        setSequenceError("Unable to allocate a candidate sequence right now.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resetOtpState = () => {
    setOtp("");
    setOtpSent(false);
    setPhoneVerified(false);
    setOtpMessage(null);
    setOtpError(null);
  };

  const sendOtp = async () => {
    if (!studentId.trim() || !name.trim() || !phone.trim() || otpLoading) return;
    setOtpLoading("send");
    setOtpError(null);
    setOtpMessage(null);
    setPhoneVerified(false);
    try {
      const response = await fetch(`${BACKEND}/api/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId.trim(),
          name: name.trim(),
          phone: phone.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to send OTP");
      setOtpSent(true);
      setOtp("");
      setOtpMessage("OTP sent on WhatsApp. It expires in 5 minutes.");
    } catch (err: any) {
      setOtpError(err?.message || "Unable to send OTP. Please try again.");
    } finally {
      setOtpLoading(null);
    }
  };

  const verifyOtp = async () => {
    if (!studentId.trim() || !phone.trim() || !otp.trim() || otpLoading) return;
    setOtpLoading("verify");
    setOtpError(null);
    setOtpMessage(null);
    try {
      const response = await fetch(`${BACKEND}/api/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId.trim(),
          name: name.trim(),
          phone: phone.trim(),
          otp: otp.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Invalid OTP");
      setPhoneVerified(true);
      setOtpMessage("WhatsApp number verified. You can begin the interview.");
    } catch (err: any) {
      setPhoneVerified(false);
      setOtpError(err?.message || "Unable to verify OTP. Please try again.");
    } finally {
      setOtpLoading(null);
    }
  };

  const start = async () => {
    if (!studentId.trim() || !name.trim() || !phoneVerified || loading) return;
    setLoading(true);
    try {
      const studentResponse = await fetch(`${BACKEND}/api/student`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId.trim(),
          name: name.trim(),
          phone: phone.trim(),
          whatsapp_consent: true,
        }),
      });
      if (!studentResponse.ok) throw new Error("Unable to save verified student details.");
      const reservedSequence = await reserveAssessmentSequence();
      setSequence(reservedSequence);
      setSequenceReady(true);
      setSequenceError(null);
      const room = `interview-${studentId.trim()}-${Date.now()}`;
      router.push(
        `/interview?room=${room}&name=${encodeURIComponent(name.trim())}&sid=${encodeURIComponent(studentId.trim())}&seq=${reservedSequence}`,
      );
    } catch (err) {
      console.warn("[assessment-sequence]", err);
      setSequenceReady(false);
      setSequenceError("Unable to allocate a candidate sequence right now.");
      setLoading(false);
    }
  };

  const canSendOtp = studentId.trim().length > 0 && name.trim().length > 0 && phone.trim().length > 0;
  const ready = canSendOtp && phoneVerified;

  return (
    <main className="relative flex min-h-screen flex-col justify-center overflow-y-auto bg-slate-50">
      <div className="relative mx-auto flex w-full max-w-[1040px] items-center px-6 py-12 lg:px-10">
        <div className="grid w-full gap-16 lg:grid-cols-2 lg:items-center">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="max-w-xl"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              AESTR Admission Screening
            </div>

            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-[54px] lg:leading-[1.1]">
              A focused environment for serious evaluation.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-600">
              Complete your university screening in a timed, monitored environment designed to mirror a real assessment experience.
            </p>

            <div className="mt-8 flex flex-wrap gap-2.5">
              {[
                "10-minute assessment",
                "Microphone required",
                "Webcam-ready environment",
                "AI monitored",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm"
                >
                  {item}
                </span>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
            className="relative"
          >
            <div className="surface-panel rounded-2xl p-6 sm:p-8">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Candidate registration
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Begin your AESTR interview
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                    Sequence
                  </p>
                  <p className="mt-0.5 text-lg font-semibold text-slate-700">
                    {sequenceReady ? `#${sequence}` : "Allocating..."}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Student ID
                  </span>
                  <input
                    className="field-shell w-full rounded-xl px-4 py-3 text-sm"
                    value={studentId}
                    onChange={(e) => {
                      setStudentId(e.target.value);
                      resetOtpState();
                    }}
                    onKeyDown={(e) => e.key === "Enter" && start()}
                    placeholder="AESTR-2026-014"
                    spellCheck={false}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Full Name
                  </span>
                  <input
                    className="field-shell w-full rounded-xl px-4 py-3 text-sm"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      resetOtpState();
                    }}
                    onKeyDown={(e) => e.key === "Enter" && start()}
                    placeholder="Aarav Sharma"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    WhatsApp Number
                  </span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      className="field-shell w-full rounded-xl px-4 py-3 text-sm"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        resetOtpState();
                      }}
                      placeholder="+919876543210"
                      inputMode="tel"
                    />
                    <button
                      type="button"
                      onClick={sendOtp}
                      disabled={!canSendOtp || otpLoading !== null}
                      className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {otpLoading === "send" ? "Sending..." : otpSent ? "Resend OTP" : "Send OTP"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    Use E.164 format. Indian 10-digit numbers are accepted and sent as +91.
                  </p>
                </label>

                {otpSent || phoneVerified ? (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      WhatsApp OTP
                    </span>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        className="field-shell w-full rounded-xl px-4 py-3 text-sm tracking-[0.35em]"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                        placeholder="000000"
                        inputMode="numeric"
                        disabled={phoneVerified}
                      />
                      <button
                        type="button"
                        onClick={verifyOtp}
                        disabled={phoneVerified || otp.length !== 6 || otpLoading !== null}
                        className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {phoneVerified ? "Verified" : otpLoading === "verify" ? "Verifying..." : "Verify OTP"}
                      </button>
                    </div>
                  </label>
                ) : null}
              </div>

              {otpError ? (
                <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {otpError}
                </p>
              ) : null}

              {otpMessage ? (
                <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                  {otpMessage}
                </p>
              ) : null}

              <button
                onClick={start}
                disabled={!ready || loading || !sequenceReady}
                className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold transition-all ${
                  ready && !loading && sequenceReady
                    ? "btn-primary"
                    : "cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200"
                }`}
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    Preparing assessment room...
                  </>
                ) : (
                  "Begin Interview"
                )}
              </button>

              {sequenceError ? (
                <p className="mt-3 text-center text-xs font-medium text-amber-700">{sequenceError}</p>
              ) : null}

              <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
                By continuing, you confirm that your microphone is available and you are ready to complete a monitored interview.
              </p>
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  );
}
