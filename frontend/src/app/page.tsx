"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const start = () => {
    if (!studentId.trim() || !name.trim()) return;
    setLoading(true);
    const room = `interview-${studentId}-${Date.now()}`;
    router.push(`/interview?room=${room}&name=${encodeURIComponent(name)}&sid=${studentId}`);
  };

  const ready = studentId.trim().length > 0 && name.trim().length > 0;

  return (
    <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* floating orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full bg-emerald-500/8 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-indigo-900/10 blur-[80px]" />
      </div>

      <div className="relative w-full max-w-md animate-fade-up">
        {/* logo / brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/10">
            <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-white via-white/90 to-white/50 bg-clip-text text-transparent">
            GyanVihar
          </h1>
          <p className="text-sm text-white/40 mt-1 tracking-widest uppercase">AI Admissions Interview</p>
        </div>

        {/* card */}
        <div className="glass rounded-3xl p-8 shadow-2xl shadow-black/40">
          {/* info strip */}
          <div className="flex items-center gap-3 mb-7 p-3 rounded-xl bg-indigo-500/8 border border-indigo-400/15">
            <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 animate-pulse" />
            <p className="text-xs text-indigo-300/80 leading-relaxed">
              10-minute cognitive screening · No formulas needed · Think out loud
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 tracking-wide uppercase">
                Student ID
              </label>
              <input
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-indigo-400/60 focus:bg-white/8 transition-all duration-200 text-sm"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && start()}
                placeholder="GV2026-001"
                spellCheck={false}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 tracking-wide uppercase">
                Full Name
              </label>
              <input
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-indigo-400/60 focus:bg-white/8 transition-all duration-200 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && start()}
                placeholder="Rahul Sharma"
              />
            </div>
          </div>

          <button
            onClick={start}
            disabled={!ready || loading}
            className={`mt-7 w-full py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2
              ${ready && !loading
                ? "shimmer-btn text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98]"
                : "bg-white/5 text-white/25 cursor-not-allowed"
              }`}
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Joining room…
              </>
            ) : (
              <>
                Begin Interview
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </>
            )}
          </button>

          <p className="mt-5 text-center text-xs text-white/20">
            Ensure your microphone is connected before starting
          </p>
        </div>

        {/* feature pills */}
        <div className="flex justify-center gap-3 mt-6 flex-wrap">
          {["AI-powered", "Voice + Vision", "Live Feedback"].map((tag) => (
            <span key={tag} className="px-3 py-1 rounded-full text-xs text-white/30 border border-white/8 bg-white/3">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
