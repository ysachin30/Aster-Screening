"use client";

import { useEffect, useMemo, useState } from "react";

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

  const status = useMemo(() => {
    if (secondsRemaining <= 30) {
      return {
        label: "Critical",
        color: "#ef4444",
        bg: "bg-red-50 text-red-700 border-red-200",
        ring: "text-red-500",
      };
    }

    if (secondsRemaining <= 90) {
      return {
        label: "Warning",
        color: "#f59e0b",
        bg: "bg-orange-50 text-orange-700 border-orange-200",
        ring: "text-orange-500",
      };
    }

    return {
      label: "On track",
      color: "#3b82f6",
      bg: "bg-slate-50 text-slate-700 border-slate-200",
      ring: "text-blue-500",
    };
  }, [secondsRemaining]);

  const isCritical = secondsRemaining <= 30;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${status.bg} ${isCritical ? "animate-timer-pulse" : ""}`}
      aria-live="polite"
    >
      <div className="flex flex-col">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold tabular-nums">
            {minutesLabel}:{secondsLabel}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
            {status.label}
          </span>
        </div>
      </div>
    </div>
  );
}
