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

  const color = isCritical ? "#ef4444" : isUrgent ? "#f59e0b" : "#6366f1";

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-12 h-12 shrink-0">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3.5" />
          <circle
            cx="24" cy="24" r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRC}`}
            style={{ transition: "stroke-dasharray 0.8s linear, stroke 0.5s ease", filter: `drop-shadow(0 0 4px ${color}80)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-[10px] font-bold font-mono leading-none ${isCritical ? "text-red-400" : isUrgent ? "text-amber-400" : "text-indigo-300"}`}>
            {m}:{s}
          </span>
        </div>
      </div>
      {isUrgent && (
        <span className={`text-xs font-medium ${isCritical ? "text-red-400 animate-pulse" : "text-amber-400"}`}>
          {isCritical ? "Wrapping up!" : "1 min left"}
        </span>
      )}
    </div>
  );
}
