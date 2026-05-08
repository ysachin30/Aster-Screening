"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

interface InterviewReport {
  report_id: string;
  student_id: string;
  room: string;
  academic_correctness: number;
  academic_understanding: number;
  academic_reasoning: number;
  academic_score: number;
  conf_score: number;
  communication_score: number;
  curiosity_score: number;
  exploratory_score: number;
  comprehension_score: number;
  personality_score: number;
  overall_score: number;
  band: string;
  shortlist_status: string;
  manual_override_status: string | null;
  decision_reason: string | null;
  summary: string | null;
  strengths: string[] | null;
  improvements: string[] | null;
  transcript_full: string;
  completed_at: string | null;
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-indigo-400/40 border-t-indigo-400 animate-spin" />
            <p className="text-white/50 text-sm">Loading your results…</p>
          </div>
        </main>
      }
    >
      <ResultsPageContent />
    </Suspense>
  );
}

function shortlistLabel(status: string): { label: string; className: string } {
  switch (status) {
    case "shortlist":
      return { label: "Shortlist", className: "bg-emerald-500/15 border-emerald-400/30 text-emerald-300" };
    case "borderline":
      return { label: "Borderline", className: "bg-amber-500/15 border-amber-400/30 text-amber-200" };
    case "reject":
      return { label: "Not shortlisted", className: "bg-red-500/15 border-red-400/30 text-red-300" };
    default:
      return { label: status, className: "bg-white/10 border-white/20 text-white/70" };
  }
}

function ResultsPageContent() {
  const params = useSearchParams();
  const studentId = params.get("sid") || "";
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    fetch(`${BACKEND}/api/report/${encodeURIComponent(studentId)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setError(typeof data.error === "string" ? data.error : "No report found");
          setReport(null);
          setLoading(false);
          return;
        }
        setReport(data as InterviewReport);
        setLoading(false);
      })
      .catch(() => {
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

  if (!studentId || error || !report) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-3xl p-10 max-w-md text-center">
          <p className="text-white/60">{error || (!studentId ? "Missing student id" : "No report found")}</p>
        </div>
      </main>
    );
  }

  const overallPct = num(report.overall_score);
  const effectiveShortlist = report.manual_override_status || report.shortlist_status;
  const sl = shortlistLabel(effectiveShortlist);

  const academicDims = [
    { label: "Correctness", value: num(report.academic_correctness), color: "#38bdf8" },
    { label: "Understanding", value: num(report.academic_understanding), color: "#818cf8" },
    { label: "Reasoning depth", value: num(report.academic_reasoning), color: "#c084fc" },
  ];

  const personalityDims = [
    { label: "Confidence", value: num(report.conf_score), color: "#6366f1" },
    { label: "Communication", value: num(report.communication_score), color: "#22d3ee" },
    { label: "Curiosity", value: num(report.curiosity_score), color: "#f59e0b" },
    { label: "Exploratory thinking", value: num(report.exploratory_score), color: "#10b981" },
    { label: "Comprehension", value: num(report.comprehension_score), color: "#ec4899" },
  ];

  const strengths = Array.isArray(report.strengths) ? report.strengths : [];
  const improvements = Array.isArray(report.improvements) ? report.improvements : [];

  return (
    <main className="min-h-screen p-6 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full bg-emerald-500/8 blur-[100px]" />
      </div>

      <div className="relative max-w-4xl mx-auto animate-fade-up">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 text-sm mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Interview Complete
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Your Assessment Results</h1>
          <p className="text-white/40">Academic and personality profile</p>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            <span className="px-4 py-1.5 rounded-full text-sm font-medium border bg-indigo-500/15 border-indigo-400/30 text-indigo-200">
              Band {report.band || "—"}
            </span>
            <span className={`px-4 py-1.5 rounded-full text-sm font-medium border ${sl.className}`}>{sl.label}</span>
            {report.manual_override_status ? (
              <span className="px-4 py-1.5 rounded-full text-xs border border-white/15 text-white/50">
                Reviewer override
              </span>
            ) : null}
          </div>
          {report.decision_reason ? (
            <p className="text-white/35 text-xs mt-3 max-w-xl mx-auto">{report.decision_reason}</p>
          ) : null}
        </div>

        <div className="glass rounded-3xl p-8 mb-6 text-center">
          <div className="relative inline-flex items-center justify-center w-32 h-32 mb-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="64" cy="64" r="56" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="url(#gradientOverall)"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={352}
                strokeDashoffset={352 - (352 * overallPct) / 100}
                className="transition-all duration-1000"
              />
              <defs>
                <linearGradient id="gradientOverall" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute text-3xl font-bold text-white">{Math.round(overallPct)}%</span>
          </div>
          <p className="text-white/60 text-sm">Overall score (academic + personality)</p>
          <p className="text-white/35 text-xs mt-2">
            Academic {num(report.academic_score).toFixed(1)} · Personality {num(report.personality_score).toFixed(1)}
          </p>
        </div>

        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Academic (0–10 each)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {academicDims.map((dim) => (
            <div key={dim.label} className="glass rounded-2xl p-6 text-center">
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

        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Personality & communication</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {personalityDims.map((dim) => (
            <div key={dim.label} className="glass rounded-2xl p-6 text-center">
              <p className="text-white/40 text-xs uppercase tracking-wide mb-2">{dim.label}</p>
              <p className="text-3xl font-bold text-white mb-2">{dim.value.toFixed(1)}</p>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${dim.value * 10}%`, backgroundColor: dim.color }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="glass rounded-3xl p-8 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">AI summary</h3>
          <p className="text-white/70 leading-relaxed">{report.summary || "—"}</p>
        </div>

        {(strengths.length > 0 || improvements.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {strengths.length > 0 ? (
              <div className="glass rounded-3xl p-6">
                <h3 className="text-sm font-semibold text-emerald-400/90 mb-3">Strengths</h3>
                <ul className="list-disc list-inside text-white/65 text-sm space-y-1">
                  {strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {improvements.length > 0 ? (
              <div className="glass rounded-3xl p-6">
                <h3 className="text-sm font-semibold text-amber-400/90 mb-3">Areas to improve</h3>
                <ul className="list-disc list-inside text-white/65 text-sm space-y-1">
                  {improvements.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        <div className="glass rounded-3xl p-8">
          <h3 className="text-lg font-semibold text-white mb-4">Full transcript</h3>
          <div className="bg-black/30 rounded-xl p-4 max-h-96 overflow-y-auto">
            <pre className="text-white/50 text-sm whitespace-pre-wrap font-mono">{report.transcript_full}</pre>
          </div>
        </div>

        <div className="flex justify-center gap-4 mt-8">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-6 py-3 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 font-medium text-sm hover:bg-indigo-500/30 transition-colors"
          >
            Print Results
          </button>
          <button
            type="button"
            onClick={() => (window.location.href = "/")}
            className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 font-medium text-sm hover:bg-white/10 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}
