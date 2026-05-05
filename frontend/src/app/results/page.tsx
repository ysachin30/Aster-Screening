"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

interface Evaluation {
  id: number;
  student_id: string;
  room: string;
  transcript: string;
  curiosity: number;
  exploratory: number;
  confidence: number;
  summary: string;
  created_at: string;
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-400/40 border-t-indigo-400 animate-spin" />
          <p className="text-white/50 text-sm">Loading your results…</p>
        </div>
      </main>
    }>
      <ResultsPageContent />
    </Suspense>
  );
}

function ResultsPageContent() {
  const params = useSearchParams();
  const studentId = params.get("sid") || "";
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    fetch(`${BACKEND}/api/evaluation/${studentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.length > 0) {
          setEvaluation(data[0]);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError("Failed to load results");
        setLoading(false);
      });
  }, [studentId]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-400/40 border-t-indigo-400 animate-spin" />
          <p className="text-white/50 text-sm">Loading your results…</p>
        </div>
      </main>
    );
  }

  if (error || !evaluation) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-3xl p-10 max-w-md text-center">
          <p className="text-white/60">{error || "No evaluation found"}</p>
        </div>
      </main>
    );
  }

  const totalScore = ((evaluation.curiosity + evaluation.exploratory + evaluation.confidence) / 30) * 100;

  return (
    <main className="min-h-screen p-6 relative overflow-hidden">
      {/* background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full bg-emerald-500/8 blur-[100px]" />
      </div>

      <div className="relative max-w-4xl mx-auto animate-fade-up">
        {/* header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 text-sm mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Interview Complete
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Your Assessment Results</h1>
          <p className="text-white/40">Cognitive Profile Evaluation</p>
        </div>

        {/* overall score */}
        <div className="glass rounded-3xl p-8 mb-6 text-center">
          <div className="relative inline-flex items-center justify-center w-32 h-32 mb-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="64" cy="64" r="56" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="url(#gradient)"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={352}
                strokeDashoffset={352 - (352 * totalScore) / 100}
                className="transition-all duration-1000"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute text-3xl font-bold text-white">{Math.round(totalScore)}%</span>
          </div>
          <p className="text-white/60 text-sm">Overall Performance Score</p>
        </div>

        {/* dimension scores */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { label: "Curiosity", value: evaluation.curiosity, color: "#f59e0b", icon: "🔍" },
            { label: "Exploratory", value: evaluation.exploratory, color: "#10b981", icon: "🧭" },
            { label: "Confidence", value: evaluation.confidence, color: "#6366f1", icon: "💪" },
          ].map((dim) => (
            <div key={dim.label} className="glass rounded-2xl p-6 text-center">
              <div className="text-3xl mb-2">{dim.icon}</div>
              <p className="text-white/40 text-xs uppercase tracking-wide mb-2">{dim.label}</p>
              <p className="text-4xl font-bold text-white mb-2">{dim.value.toFixed(1)}</p>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${dim.value * 10}%`, backgroundColor: dim.color }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* summary */}
        <div className="glass rounded-3xl p-8 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI Summary
          </h3>
          <p className="text-white/70 leading-relaxed">{evaluation.summary}</p>
        </div>

        {/* transcript */}
        <div className="glass rounded-3xl p-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Full Transcript
          </h3>
          <div className="bg-black/30 rounded-xl p-4 max-h-96 overflow-y-auto">
            <pre className="text-white/50 text-sm whitespace-pre-wrap font-mono">{evaluation.transcript}</pre>
          </div>
        </div>

        {/* actions */}
        <div className="flex justify-center gap-4 mt-8">
          <button
            onClick={() => window.print()}
            className="px-6 py-3 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 font-medium text-sm hover:bg-indigo-500/30 transition-colors"
          >
            Print Results
          </button>
          <button
            onClick={() => window.location.href = "/"}
            className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 font-medium text-sm hover:bg-white/10 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}
