"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const readinessChecklist = [
  "Use a quiet space with a working microphone.",
  "Keep your phone in portrait or landscape mode comfortably.",
  "Explain your reasoning aloud even when you are unsure.",
];

const sessionHighlights = [
  "10-minute guided interview",
  "Interactive visual reasoning prompts",
  "Works across desktop and mobile",
];

export default function Home() {
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const start = async () => {
    if (!studentId.trim() || !name.trim() || loading) return;
    setLoading(true);
    const room = `interview-${studentId}-${Date.now()}`;
    try {
      window.sessionStorage.setItem("gv:auto-fullscreen", "1");
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.debug("Fullscreen request skipped", error);
    } finally {
      router.push(`/interview?room=${room}&name=${encodeURIComponent(name)}&sid=${studentId}`);
    }
  };

  const ready = studentId.trim().length > 0 && name.trim().length > 0;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.08]" />
        <div className="absolute left-[8%] top-[10%] h-64 w-64 rounded-full bg-indigo-500/14 blur-[110px]" />
        <div className="absolute bottom-[8%] right-[10%] h-72 w-72 rounded-full bg-sky-500/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
          <section className="glass animate-fade-up rounded-[28px] border border-white/10 p-6 sm:p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-blue-100/80">
              <span className="h-2 w-2 rounded-full bg-blue-300" />
              Admissions Interview
            </div>

            <div className="mt-6 max-w-2xl">
              <p className="text-sm uppercase tracking-[0.3em] text-white/35">Gyan Vihar University</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Professional interview experience with a consistent, focused UI.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                This session is designed to feel calm, interactive, and serious. You will see visual prompts, answer out loud, and move through a timed interview flow that adapts well on desktop and mobile.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {sessionHighlights.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-sm text-slate-200"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/45 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-white/45">
                  Before You Begin
                </h2>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
                  Recommended
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {readinessChecklist.map((item, index) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/10 text-xs font-semibold text-blue-200">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-slate-300">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="glass animate-fade-up rounded-[28px] border border-white/10 p-6 shadow-2xl shadow-black/30 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-white/35">Candidate Access</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Enter interview room</h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10">
                <svg className="h-6 w-6 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7.5h15m-15 4.5h15m-15 4.5h9" />
                </svg>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.22em] text-white/45">
                  Student ID
                </label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 text-sm text-white placeholder:text-white/25 focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void start()}
                  placeholder="GV2026-001"
                  spellCheck={false}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.22em] text-white/45">
                  Full Name
                </label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 text-sm text-white placeholder:text-white/25 focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void start()}
                  placeholder="Rahul Sharma"
                />
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-300" />
                <p className="text-sm leading-6 text-slate-300">
                  We will attempt to open the interview in full screen when you begin, so the question area stays focused and distraction-free.
                </p>
              </div>
            </div>

            <button
              onClick={() => void start()}
              disabled={!ready || loading}
              className={`mt-7 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold tracking-wide transition-all duration-300 ${
                ready && !loading
                  ? "shimmer-btn text-white shadow-lg shadow-blue-950/40 hover:scale-[1.01] hover:shadow-xl"
                  : "cursor-not-allowed bg-white/5 text-white/25"
              }`}
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Joining interview room…
                </>
              ) : (
                <>
                  Begin Interview
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </button>

            <p className="mt-4 text-center text-xs text-white/30">
              Microphone access is requested immediately after you enter the room.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
