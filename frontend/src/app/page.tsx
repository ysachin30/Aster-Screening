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
    <main className="relative min-h-screen bg-slate-50 overflow-hidden flex flex-col justify-center">
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
                  <p className="mt-0.5 text-lg font-semibold text-slate-700">#{sequence}</p>
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
                    onChange={(e) => setStudentId(e.target.value)}
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
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && start()}
                    placeholder="Aarav Sharma"
                  />
                </label>
              </div>

              <button
                onClick={start}
                disabled={!ready || loading}
                className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold transition-all ${
                  ready && !loading
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
