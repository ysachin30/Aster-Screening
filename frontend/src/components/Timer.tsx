"use client";
import { useEffect, useState } from "react";

const RADIUS = 20;
const CIRC = 2 * Math.PI * RADIUS;

export default function Timer({ minutes, onEnd }: { minutes: number; onEnd: () => void }) {
  const total = minutes * 60;
  const [secs, setSecs] = useState(total);

  useEffect(() => {
    if (secs <= 0) { onEnd(); return; }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs, onEnd]);

  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  const progress = secs / total;
  const dash = CIRC * progress;
  const isUrgent = secs <= 60;
  const isCritical = secs <= 30;

  const color = isCritical ? "#ef4444" : isUrgent ? "#f59e0b" : "#60a5fa";

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/65 px-3 py-2 shadow-lg shadow-black/20 sm:px-4 sm:py-3">
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
          <svg className="h-14 w-14 -rotate-90 sm:h-16 sm:w-16" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
            <circle
              cx="24" cy="24" r={RADIUS}
              fill="none"
              stroke={color}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${CIRC}`}
              style={{ transition: "stroke-dasharray 0.8s linear, stroke 0.5s ease", filter: `drop-shadow(0 0 6px ${color}80)` }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={`text-[10px] font-bold uppercase tracking-[0.22em] ${
                isCritical ? "text-red-300" : isUrgent ? "text-amber-300" : "text-blue-200"
              }`}
            >
              T
            </span>
          </div>
        </div>

        <div className="min-w-[7.5rem]">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/40 sm:text-[11px]">
            Time Remaining
          </p>
          <p
            className={`font-mono text-2xl font-semibold leading-none sm:text-3xl ${
              isCritical ? "text-red-300" : isUrgent ? "text-amber-300" : "text-white"
            }`}
          >
            {m}:{s}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress * 100}%`, backgroundColor: color }}
            />
          </div>
          <p className={`mt-2 text-[11px] font-medium ${isCritical ? "text-red-300" : isUrgent ? "text-amber-300" : "text-slate-300"}`}>
            {isCritical ? "Finish your final thought." : isUrgent ? "Less than a minute left." : "Stay concise and think aloud."}
          </p>
        </div>
      </div>
    </div>
  );
}
