"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ASSESSMENT_SEQUENCE_START,
  reserveAssessmentSequence,
} from "@/lib/assessment";

export default function Home() {
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sequence, setSequence] = useState<number>(ASSESSMENT_SEQUENCE_START);
  const router = useRouter();

  useEffect(() => {
    setSequence(reserveAssessmentSequence());
  }, []);

  const start = () => {
    if (!studentId.trim() || !name.trim()) return;
    setLoading(true);
    const room = `interview-${studentId}-${Date.now()}`;
    router.push(
      `/interview?room=${room}&name=${encodeURIComponent(name)}&sid=${studentId}&seq=${sequence}`,
    );
  };

  const ready = studentId.trim().length > 0 && name.trim().length > 0;

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-10 lg:px-10">
        <div className="grid w-full gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              AESTR Admission Screening
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                  A focused AI-assisted interview environment.
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                  Complete your screening in a timed, monitored environment designed to mirror a
                  real university assessment.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {[
                  "10-minute assessment",
                  "Microphone required",
                  "Webcam-ready environment",
                  "AI monitored",
                ].map((item) => (
                  <span
                    key={item}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Candidate Registration
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Enter your details to begin the assessment
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                    Sequence
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">#{sequence}</p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Student ID
                  </span>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && start()}
                    placeholder="AESTR-2026-014"
                    spellCheck={false}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Full Name
                  </span>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && start()}
                    placeholder="Aarav Sharma"
                  />
                </label>
              </div>

              <button
                onClick={start}
                disabled={!ready || loading}
                className={`mt-8 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                  ready && !loading
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "cursor-not-allowed bg-slate-100 text-slate-400"
                }`}
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
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
                    Preparing environment...
                  </>
                ) : (
                  <>
                    Begin Interview
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                      />
                    </svg>
                  </>
                )}
              </button>
            </motion.div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            className="hidden lg:block relative"
          >
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-900">What to expect</h3>
                <p className="mt-1 text-sm text-slate-500">The assessment is split into multiple parts.</p>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">10-Minute Timer</h4>
                    <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                      You will have 10 minutes to complete the assessment. The timer will be visible at the top of your screen.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Voice Responses</h4>
                    <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                      The AI interviewer will listen to your verbal answers. Speak clearly and explain your reasoning.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Focus Mode</h4>
                    <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                      The browser will enter fullscreen to minimize distractions. Ensure you are in a quiet environment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  );
}
