"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

const DEFAULT_RADIUS = 18;
const COMPACT_RADIUS = 14;

export default function Timer({
  minutes,
  onEnd,
  compact = false,
}: {
  minutes: number;
  onEnd: () => void;
  compact?: boolean;
}) {
  const totalSeconds = minutes * 60;
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds);
  const radius = compact ? COMPACT_RADIUS : DEFAULT_RADIUS;
  const circumference = 2 * Math.PI * radius;

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
  const dashOffset = circumference * (1 - progress);

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
      className={`rounded-xl border ${compact ? "px-2 py-1" : "px-2 py-1.5 sm:px-2.5 sm:py-2"} ${status.tone} ${isCritical ? "animate-timer-pulse" : ""}`}
      aria-live="polite"
    >
      <div className={`flex items-center ${compact ? "gap-1.5" : "gap-2 sm:gap-2.5"}`}>
        <div className={`relative shrink-0 ${compact ? "h-[32px] w-[32px]" : "h-[40px] w-[40px] sm:h-[44px] sm:w-[44px]"}`}>
          <svg className={`-rotate-90 ${compact ? "h-[32px] w-[32px]" : "h-[40px] w-[40px] sm:h-[44px] sm:w-[44px]"}`} viewBox="0 0 52 52">
            <circle
              cx="26"
              cy="26"
              r={radius}
              fill="none"
              stroke="currentColor"
              className="opacity-10"
              strokeWidth={compact ? 3.5 : 4}
            />
            <circle
              cx="26"
              cy="26"
              r={radius}
              fill="none"
              stroke={status.color}
              strokeWidth={compact ? 3.5 : 4}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{
                transition: "stroke-dashoffset 0.7s linear, stroke 0.35s ease",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`${compact ? "text-[6px]" : "text-[7px] sm:text-[8px]"} font-semibold uppercase tracking-widest text-slate-500`}>
              Time
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <p className={`${compact ? "hidden" : "hidden sm:block"} text-[8px] font-semibold uppercase tracking-widest text-slate-500`}>
            Assessment timer
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={`${compact ? "text-sm" : "text-lg sm:text-xl"} font-semibold tracking-tight tabular-nums`}>
              {minutesLabel}:{secondsLabel}
            </span>
            <span className={`${compact ? "hidden" : "hidden sm:inline-flex"} rounded-full border border-slate-200 bg-slate-100/50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-slate-600`}>
              {status.label}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
