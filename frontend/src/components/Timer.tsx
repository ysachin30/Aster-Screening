"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

const RADIUS = 18;
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
      className={`rounded-xl border px-2.5 py-2 ${status.tone} ${isCritical ? "animate-timer-pulse" : ""}`}
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5">
        <div className="relative h-[44px] w-[44px] shrink-0">
          <svg className="-rotate-90 h-[44px] w-[44px]" viewBox="0 0 52 52">
            <circle
              cx="26"
              cy="26"
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              className="opacity-10"
              strokeWidth="4"
            />
            <circle
              cx="26"
              cy="26"
              r={RADIUS}
              fill="none"
              stroke={status.color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{
                transition: "stroke-dashoffset 0.7s linear, stroke 0.35s ease",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[8px] font-semibold uppercase tracking-widest text-slate-500">
              Time
            </span>
          </div>
        </div>

        <div className="min-w-[6.75rem]">
          <p className="text-[8px] font-semibold uppercase tracking-widest text-slate-500">
            Assessment timer
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="text-xl font-semibold tracking-tight tabular-nums">
              {minutesLabel}:{secondsLabel}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-100/50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-slate-600">
              {status.label}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
