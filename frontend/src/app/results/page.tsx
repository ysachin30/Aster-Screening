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
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-8 py-9 text-center shadow-sm">
            <div className="h-12 w-12 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
            <p className="text-sm font-medium text-slate-600">Loading your AESTR results...</p>
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
    return { label: "Pending review", className: "border-slate-200 bg-slate-50 text-slate-600" };
  }
  switch (status) {
    case "shortlist":
      return { label: "Shortlist", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    case "borderline":
      return { label: "Borderline", className: "border-orange-200 bg-orange-50 text-orange-700" };
    case "reject":
      return { label: "Not shortlisted", className: "border-red-200 bg-red-50 text-red-700" };
    default:
      return { label: status, className: "border-slate-200 bg-slate-50 text-slate-600" };
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
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-8 py-9 text-center shadow-sm">
          <div className="h-12 w-12 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
          <p className="text-sm font-medium text-slate-600">Loading your AESTR results...</p>
        </div>
      </main>
    );
  }

  if (!studentId || error || !report) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-base font-medium text-slate-700">
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
    { label: "Confidence", value: num(report.conf_score), color: "#6366f1" },
    { label: "Communication", value: num(report.communication_score), color: "#06b6d4" },
    { label: "Curiosity", value: num(report.curiosity_score), color: "#f59e0b" },
    { label: "Exploratory thinking", value: num(report.exploratory_score), color: "#10b981" },
    { label: "Comprehension", value: num(report.comprehension_score), color: "#ec4899" },
  ];

  const strengths = Array.isArray(report.strengths) ? report.strengths : [];
  const improvements = Array.isArray(report.improvements) ? report.improvements : [];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 lg:px-8">
      <div className="mx-auto max-w-6xl animate-fade-up">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-slate-600 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Assessment complete
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-slate-500">AESTR evaluation report</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Your assessment results
          </h1>
          <p className="mt-3 text-base text-slate-600">Academic performance and communication profile</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-bold text-blue-700">
              Band {report.band || "—"}
            </span>
            <span className={`rounded-full border px-4 py-1.5 text-sm font-bold ${sl.className}`}>{sl.label}</span>
            {report.manual_override_status ? (
              <span className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                Reviewer override
              </span>
            ) : null}
          </div>
          {report.decision_reason ? (
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-600">{report.decision_reason}</p>
          ) : null}
        </div>

        <div className="mb-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="relative mb-4 inline-flex h-32 w-32 items-center justify-center">
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
                  <stop offset="0%" stopColor="#3b82f6" />
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
            <p className="mt-2 text-xs font-medium text-slate-500">
              Academic {formatNum(num(report.academic_score))} · Personality {formatNum(num(report.personality_score))}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">AI summary</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Evaluation overview</h2>
            <p className="mt-4 text-base leading-relaxed text-slate-700">{report.summary || "—"}</p>
          </div>
        </div>

        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">Academic profile</h2>
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {academicDims.map((dim) => (
            <div key={dim.label} className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{dim.label}</p>
              <p className="mb-2 text-4xl font-bold text-slate-900">{formatNum(dim.value)}</p>
              {dim.value === null ? <p className="mb-2 text-[10px] font-medium text-slate-400">Pending review</p> : null}
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${(dim.value ?? 0) * 10}%`, backgroundColor: dim.color }}
                />
              </div>
            </div>
          ))}
        </div>

        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">Communication profile</h2>
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {personalityDims.map((dim) => (
            <div key={dim.label} className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{dim.label}</p>
              <p className="mb-2 text-3xl font-bold text-slate-900">{formatNum(dim.value)}</p>
              {dim.value === null ? <p className="mb-2 text-[10px] font-medium text-slate-400">Pending review</p> : null}
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${(dim.value ?? 0) * 10}%`, backgroundColor: dim.color }}
                />
              </div>
            </div>
          ))}
        </div>

        {(strengths.length > 0 || improvements.length > 0) && (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {strengths.length > 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                <h3 className="mb-3 text-sm font-bold text-emerald-800">Strengths</h3>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-emerald-700">
                  {strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {improvements.length > 0 ? (
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6">
                <h3 className="mb-3 text-sm font-bold text-orange-800">Areas to improve</h3>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-orange-700">
                  {improvements.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-slate-900">Full transcript</h3>
          <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-4">
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-700">{report.transcript_full}</pre>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-primary flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold transition-colors"
          >
            Print results
          </button>
          <button
            type="button"
            onClick={() => (window.location.href = "/")}
            className="btn-secondary flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold transition-colors"
          >
            Back to home
          </button>
        </div>
      </div>
    </main>
  );
}
