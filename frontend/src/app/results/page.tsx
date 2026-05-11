"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

function num(v: unknown, fallback: number | null = null): number | null {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

function formatNum(v: number | null, digits = 1) {
  return v === null ? "—" : v.toFixed(digits);
}

interface InterviewReport {
  report_id: string;
  student_id: string;
  room: string;
  academic_correctness: number | null;
  academic_understanding: number | null;
  academic_reasoning: number | null;
  academic_score: number | null;
  conf_score: number | null;
  communication_score: number | null;
  curiosity_score: number | null;
  exploratory_score: number | null;
  comprehension_score: number | null;
  personality_score: number | null;
  overall_score: number | null;
  band: string | null;
  shortlist_status: string | null;
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
        <main className="flex min-h-screen items-center justify-center px-6">
          <div className="glass flex flex-col items-center gap-4 rounded-[2rem] px-8 py-9 text-center">
            <div className="h-12 w-12 rounded-full border-2 border-indigo-300/25 border-t-indigo-300 animate-spin" />
            <p className="text-sm text-slate-200">Loading your AESTR results...</p>
          </div>
        </main>
      }
    >
      <ResultsPageContent />
    </Suspense>
  );
}

function shortlistLabel(status: string | null): { label: string; className: string } {
  if (!status) {
    return { label: "Pending review", className: "border-slate-200 bg-slate-50 text-slate-700" };
  }
  switch (status) {
    case "shortlist":
      return { label: "Shortlist", className: "border-emerald-200 bg-emerald-50 text-emerald-800" };
    case "borderline":
      return { label: "Borderline", className: "border-amber-200 bg-amber-50 text-amber-800" };
    case "reject":
      return { label: "Not shortlisted", className: "border-red-200 bg-red-50 text-red-800" };
    default:
      return { label: status, className: "border-slate-200 bg-slate-50 text-slate-700" };
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
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="surface-panel flex flex-col items-center gap-4 rounded-2xl px-8 py-9 text-center shadow-sm">
          <div className="h-12 w-12 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600">Loading your AESTR results...</p>
        </div>
      </main>
    );
  }

  if (!studentId || error || !report) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="surface-panel max-w-md rounded-2xl p-10 text-center shadow-sm">
          <p className="text-base text-slate-600">
            {error || (!studentId ? "Missing student id" : "No report found")}
          </p>
        </div>
      </main>
    );
  }

  const overallPct = num(report.overall_score);
  const effectiveShortlist = report.manual_override_status || report.shortlist_status;
  const sl = shortlistLabel(effectiveShortlist);
  const reviewPending = overallPct === null;

  const academicDims = [
    { label: "Correctness", value: num(report.academic_correctness), color: "#3b82f6" },
    { label: "Understanding", value: num(report.academic_understanding), color: "#6366f1" },
    { label: "Reasoning depth", value: num(report.academic_reasoning), color: "#8b5cf6" },
  ];

  const personalityDims = [
    { label: "Confidence", value: num(report.conf_score), color: "#4f46e5" },
    { label: "Communication", value: num(report.communication_score), color: "#06b6d4" },
    { label: "Curiosity", value: num(report.curiosity_score), color: "#f59e0b" },
    { label: "Exploratory thinking", value: num(report.exploratory_score), color: "#10b981" },
    { label: "Comprehension", value: num(report.comprehension_score), color: "#ec4899" },
  ];

  const strengths = Array.isArray(report.strengths) ? report.strengths : [];
  const improvements = Array.isArray(report.improvements) ? report.improvements : [];

  return (
    <main className="relative min-h-screen bg-slate-50 px-6 py-8 md:py-12">
      <div className="relative mx-auto max-w-5xl animate-fade-up">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Assessment complete
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">AESTR evaluation report</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Your assessment results
          </h1>
          <p className="mt-3 text-base text-slate-600">Academic performance and communication profile</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
              Band {report.band || "—"}
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${sl.className}`}>{sl.label}</span>
            {report.manual_override_status ? (
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                Reviewer override
              </span>
            ) : null}
          </div>
          {report.decision_reason ? (
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">{report.decision_reason}</p>
          ) : null}
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-[0.8fr_1.2fr] xl:gap-8">
          <div className="surface-panel rounded-2xl p-8 text-center shadow-sm border border-slate-200 flex flex-col justify-center items-center">
            <div className="relative mb-6 inline-flex h-32 w-32 items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="#f1f5f9" strokeWidth="8" fill="none" />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="url(#gradientOverall)"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={352}
                  strokeDashoffset={352 - (352 * (overallPct ?? 0)) / 100}
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="gradientOverall" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4f46e5" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute text-3xl font-bold text-slate-900">
                {overallPct === null ? "—" : `${Math.round(overallPct)}%`}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {reviewPending ? "Automatic scoring pending review" : "Overall score"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Academic {formatNum(num(report.academic_score))} · Personality {formatNum(num(report.personality_score))}
            </p>
          </div>

          <div className="surface-panel rounded-2xl p-8 shadow-sm border border-slate-200">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">AI summary</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Evaluation overview</h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-700">{report.summary || "—"}</p>
          </div>
        </div>

        <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Academic profile</h2>
        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {academicDims.map((dim) => (
            <div key={dim.label} className="surface-panel rounded-2xl p-6 text-center shadow-sm border border-slate-200">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">{dim.label}</p>
              <p className="mb-3 text-3xl font-bold text-slate-900">{formatNum(dim.value)}</p>
              {dim.value === null ? <p className="mb-3 text-[10px] text-slate-400 font-medium">Pending review</p> : null}
              <div className="mx-auto h-1.5 w-full max-w-[8rem] overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${(dim.value ?? 0) * 10}%`, backgroundColor: dim.color }}
                />
              </div>
            </div>
          ))}
        </div>

        <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Communication profile</h2>
        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {personalityDims.map((dim) => (
            <div key={dim.label} className="surface-panel rounded-2xl p-6 text-center shadow-sm border border-slate-200">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">{dim.label}</p>
              <p className="mb-3 text-2xl font-bold text-slate-900">{formatNum(dim.value)}</p>
              {dim.value === null ? <p className="mb-3 text-[10px] text-slate-400 font-medium">Pending review</p> : null}
              <div className="mx-auto h-1.5 w-full max-w-[6rem] overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${(dim.value ?? 0) * 10}%`, backgroundColor: dim.color }}
                />
              </div>
            </div>
          ))}
        </div>

        {(strengths.length > 0 || improvements.length > 0) && (
          <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2">
            {strengths.length > 0 ? (
              <div className="surface-panel rounded-2xl p-6 shadow-sm border border-slate-200">
                <h3 className="mb-4 text-sm font-semibold text-emerald-600">Strengths</h3>
                <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600 marker:text-emerald-400">
                  {strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {improvements.length > 0 ? (
              <div className="surface-panel rounded-2xl p-6 shadow-sm border border-slate-200">
                <h3 className="mb-4 text-sm font-semibold text-amber-600">Areas to improve</h3>
                <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600 marker:text-amber-400">
                  {improvements.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        <div className="surface-panel rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Full transcript</h3>
          <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-inner">
            <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-slate-600">{report.transcript_full}</pre>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-primary rounded-xl px-6 py-3 text-sm font-semibold"
          >
            Print results
          </button>
          <button
            type="button"
            onClick={() => (window.location.href = "/")}
            className="btn-secondary rounded-xl px-6 py-3 text-sm font-semibold"
          >
            Back to home
          </button>
        </div>
      </div>
    </main>
  );
}
