"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

const RADIUS = 28;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function Timer({ minutes, onEnd }: { minutes: number; onEnd: () => void }) {
  const totalSeconds = minutes * 60;
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      onEnd();
      return;
    }

    const timer = window.setTimeout(() => {
      setSecondsRemaining((value) => value - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [secondsRemaining, onEnd]);

  const minutesLabel = Math.floor(secondsRemaining / 60)
    .toString()
    .padStart(2, "0");
  const secondsLabel = (secondsRemaining % 60).toString().padStart(2, "0");
  const progress = secondsRemaining / totalSeconds;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  const status = useMemo(() => {
    if (secondsRemaining <= 30) {
      return {
        label: "Critical",
        hint: "Finalize your response",
        color: "#ef4444",
        tone: "border-red-200 bg-red-50 text-red-900 shadow-sm",
      };
    }

    if (secondsRemaining <= 90) {
      return {
        label: "Warning",
        hint: "Time is running low",
        color: "#f59e0b",
        tone: "border-amber-200 bg-amber-50 text-amber-900 shadow-sm",
      };
    }

    return {
      label: "On track",
      hint: "Assessment in progress",
      color: "#4f46e5",
      tone: "border-slate-200 bg-white text-slate-900 shadow-sm",
    };
  }, [secondsRemaining]);

  const isUrgent = secondsRemaining <= 90;
  const isCritical = secondsRemaining <= 30;

  return (
    <motion.div
      animate={isUrgent ? { y: [0, -1, 0] } : undefined}
      transition={isUrgent ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
      className={`rounded-2xl border px-4 py-3 ${status.tone} ${isCritical ? "animate-timer-pulse" : ""}`}
      aria-live="polite"
    >
      <div className="flex items-center gap-4">
        <div className="relative h-[68px] w-[68px] shrink-0">
          <svg className="-rotate-90 h-[68px] w-[68px]" viewBox="0 0 76 76">
            <circle
              cx="38"
              cy="38"
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              className="opacity-10"
              strokeWidth="5"
            />
            <circle
              cx="38"
              cy="38"
              r={RADIUS}
              fill="none"
              stroke={status.color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{
                transition: "stroke-dashoffset 0.7s linear, stroke 0.35s ease",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Time
            </span>
          </div>
        </div>

        <div className="min-w-[9rem]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Assessment timer
          </p>
          <div className="mt-0.5 flex items-end gap-2">
            <span className="text-3xl font-semibold tracking-tight tabular-nums">
              {minutesLabel}:{secondsLabel}
            </span>
            <span className="mb-1.5 rounded-full border border-slate-200 bg-slate-100/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-600">
              {status.label}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-500">{status.hint}</p>
        </div>
      </div>
    </motion.div>
  );
}
