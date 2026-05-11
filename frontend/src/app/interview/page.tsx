"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState, Track, LocalVideoTrack } from "livekit-client";
import Timer from "@/components/Timer";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const LK_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";
const GIF_URL = encodeURI("/q1.gif");
const Q2_THEORY_GIF_URL = encodeURI("/this.gif");
const Q4_BRIDGE_GIF_URL = encodeURI("/thisisbridge.gif");
const Q5_LOGIC_GIF_URL = encodeURI("/smaller-simpler.gif");

type AvatarState = "idle" | "speaking" | "listening" | "thinking" | "ended";

type DualAvatarState = {
  ai: AvatarState;
  human: AvatarState;
};
type TranscriptEntry = { who: "ai" | "user"; text: string; id: number; updatedAt: number };
type QuestionKind = "gif" | "satellite" | "differentiability" | "text";
type Question = {
  id: number;
  kind: QuestionKind;
  question: string;
  context: string;
  hints: string[];
  answer: string;
};

type QuestionInteractionSnapshot = {
  segment_id: string;
  question_id: number;
  part: number;
  question_key: string;
  kind: QuestionKind;
  has_drawing: boolean;
  stroke_count: number;
  total_stroke_points: number;
  draw_mode: boolean;
  context_open: boolean;
  sat_angle: number | null;
  diff_x: number | null;
  updated_at: number;
};

type SegmentActivitySummary = {
  segment_id: string;
  question_key: string;
  started_at_ms: number;
  ended_at_ms: number;
  duration_ms: number;
  student_spoke: boolean;
  student_turns: number;
  ai_turns: number;
  student_speaking_ms: number;
  ai_speaking_ms: number;
  first_response_latency_ms: number | null;
  latest_interaction: QuestionInteractionSnapshot | null;
};

type SegmentDescriptor = {
  segment_id: string;
  question_id: number;
  part: number;
  question_key: string;
  kind: QuestionKind;
  started_at_ms: number;
};

const Q2_PART_1 = "Part 1: How does a satellite orbit a celestial body? Discuss the forces acting on it, specifically their directions.";
const Q2_PART_2 = "Part 2: What path will a satellite follow if its forward velocity suddenly becomes zero?";
const Q2_PART_3 = "Part 3: What path will a satellite follow if the gravitational force acting on it suddenly becomes zero?";
const getQ2PartText = (part: number) => {
  if (part === 1) return Q2_PART_1;
  if (part === 2) return Q2_PART_2;
  return Q2_PART_3;
};

const QUESTIONS: Question[] = [
  {
    id: 1,
    kind: "gif",
    question: "A book is placed on a table and remains at rest. What causes the normal force acting on the book?",
    context:
      "In physics, a force is not just a push or pull — it is the result of an interaction between objects. " +
      "At the most fundamental level, all forces in nature arise from four basic interactions:\n\n" +
      "• Gravitational Force — acts between masses (e.g., Earth pulling objects downward)\n" +
      "• Electromagnetic Force — acts between charged particles; responsible for most everyday forces like contact forces, friction, and rigidity of objects\n" +
      "• Strong Nuclear Force — holds protons and neutrons together inside the nucleus\n" +
      "• Weak Nuclear Force — responsible for certain types of radioactive decay",
    hints: [],
    answer:
      "At the microscopic level, the normal force arises due to electromagnetic interactions between atoms in the two surfaces in contact.\n\n" +
      "When an object (like a book) is placed on a surface:\n" +
      "• The atoms in the object and the surface come very close to each other\n" +
      "• Their electron clouds begin to overlap\n" +
      "• Since electrons have the same charge, they repel each other (electromagnetic force)\n\n" +
      "This repulsion prevents atoms from occupying the same space and produces a force perpendicular to the surface — the normal force.",
  },
  {
    id: 2,
    kind: "satellite",
    question:
      "Part 1: How does a satellite orbit a celestial body? Discuss the forces acting on it, specifically their directions.\n\n"
      + "Part 2: What path will a satellite follow if its forward velocity suddenly becomes zero?\n\n"
      + "Part 3: What path will a satellite follow if the gravitational force acting on it suddenly becomes zero?",
    context:
      "What is a satellite?\n"
      + "A satellite is an object that moves around a larger celestial body due to gravity.\n"
      + "Example: the Moon around Earth, or an artificial satellite around Earth.",
    hints: [],
    answer:
      "Part 1: In a stable orbit, gravity points inward toward the central body (radially inward) and provides centripetal acceleration. The satellite's velocity is tangential (perpendicular to gravity).\n\n"
      + "Part 2: If forward velocity suddenly becomes zero, only gravity acts, so the satellite would move straight toward the central body (along the g axis) and fall inward.\n\n"
      + "Part 3: If gravity suddenly becomes zero, there is no inward force, so the satellite continues in a straight line along its instantaneous velocity direction (along the v axis), tangent to the orbit.",
  },
  {
    id: 3,
    kind: "differentiability",
    question: "If a function is continuous but not differentiable at a point, what does that mean geometrically?",
    context:
      "Continuity at a point means there is no gap or jump — the function passes through that point without breaking. " +
      "Differentiability means the function has a unique, well-defined tangent line at that point.\n\n" +
      "A function can be continuous yet NOT differentiable when it has:\n" +
      "• A sharp corner — the slope changes abruptly (e.g. f(x) = |x| at x = 0)\n" +
      "• A cusp — one-sided slopes both go to ±∞\n" +
      "• A vertical tangent — slope becomes infinite\n\n" +
      "Classic example: f(x) = |x| is continuous everywhere, but at x = 0 the left slope is −1 and the right slope is +1 — they disagree, so no unique tangent exists.",
    hints: [],
    answer:
      "Geometrically, a function that is continuous but not differentiable at a point has NO unique tangent line there.\n\n" +
      "This manifests as:\n" +
      "1. SHARP CORNER — left and right derivatives both exist but differ (e.g. f(x) = |x| at x = 0: left slope = −1, right slope = +1).\n" +
      "2. CUSP — one-sided slopes both diverge to infinity with opposite signs.\n" +
      "3. VERTICAL TANGENT — slope → ∞.\n\n" +
      "Continuity guarantees the graph has no break; non-differentiability means there is a 'kink' — no matter how far you zoom in, the corner never smooths out.",
  },
  {
    id: 4,
    kind: "text",
    question:
      "A cube is painted on all six faces and then cut into 27 equal smaller cubes. How many small cubes will have exactly two painted faces?",
    context:
      "A cube divided into 27 cubes means:\n3×3×3\n\nExactly two painted faces occur on edge cubes excluding corners.",
    hints: [],
    answer:
      "A cube has 12 edges.\n\nFor a 3×3×3 cube, each edge has 3 small cubes. The two end cubes are corners; the middle cube has exactly two painted faces.\n\nThus: 12×1 = 12.\n\nTherefore, 12 small cubes have exactly two painted faces.",
  },
  {
    id: 5,
    kind: "text",
    question:
      "Four people need to cross a bridge at night.\n\n"
      + "Each person walks at a different speed:\n"
      + "A = 1 minute\n"
      + "B = 2 minutes\n"
      + "C = 5 minutes\n"
      + "D = 10 minutes\n\n"
      + "When two people cross together, they move at the slower person's speed.\n\n"
      + "The torch must always be carried during a crossing.\n\n"
      + "What is the minimum total time required for everyone to cross?",
    context: "",
    hints: [],
    answer:
      "PRIVATE RUBRIC (never reveal hints/solution aloud).\n\n"
      + "Hint for evaluator only — It is not always optimal for the fastest person to escort everyone. "
      + "They have one torch, and the bridge can hold at most two people at a time.\n\n"
      + "Optimal solution is 17 minutes:\n"
      + "A + B cross → 2 min\n"
      + "A returns → 1 min\n"
      + "C + D cross → 10 min\n"
      + "B returns → 2 min\n"
      + "A + B cross again → 2 min\n"
      + "Total: 2+1+10+2+2 = 17.",
  },
];

export default function InterviewPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <InterviewPageContent />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#060810]">
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <div className="absolute inset-3 rounded-full border border-indigo-400/10 border-t-indigo-400/40 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
          <div className="absolute inset-0 flex items-center justify-center text-lg">✨</div>
        </div>
        <p className="text-white/30 text-xs tracking-widest uppercase">Preparing Room</p>
      </div>
    </main>
  );
}

function InterviewPageContent() {
  const params = useSearchParams();
  const room = params.get("room") || "";
  const name = params.get("name") || "Student";
  const sid = params.get("sid") || "";
  const [token, setToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [isIntroductionPhase, setIsIntroductionPhase] = useState(true);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (!room) return;
    console.log("[LK] Fetching token", { room, sid, name, backend: BACKEND, lkUrl: LK_URL });
    fetch(`${BACKEND}/api/getToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room,
        identity: sid,
        name,
        questions: QUESTIONS.map(q => ({
          id: q.id,
          kind: q.kind,
          question: q.question,
          context: q.context,
          hints: q.hints,
          answer: q.answer,
        })),
      }),
    })
      .then((r) => {
        console.log("[LK] Token response status", r.status);
        return r.json();
      })
      .then((d) => {
        if (d.token) {
          console.log("[LK] Token received ✓ (first 40 chars):", d.token.slice(0, 40));
        } else {
          console.error("[LK] Token response missing token field", d);
        }
        setToken(d.token);
      })
      .catch((e) => console.error("[LK] Token fetch failed", e));
  }, [room, name, sid]);

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-up">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-400/40 border-t-indigo-400 animate-spin" />
          <p className="text-white/50 text-sm tracking-wide">Preparing your interview room…</p>
        </div>
      </main>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={LK_URL}
      connect
      audio
      video={false}
      data-lk-theme="default"
      className="min-h-screen"
    >
      <RoomAudioRenderer />
      <AudioUnlockGate>
        <InterviewStage 
          name={name} 
          isIntroductionPhase={isIntroductionPhase}
          setIsIntroductionPhase={setIsIntroductionPhase}
          question={QUESTIONS[activeQuestionIdx]}
          frozen={false}
          onCanvasReady={() => {}}
          answeredQuestions={answeredQuestions}
          setActiveQuestionIdx={setActiveQuestionIdx}
          setAnsweredQuestions={setAnsweredQuestions}
          activeQuestionIdx={activeQuestionIdx}
          isFinished={isFinished}
          setIsFinished={setIsFinished}
        />
      </AudioUnlockGate>
    </LiveKitRoom>
  );
}

function AudioUnlockGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [micOk, setMicOk] = useState<boolean | null>(null);

  const unlock = async () => {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) { const ctx = new AC(); await ctx.resume(); ctx.close(); }
    } catch {}
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicOk(true);
    } catch { setMicOk(false); }
    setUnlocked(true);
  };

  if (!unlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center overflow-hidden bg-[#08101d] px-6 text-white">
        <div className="glass w-full max-w-xl rounded-[28px] border border-white/10 p-8 shadow-2xl shadow-black/30">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10">
            <svg className="h-8 w-8 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div className="mt-6 text-center">
            <p className="text-xs uppercase tracking-[0.28em] text-white/35">Interview Setup</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Enable microphone access</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-300">
              Your interviewer starts speaking immediately after the room opens. Allow microphone access so your responses can be heard clearly throughout the session.
            </p>
          </div>

          <div className="mt-6 grid gap-3 rounded-3xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-medium text-white">Best experience</p>
              <p className="mt-1 leading-6 text-white/60">Use headphones or a quiet room to reduce echo and background noise.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-medium text-white">What happens next</p>
              <p className="mt-1 leading-6 text-white/60">The interview enters a focused full-screen layout as soon as the question phase begins.</p>
            </div>
          </div>

          <button
            onClick={unlock}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] hover:shadow-lg hover:shadow-blue-950/30 active:scale-[0.99]"
          >
            Enable Microphone
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {micOk === false && (
        <div
          className="fixed z-40 px-4 py-2.5 rounded-2xl bg-red-500/20 border border-red-400/30 text-red-300 text-[11px] backdrop-blur-xl shadow-lg max-w-[min(calc(100vw-1.5rem),22rem)] text-center left-1/2 -translate-x-1/2 bottom-[max(1rem,env(safe-area-inset-bottom))] lg:bottom-auto lg:top-4"
          role="status"
        >
          ⚠️ Microphone blocked — check browser permissions
        </div>
      )}
      {children}
    </>
  );
}

function VideoConference({ name, isIntroductionPhase, setIsIntroductionPhase }: { 
  name: string; 
  isIntroductionPhase: boolean;
  setIsIntroductionPhase: (value: boolean) => void;
}) {
  return null;
}

function AIAvatar({ state }: { state: AvatarState }) {
  if (state === "speaking") {
    return (
      <div className="relative flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
        {[0, 0.3].map((delay, index) => (
          <div
            key={index}
            className="absolute inset-0 rounded-full border border-indigo-300/40 animate-ripple-out"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-indigo-300/35 bg-gradient-to-br from-indigo-500 to-slate-900 shadow-[0_0_30px_rgba(99,102,241,0.28)] sm:h-24 sm:w-24">
          <div className="flex items-end gap-1">
            {[18, 28, 22, 30, 16].map((height, index) => (
              <span
                key={index}
                className="animate-wave rounded-full bg-white/90"
                style={{ height, width: 4, animationDelay: `${index * 0.08}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state === "thinking") {
    return (
      <div className="relative flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
        <div className="absolute inset-1 rounded-full border border-amber-300/40 animate-spin-slow" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-amber-200/25 bg-gradient-to-br from-slate-800 to-slate-950 sm:h-24 sm:w-24">
          <div className="flex items-center gap-1.5">
            {[0, 0.2, 0.4].map((delay, index) => (
              <span key={index} className="h-2.5 w-2.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: `${delay}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state === "ended") {
    return (
      <div className="relative flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-500/30 bg-slate-900 sm:h-24 sm:w-24">
          <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75h6M12 3.75v2.25m-6 3h12m-9.75 4.5h.008v.008H8.25V13.5zm7.5 0h.008v.008h-.008V13.5zM7.5 19.5h9A2.25 2.25 0 0018.75 17.25v-7.5A2.25 2.25 0 0016.5 7.5h-9A2.25 2.25 0 005.25 9.75v7.5A2.25 2.25 0 007.5 19.5z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
      <div className="absolute inset-2 rounded-full border border-indigo-300/20 animate-glow-breathe" />
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-indigo-300/30 bg-gradient-to-br from-indigo-500 to-slate-900 shadow-[0_0_28px_rgba(79,70,229,0.2)] sm:h-24 sm:w-24">
        <svg className="h-10 w-10 text-indigo-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75h6M12 3.75v2.25m-6 3h12m-9.75 4.5h.008v.008H8.25V13.5zm7.5 0h.008v.008h-.008V13.5zM7.5 19.5h9A2.25 2.25 0 0018.75 17.25v-7.5A2.25 2.25 0 0016.5 7.5h-9A2.25 2.25 0 005.25 9.75v7.5A2.25 2.25 0 007.5 19.5z" />
        </svg>
      </div>
    </div>
  );
}

function HumanAvatar({ state }: { state: AvatarState }) {
  if (state === "speaking") {
    return (
      <div className="relative flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
        {[0, 0.3].map((delay, index) => (
          <div
            key={index}
            className="absolute inset-0 rounded-full border border-sky-300/40 animate-ripple-out"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-sky-300/35 bg-gradient-to-br from-sky-500 to-slate-900 shadow-[0_0_30px_rgba(59,130,246,0.22)] sm:h-24 sm:w-24">
          <div className="flex items-end gap-1">
            {[18, 28, 22, 30, 16].map((height, index) => (
              <span
                key={index}
                className="animate-wave rounded-full bg-white/90"
                style={{ height, width: 4, animationDelay: `${index * 0.08}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state === "ended") {
    return (
      <div className="relative flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-500/30 bg-slate-900 sm:h-24 sm:w-24">
          <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
      <div className="absolute inset-2 rounded-full border border-sky-300/20 animate-glow-breathe" />
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-sky-300/30 bg-gradient-to-br from-sky-500 to-slate-900 shadow-[0_0_28px_rgba(59,130,246,0.18)] sm:h-24 sm:w-24">
        <svg className="h-10 w-10 text-sky-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0" />
        </svg>
      </div>
    </div>
  );
}

function TranscriptView({ entries }: { entries: TranscriptEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8 text-center">
        <div>
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <svg className="h-5 w-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3h6m-8.25 8.25l2.381-2.381A2.25 2.25 0 019.22 16.5H18a2.25 2.25 0 002.25-2.25v-7.5A2.25 2.25 0 0018 4.5H6A2.25 2.25 0 003.75 6.75v7.5A2.25 2.25 0 006 16.5h.75v3z" />
            </svg>
          </div>
          <p className="text-xs text-white/30">Conversation appears here once the question round begins.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
      {entries.map((e) => (
        <div key={e.id} className={`animate-fade-up flex gap-2 ${e.who === "user" ? "flex-row-reverse" : ""}`}>
          <div
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] ${
              e.who === "ai" ? "border-indigo-300/30 bg-indigo-500/15 text-indigo-100" : "border-sky-300/30 bg-sky-500/15 text-sky-100"
            }`}
          >
            {e.who === "ai" ? "AI" : "You"}
          </div>
          <div
            className={`max-w-[84%] rounded-2xl border px-3 py-2 text-xs leading-relaxed ${
              e.who === "ai"
                ? "rounded-tl-sm border-indigo-300/20 bg-indigo-500/10 text-slate-100"
                : "rounded-tr-sm border-sky-300/20 bg-sky-500/10 text-slate-100"
            }`}
          >
            {e.text}
          </div>
        </div>
      ))}
    </div>
  );
}

function normalizeTranscriptText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

function isTranscriptNearDuplicate(nextText: string, prevText: string) {
  const next = normalizeTranscriptText(nextText);
  const prev = normalizeTranscriptText(prevText);
  if (!next || !prev) return false;
  if (next === prev) return true;
  const shorter = next.length <= prev.length ? next : prev;
  const longer = next.length > prev.length ? next : prev;
  if (shorter.length < 18) return false;
  return longer.includes(shorter) && shorter.length / longer.length >= 0.82;
}

// Arrow helper for satellite canvas
function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, label: string) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  // arrowhead
  const ah = 12;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * ah + uy * ah * 0.55, y2 - uy * ah - ux * ah * 0.55);
  ctx.lineTo(x2 - ux * ah - uy * ah * 0.55, y2 - uy * ah + ux * ah * 0.55);
  ctx.closePath();
  ctx.fill();
  // label
  ctx.font = "bold 12px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 4;
  ctx.fillText(label, x2 + ux * 22, y2 + uy * 22);
  ctx.shadowBlur = 0;
}

function QuestionPanel({
  question,
  frozen,
  segmentId,
  onCanvasReady,
  answeredQuestions,
  setActiveQuestionIdx,
  setAnsweredQuestions,
  q2Part,
  setQ2Part,
  onActivitySnapshot,
}: {
  question: Question;
  frozen: boolean;
  segmentId: string;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  answeredQuestions: Set<number>;
  setActiveQuestionIdx: (index: number) => void;
  setAnsweredQuestions: (setter: (prev: Set<number>) => Set<number>) => void;
  q2Part?: number;
  setQ2Part?: React.Dispatch<React.SetStateAction<number>>;
  onActivitySnapshot?: (snapshot: QuestionInteractionSnapshot) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showContext, setShowContext] = useState(false);
  // Satellite state (used only when question.kind === "satellite")
  const [satAngle, setSatAngle] = useState(Math.PI / 2); // start at bottom of orbit (opposite position)
  const [drawMode, setDrawMode] = useState(false);
  // Multiple strokes (needed for Q2 Part 1: draw g and v separately)
  const [strokes, setStrokes] = useState<{ x: number; y: number }[][]>([]);
  // Q3: probe x-position in function space (for differentiability canvas)
  const [diffX, setDiffX] = useState(2.5);
  const draggingRef = useRef(false);
  const drawingRef = useRef(false);

  // Publish the canvas once (on mount). The same canvas is reused across questions.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) onCanvasReady(canvas);
  }, [onCanvasReady]);

  // Redraw whenever relevant state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    // ---------- Q2: interactive satellite — realistic rendering ----------
    if (question.kind === "satellite") {
      const cx = W / 2, cy = H / 2;

      // ── Space background — deep black to near-black ──
      ctx.fillStyle = "#000007";
      ctx.fillRect(0, 0, W, H);

      // Subtle Milky Way band (faint diagonal smear)
      const mw = ctx.createLinearGradient(0, H, W, 0);
      mw.addColorStop(0,   "rgba(180,200,255,0)");
      mw.addColorStop(0.3, "rgba(180,200,255,0.04)");
      mw.addColorStop(0.5, "rgba(200,215,255,0.07)");
      mw.addColorStop(0.7, "rgba(180,200,255,0.04)");
      mw.addColorStop(1,   "rgba(180,200,255,0)");
      ctx.fillStyle = mw;
      ctx.fillRect(0, 0, W, H);

      // Stars — realistic colour temperatures (blue giants, white, yellow dwarfs, orange)
      const starColors = [
        [200,220,255], // hot blue-white
        [255,255,255], // white
        [255,250,230], // pale yellow (sun-like)
        [255,235,180], // yellow-white
        [255,200,130], // orange giant
      ];
      for (let i = 0; i < 500; i++) {
        const x = ((i * 127 + 37) % W);
        const y = ((i * 89  + 13) % H);
        const ci = i % starColors.length;
        const [r, g, b] = starColors[ci];
        const size = i % 40 === 0 ? 2.4 : i % 12 === 0 ? 1.6 : 0.9;
        const alpha = i % 40 === 0 ? 1 : i % 12 === 0 ? 0.85 : 0.55;
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fill();
        // Diffraction spike for the very brightest stars
        if (i % 40 === 0) {
          ctx.strokeStyle = `rgba(${r},${g},${b},0.25)`;
          ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(x - size * 4, y); ctx.lineTo(x + size * 4, y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x, y - size * 4); ctx.lineTo(x, y + size * 4); ctx.stroke();
        }
      }

      const orbitR = Math.min(W, H) * 0.33;
      const earthR = Math.min(W, H) * 0.115;

      // Orbit path — subtle white dashed line (not neon)
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 9]);
      ctx.beginPath();
      ctx.arc(cx, cy, orbitR, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // ── Earth: photorealistic sphere ──
      // Thick atmosphere glow (limb scattering)
      for (let k = 6; k >= 1; k--) {
        const atmoR = earthR + k * 9;
        const ag = ctx.createRadialGradient(cx, cy, earthR * 0.9, cx, cy, atmoR);
        ag.addColorStop(0, `rgba(100,160,255,${0.028 * k})`);
        ag.addColorStop(1, "rgba(60,100,220,0)");
        ctx.fillStyle = ag;
        ctx.beginPath();
        ctx.arc(cx, cy, atmoR, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Deep ocean base — lit from upper-left (sun direction)
      const oceanGrad = ctx.createRadialGradient(
        cx - earthR * 0.5, cy - earthR * 0.45, earthR * 0.05,
        cx + earthR * 0.2, cy + earthR * 0.2, earthR * 1.1
      );
      oceanGrad.addColorStop(0,    "#1a6fa0"); // sunlit ocean
      oceanGrad.addColorStop(0.3,  "#0d4f7a");
      oceanGrad.addColorStop(0.65, "#063050");
      oceanGrad.addColorStop(1,    "#010e1a"); // dark limb
      ctx.fillStyle = oceanGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, earthR, 0, 2 * Math.PI);
      ctx.fill();

      // Land masses — clipped, realistic tones
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, earthR, 0, 2 * Math.PI);
      ctx.clip();

      // Europe + Asia (large brown-green mass, upper-centre)
      ctx.fillStyle = "rgba(110,105,70,0.88)";
      ctx.beginPath();
      ctx.ellipse(cx - earthR * 0.05, cy - earthR * 0.22, earthR * 0.52, earthR * 0.21, 0.15, 0, 2 * Math.PI);
      ctx.fill();
      // add forest tint overlay
      ctx.fillStyle = "rgba(60,90,45,0.35)";
      ctx.beginPath();
      ctx.ellipse(cx - earthR * 0.15, cy - earthR * 0.24, earthR * 0.38, earthR * 0.14, 0.1, 0, 2 * Math.PI);
      ctx.fill();
      // Sahara / Arabia — warm ochre
      ctx.fillStyle = "rgba(190,155,80,0.82)";
      ctx.beginPath();
      ctx.ellipse(cx - earthR * 0.08, cy - earthR * 0.02, earthR * 0.28, earthR * 0.15, 0.3, 0, 2 * Math.PI);
      ctx.fill();
      // Africa
      ctx.fillStyle = "rgba(120,100,55,0.85)";
      ctx.beginPath();
      ctx.ellipse(cx - earthR * 0.12, cy + earthR * 0.22, earthR * 0.22, earthR * 0.28, -0.15, 0, 2 * Math.PI);
      ctx.fill();
      // Americas — western edge
      ctx.fillStyle = "rgba(95,115,60,0.80)";
      ctx.beginPath();
      ctx.ellipse(cx - earthR * 0.68, cy - earthR * 0.05, earthR * 0.18, earthR * 0.38, 0.2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "rgba(110,105,65,0.75)";
      ctx.beginPath();
      ctx.ellipse(cx - earthR * 0.66, cy + earthR * 0.38, earthR * 0.14, earthR * 0.22, -0.1, 0, 2 * Math.PI);
      ctx.fill();
      // Antarctica — white-blue
      ctx.fillStyle = "rgba(215,235,255,0.9)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + earthR * 0.76, earthR * 0.55, earthR * 0.18, 0, 0, 2 * Math.PI);
      ctx.fill();
      // Arctic ice
      ctx.fillStyle = "rgba(200,225,255,0.65)";
      ctx.beginPath();
      ctx.ellipse(cx, cy - earthR * 0.82, earthR * 0.4, earthR * 0.14, 0, 0, 2 * Math.PI);
      ctx.fill();

      // Cloud layer — wispy, semi-transparent
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath();
      ctx.ellipse(cx - earthR * 0.1, cy - earthR * 0.55, earthR * 0.5, earthR * 0.09, 0.15, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.17)";
      ctx.beginPath();
      ctx.ellipse(cx + earthR * 0.3, cy + earthR * 0.05, earthR * 0.4, earthR * 0.08, -0.25, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.beginPath();
      ctx.ellipse(cx - earthR * 0.4, cy + earthR * 0.45, earthR * 0.32, earthR * 0.07, 0.4, 0, 2 * Math.PI);
      ctx.fill();

      // Night-side shadow (terminator) — gradual limb darkening from lower-right
      const terminator = ctx.createRadialGradient(
        cx + earthR * 0.42, cy + earthR * 0.42, earthR * 0.25,
        cx + earthR * 0.42, cy + earthR * 0.42, earthR * 2.0
      );
      terminator.addColorStop(0,   "rgba(0,0,5,0.72)");
      terminator.addColorStop(0.4, "rgba(0,0,5,0.35)");
      terminator.addColorStop(1,   "rgba(0,0,5,0)");
      ctx.fillStyle = terminator;
      ctx.fillRect(cx - earthR, cy - earthR, earthR * 2, earthR * 2);

      // City lights on the night side
      ctx.fillStyle = "rgba(255,220,100,0.45)";
      const cities = [
        [cx - earthR * 0.05, cy + earthR * 0.05], // Europe city cluster
        [cx + earthR * 0.18, cy + earthR * 0.22], // East Asia
        [cx - earthR * 0.55, cy + earthR * 0.18], // East coast Americas
      ];
      for (const [lx, ly] of cities) {
        ctx.beginPath();
        ctx.arc(lx, ly, 2, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.restore();

      // Atmosphere rim highlight (thin blue line on the lit edge)
      ctx.strokeStyle = "rgba(140,190,255,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, earthR + 1, 0, 2 * Math.PI);
      ctx.stroke();

      // Earth label
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = "600 14px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 8;
      ctx.fillText("EARTH", cx, cy + earthR + 10);
      ctx.shadowBlur = 0;

      // ── Satellite position ──
      const sx = cx + orbitR * Math.cos(satAngle);
      const sy = cy + orbitR * Math.sin(satAngle);
      const tx = -Math.sin(satAngle); // tangential unit vector (CCW)
      const ty = Math.cos(satAngle);

      // ── USER STROKES — multiple strokes with neon glow ──
      for (const stroke of strokes) {
        ctx.save();
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        // outer glow
        ctx.strokeStyle = "rgba(0,220,255,0.30)";
        ctx.lineWidth = 12;
        ctx.shadowColor = "#00d4ff";
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
        ctx.stroke();
        // crisp inner line
        ctx.strokeStyle = "#dff8ff";
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
        ctx.stroke();
        ctx.restore();
      }

      if (!hidePresetVectors) {
        // Gravity — magenta (radial inward)
        const gx = cx - sx, gy = cy - sy;
        const glen = Math.hypot(gx, gy) || 1;
        drawArrow(ctx, sx, sy, sx + (gx / glen) * 85, sy + (gy / glen) * 85, "#e040fb", "F_g");
        // Tangential velocity — cyan
        drawArrow(ctx, sx, sy, sx + tx * 95, sy + ty * 95, "#00d4ff", "v");
      }

      // ── Satellite body — metallic box with gold foil & solar panels ──
      ctx.save();
      // Subtle glow
      ctx.shadowColor = "rgba(220,200,120,0.6)";
      // ... (rest of the code remains the same)

      // Bottom-left instruction
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.font = "13px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      // Helper copy — bottom left
      const helper = (() => {
        if (!isQ2) return drawMode ? "Draw the trajectory" : "Drag to explore";
        if (part === 1) return drawMode ? "Draw the force (g) and velocity (v) directions" : "Drag the satellite to set the starting point";
        if (part === 2) return drawMode ? "Draw the path if forward velocity becomes zero" : "Drag the satellite to set the starting point";
        return drawMode ? "Draw the path if gravity becomes zero" : "Drag the satellite to set the starting point";
      })();
      ctx.fillText(helper, 18, H - 18);

      // Legend — clean glass panel
      if (!hidePresetVectors) {
        ctx.fillStyle = "rgba(0,0,8,0.55)";
        ctx.beginPath();
        ctx.roundRect(14, 14, 300, 58, 6);
        ctx.fill();

        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.font = "bold 12px system-ui";
        ctx.fillStyle = "#e040fb";
        ctx.fillText("● F_g  gravitational force  (radial inward)", 24, 24);
        ctx.fillStyle = "#00d4ff";
        ctx.fillText("● v    tangential velocity  (perpendicular)", 24, 43);
      }

      // Mode pill — top right
      const modeLabel = drawMode ? "DRAW MODE" : "DRAG MODE";
      const modeCol = drawMode ? "#00d4ff" : "#e0c060";
      ctx.font = "bold 11px system-ui";
      // ... (rest of the code remains the same)
      const mww = ctx.measureText(modeLabel).width;
      ctx.fillStyle = "rgba(0,0,8,0.65)";
      ctx.beginPath();
      ctx.roundRect(W - mww - 28, 14, mww + 16, 26, 5);
      ctx.fill();
      ctx.strokeStyle = modeCol + "99";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(W - mww - 28, 14, mww + 16, 26, 5);
      ctx.stroke();
      ctx.fillStyle = modeCol;
      ctx.shadowColor = modeCol;
      ctx.shadowBlur = 6;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(modeLabel, W - mww - 20, 27);
      ctx.shadowBlur = 0;
      return;
    }

    // ---------- Q3: interactive differentiability explorer ----------
    if (question.kind === "differentiability") {
      const originCX = W / 2;
      const originCY = H * 0.68; // y-axis origin, lower to show f going up
      const scale = 75;           // px per function unit

      // Coordinate helpers
      const toCX = (fx: number) => originCX + fx * scale;
      const toCY = (fy: number) => originCY - fy * scale;
      const xL = -originCX / scale; // function x at canvas left edge
      const xR = (W - originCX) / scale;

      // ── Background — dark math paper ──
      ctx.fillStyle = "#07070f";
      ctx.fillRect(0, 0, W, H);

      // Grid lines at every integer
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (let xi = Math.ceil(xL); xi <= Math.floor(xR); xi++) {
        ctx.beginPath(); ctx.moveTo(toCX(xi), 0); ctx.lineTo(toCX(xi), H); ctx.stroke();
      }
      const yT = originCY / scale, yB = -(H - originCY) / scale;
      for (let yi = Math.floor(yB); yi <= Math.ceil(yT); yi++) {
        ctx.beginPath(); ctx.moveTo(0, toCY(yi)); ctx.lineTo(W, toCY(yi)); ctx.stroke();
      }

      // ── Axes ──
      ctx.strokeStyle = "rgba(255,255,255,0.30)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, originCY); ctx.lineTo(W, originCY); ctx.stroke(); // x-axis
      ctx.beginPath(); ctx.moveTo(originCX, 0); ctx.lineTo(originCX, H); ctx.stroke(); // y-axis
      // Arrow heads
      ctx.fillStyle = "rgba(255,255,255,0.30)";
      ctx.beginPath(); ctx.moveTo(W - 2, originCY); ctx.lineTo(W - 14, originCY - 5); ctx.lineTo(W - 14, originCY + 5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(originCX, 2); ctx.lineTo(originCX - 5, 14); ctx.lineTo(originCX + 5, 14); ctx.closePath(); ctx.fill();
      // Axis labels
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "italic 14px system-ui";
      ctx.textAlign = "left"; ctx.textBaseline = "bottom";
      ctx.fillText("x", W - 8, originCY - 4);
      ctx.textAlign = "right"; ctx.textBaseline = "top";
      ctx.fillText("y", originCX - 6, 6);
      // Tick marks and integer labels
      ctx.font = "11px system-ui";
      for (let xi = Math.ceil(xL) + 1; xi < Math.floor(xR); xi++) {
        if (xi === 0) continue;
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(toCX(xi), originCY - 5); ctx.lineTo(toCX(xi), originCY + 5); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(String(xi), toCX(xi), originCY + 7);
      }
      for (let yi = 1; yi <= Math.ceil(yT); yi++) {
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(originCX - 5, toCY(yi)); ctx.lineTo(originCX + 5, toCY(yi)); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.fillText(String(yi), originCX - 8, toCY(yi));
      }
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.textAlign = "right"; ctx.textBaseline = "top";
      ctx.fillText("0", originCX - 6, originCY + 4);

      // ── Plot f(x) = |x| ──
      ctx.save();
      ctx.shadowColor = "#00d4ff";
      ctx.shadowBlur = 16;
      ctx.strokeStyle = "#00d4ff";
      ctx.lineWidth = 3.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(0, toCY(-xL));       // left edge: f(xL) = |xL| = -xL
      ctx.lineTo(originCX, originCY); // origin: f(0) = 0
      ctx.lineTo(W, toCY(xR));        // right edge: f(xR) = xR
      ctx.stroke();
      ctx.restore();

      // ── Function label ──
      ctx.fillStyle = "#00d4ff";
      ctx.font = "bold italic 16px system-ui";
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.shadowColor = "#00d4ff"; ctx.shadowBlur = 8;
      ctx.fillText("f(x) = |x|", toCX(4.5), toCY(5.5));
      ctx.shadowBlur = 0;

      // Probe state
      const clampedDX = Math.max(-7, Math.min(7, diffX));
      const probeY = Math.abs(clampedDX);
      const pcx = toCX(clampedDX), pcy = toCY(probeY);
      const atCorner = Math.abs(clampedDX) < 0.22;
      const slope = clampedDX >= 0 ? 1 : -1;

      // ── Tangent line(s) ──
      const drawTangent = (x0: number, y0: number, m: number, color: string, dashed = false) => {
        const yLeft  = y0 + m * (xL - x0);
        const yRight = y0 + m * (xR - x0);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        if (dashed) ctx.setLineDash([9, 7]);
        ctx.beginPath();
        ctx.moveTo(0, toCY(yLeft));
        ctx.lineTo(W, toCY(yRight));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      };

      if (atCorner) {
        drawTangent(0, 0, -1, "#e040fb", true); // left approach: slope -1
        drawTangent(0, 0, +1, "#00d4ff", true); // right approach: slope +1
      } else {
        drawTangent(clampedDX, probeY, slope, "#f0c040", true); // single smooth tangent
      }

      // ── Corner marker at (0,0) ──
      ctx.save();
      ctx.shadowColor = "#e040fb";
      ctx.shadowBlur = 26;
      ctx.fillStyle = "#e040fb";
      ctx.beginPath(); ctx.arc(originCX, originCY, 8, 0, 2 * Math.PI); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(originCX, originCY, 3.5, 0, 2 * Math.PI); ctx.fill();
      ctx.restore();

      // Corner label
      ctx.save();
      ctx.font = "bold 12px system-ui";
      ctx.fillStyle = "#e040fb";
      ctx.shadowColor = "#e040fb"; ctx.shadowBlur = 7;
      ctx.textAlign = "left"; ctx.textBaseline = "bottom";
      ctx.fillText("x = 0  (corner)", originCX + 10, originCY - 12);
      ctx.restore();

      // ── Probe point ──
      ctx.save();
      ctx.shadowColor = atCorner ? "#e040fb" : "#f0c040";
      ctx.shadowBlur = 22;
      ctx.fillStyle = atCorner ? "#e040fb" : "#f0c040";
      ctx.beginPath(); ctx.arc(pcx, pcy, 10, 0, 2 * Math.PI); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(pcx, pcy, 4, 0, 2 * Math.PI); ctx.fill();
      ctx.restore();

      // Probe label
      ctx.save();
      ctx.font = "bold 12px system-ui";
      ctx.textBaseline = "bottom";
      if (atCorner) {
        ctx.fillStyle = "#e040fb";
        ctx.shadowColor = "#e040fb"; ctx.shadowBlur = 8;
        ctx.textAlign = "center";
        ctx.fillText("← slope = −1  |  slope = +1 →", pcx, pcy - 16);
      } else {
        ctx.fillStyle = "#f0c040";
        ctx.fillText(`x = ${clampedDX.toFixed(2)} — smooth & differentiable`, pcx, pcy - 14);
        ctx.font = "11px system-ui";
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillText(`Unique tangent: slope = ${slope > 0 ? "+1" : "−1"}.  Drag toward x = 0 to see the corner!`, pcx, pcy - 10);
      }
      ctx.shadowBlur = 0;
      ctx.restore();

      // ── Info panel top-left ──
      ctx.fillStyle = "rgba(0,0,8,0.68)";
      ctx.beginPath(); ctx.roundRect(14, 14, 330, 74, 6); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(14, 14, 330, 74, 6); ctx.stroke();
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.font = "bold 14px system-ui";
      ctx.fillStyle = "#00d4ff";
      ctx.fillText("f(x) = |x|", 24, 22);
      ctx.font = "12px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText("✔  Continuous at x = 0  (no gap or jump)", 24, 42);
      ctx.fillStyle = "#e040fb";
      ctx.fillText("✖  Not differentiable at x = 0  (sharp corner)", 24, 60);

      // ── Status box top-right ──
      const sw = 370, sh = 52;
      const sx = W - sw - 14, sy = 14;
      ctx.fillStyle = "rgba(0,0,8,0.68)";
      ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 6); ctx.fill();
      ctx.strokeStyle = atCorner ? "rgba(224,64,251,0.4)" : "rgba(240,192,64,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 6); ctx.stroke();
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.font = "bold 12px system-ui";
      if (atCorner) {
        ctx.fillStyle = "#e040fb";
        ctx.shadowColor = "#e040fb"; ctx.shadowBlur = 5;
        ctx.fillText("⚠  x = 0 — NO unique tangent line!", sx + 12, sy + 10);
        ctx.shadowBlur = 0;
        ctx.font = "11px system-ui";
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillText("Left slope = −1 ≠ Right slope = +1  →  not differentiable here", sx + 12, sy + 30);
      } else {
        ctx.fillStyle = "#f0c040";
        ctx.fillText(`x = ${clampedDX.toFixed(2)} — smooth & differentiable`, sx + 12, sy + 10);
        ctx.font = "11px system-ui";
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillText(`Unique tangent: slope = ${slope > 0 ? "+1" : "−1"}.  Drag toward x = 0 to see the corner!`, sx + 12, sy + 30);
      }

      // ── Bottom instruction ──
      ctx.fillStyle = "rgba(255,255,255,0.42)";
      ctx.font = "13px system-ui";
      ctx.textAlign = "left"; ctx.textBaseline = "bottom";
      ctx.fillText("🖱️  Drag the point along the curve — watch how the tangent behaves near x = 0", 18, H - 18);

      return;
    }

    // ---------- Q1 (and any other text-kind): render question text to the hidden canvas ----------
    const wrap = (text: string, max: number) => {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (ctx.measureText(test).width > max) { lines.push(line); line = w; }
        else line = test;
      }
      if (line) lines.push(line);
      return lines;
    };
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#0a0612";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ec4899";
    ctx.font = "bold 14px system-ui";
    ctx.fillText(`QUESTION ${question.id}`, 24, 32);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px system-ui";
    const qLines = wrap(question.question, W - 48);
    qLines.forEach((l, i) => ctx.fillText(l, 24, 60 + i * 26));
    let y = 60 + qLines.length * 26 + 20;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px system-ui";
    const ctxLines = wrap(question.context, W - 48);
    ctxLines.slice(0, 10).forEach((l, i) => ctx.fillText(l, 24, y + i * 18));
    y += Math.min(ctxLines.length, 10) * 18 + 16;
  }, [question, satAngle, drawMode, strokes, diffX]);

  // Convert a pointer event to canvas-space coords
  const pointerToCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (frozen) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const p = pointerToCanvas(e);
    if (question.kind === "satellite") {
      if (drawMode) {
        drawingRef.current = true;
        setStrokes(prev => [...prev, [p]]);
      } else {
        draggingRef.current = true;
        const canvas = canvasRef.current!;
        setSatAngle(Math.atan2(p.y - canvas.height / 2, p.x - canvas.width / 2));
      }
    } else if (question.kind === "differentiability") {
      draggingRef.current = true;
      const canvas = canvasRef.current!;
      const scale = 75;
      const originCX = canvas.width / 2;
      setDiffX(Math.max(-7, Math.min(7, (p.x - originCX) / scale)));
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (frozen) return;
    const p = pointerToCanvas(e);
    if (question.kind === "satellite") {
      if (drawingRef.current) {
        setStrokes(prev => {
          if (prev.length === 0) return [[p]];
          const next = [...prev];
          next[next.length - 1] = [...next[next.length - 1], p];
          return next;
        });
      } else if (draggingRef.current) {
        const canvas = canvasRef.current!;
        setSatAngle(Math.atan2(p.y - canvas.height / 2, p.x - canvas.width / 2));
      }
    } else if (question.kind === "differentiability" && draggingRef.current) {
      const canvas = canvasRef.current!;
      const scale = 75;
      const originCX = canvas.width / 2;
      setDiffX(Math.max(-7, Math.min(7, (p.x - originCX) / scale)));
    }
  };

  const onPointerUp = () => {
    draggingRef.current = false;
    drawingRef.current = false;
  };

  const clearStroke = () => setStrokes([]);
  const toggleDrawMode = () => setDrawMode(d => !d);

  const isSatellite = question.kind === "satellite";
  const isDiff = question.kind === "differentiability";
  const isQ2 = question.id === 2;
  const isQ4BridgeGif = question.id === 4;
  const isQ5LogicGif = question.id === 5;
  const part = q2Part ?? 1;
  const isQ2TheoryPart = isQ2 && part === 1;
  const isSatelliteInteractive = isSatellite && !isQ2TheoryPart;
  const isInteractive = isSatelliteInteractive || isDiff;
  const displayedQuestion = isQ2 ? getQ2PartText(part) : question.question;
  const hidePresetVectors = isQ2;
  const canAdvanceQ2Part = part === 1 ? true : strokes.length > 0;

  useEffect(() => {
    onActivitySnapshot?.({
      segment_id: segmentId,
      question_id: question.id,
      part,
      question_key: `Q${question.id}${part > 0 && question.id === 2 ? `-P${part}` : ""}`,
      kind: question.kind,
      has_drawing: strokes.length > 0,
      stroke_count: strokes.length,
      total_stroke_points: strokes.reduce((sum, stroke) => sum + stroke.length, 0),
      draw_mode: drawMode,
      context_open: showContext,
      sat_angle: isSatellite ? satAngle : null,
      diff_x: isDiff ? diffX : null,
      updated_at: Date.now(),
    });
  }, [segmentId, question.id, question.kind, part, strokes, drawMode, showContext, satAngle, diffX, isSatellite, isDiff, onActivitySnapshot]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      {/* Question card */}
      <div className="shrink-0 rounded-[24px] border border-white/10 bg-slate-950/70 px-4 py-4 shadow-lg shadow-black/20 sm:px-5">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-100">
                Question {question.id}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/50">
                {question.kind === "differentiability"
                  ? "Mathematics"
                  : question.id === 5
                    ? "Logic puzzle"
                    : "Physics"}
              </span>
              {isInteractive && (
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-100">
                  Interactive board
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold leading-7 text-white sm:text-base sm:leading-8 whitespace-pre-line break-words">
              {displayedQuestion}
            </h3>
          </div>
          <button
            onClick={() => setShowContext(!showContext)}
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/70 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            {showContext ? "Hide notes" : "Show notes"}
          </button>
        </div>
        {showContext && (
          <div className="animate-fade-up mt-3 max-h-28 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/35">Reference context</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-300">{question.context}</p>
          </div>
        )}
      </div>

      {/* Canvas / media area — guaranteed visible region on small screens (nothing may overlay this column) */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[24px] border border-white/10 bg-[#020817] max-lg:min-h-[min(48svh,360px)] max-lg:flex-shrink-0">
        {/* Persistent canvas — streams to AI. Visible for satellite, hidden for gif */}
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={
            isSatelliteInteractive
              ? `w-full h-full touch-none ${drawMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`
              : isDiff
                ? "w-full h-full touch-none cursor-grab active:cursor-grabbing"
                : "hidden"
          }
        />

        {/* Floating Erase button when satellite + has a stroke */}
        {isSatelliteInteractive && strokes.length > 0 && (
          <button
            onClick={clearStroke}
            disabled={frozen}
            className="absolute right-3 top-3 rounded-xl border border-white/15 bg-slate-950/85 px-3 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur-md transition-all hover:border-white/30 hover:bg-slate-900 disabled:opacity-40"
          >
            Clear drawing
          </button>
        )}

        {/* Non-interactive visuals */}
        {!isInteractive && (
          <>
            {question.kind === "gif" ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.12),transparent_40%),linear-gradient(180deg,#07111f_0%,#020817_100%)]" />
                <img src={GIF_URL} alt="visual cue" className="absolute inset-0 h-full w-full object-contain p-4 sm:p-6 lg:p-8" />
              </>
            ) : isQ2TheoryPart ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.12),transparent_40%),linear-gradient(180deg,#07111f_0%,#020817_100%)]" />
                <img src={Q2_THEORY_GIF_URL} alt="Q2 part 1 theory visual" className="absolute inset-0 h-full w-full object-contain p-4 sm:p-6 lg:p-8" />
              </>
            ) : isQ4BridgeGif ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.12),transparent_40%),linear-gradient(180deg,#07111f_0%,#020817_100%)]" />
                <img src={Q4_BRIDGE_GIF_URL} alt="Bridge puzzle visual" className="absolute inset-0 h-full w-full object-contain p-4 sm:p-6 lg:p-8" />
              </>
            ) : isQ5LogicGif ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.12),transparent_40%),linear-gradient(180deg,#07111f_0%,#020817_100%)]" />
                <img src={Q5_LOGIC_GIF_URL} alt="Logic puzzle visual" className="absolute inset-0 h-full w-full object-contain p-4 sm:p-6 lg:p-8" />
              </>
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.12),transparent_40%),linear-gradient(180deg,#07111f_0%,#020817_100%)]">
                <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-10">
                  <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-slate-950/70 p-6 shadow-xl shadow-black/25 sm:p-8">
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/40">Visual thinking prompt</div>
                    <div className="mt-3 text-sm leading-7 text-slate-300">
                      Read the prompt carefully, explain your reasoning aloud, and continue when you are ready.
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/65">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Visual prompt</span>
                <span>Observe carefully and explain your reasoning clearly.</span>
              </div>
            </div>
          </>
        )}

      </div>

      {/* Action buttons */}
      {isSatelliteInteractive && (
        <div className="shrink-0">
          <button
            onClick={toggleDrawMode}
            disabled={frozen}
            className={`w-full rounded-2xl border py-3 text-sm font-semibold transition-all disabled:opacity-40 hover:scale-[1.01] active:scale-[0.99] ${
              drawMode
                ? "border-blue-400/40 bg-blue-500/15 text-blue-100 shadow-sm shadow-blue-500/20"
                : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"
            }`}
          >
            {drawMode ? "Drawing mode active. Tap again to return to drag mode." : "Switch to drawing mode"}
          </button>
        </div>
      )}

      {/* Q2 part navigation */}
      {isSatellite && isQ2 && typeof setQ2Part === "function" && part < 3 && (
        <button
          onClick={() => {
            clearStroke();
            setShowContext(false);
            setDrawMode(false);
            setQ2Part(p => Math.min(3, p + 1));
          }}
          disabled={frozen || !canAdvanceQ2Part}
          className="w-full rounded-2xl border border-blue-400/30 bg-gradient-to-r from-blue-600/20 to-indigo-600/25 py-3 text-sm font-semibold text-blue-100 transition-all hover:scale-[1.01] hover:from-blue-600/30 hover:to-indigo-600/35 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {canAdvanceQ2Part ? "Continue to next part" : "Complete the drawing to continue"}
        </button>
      )}
    </div>
  );
}

function InterviewStage({ name, isIntroductionPhase, setIsIntroductionPhase, question, frozen, onCanvasReady, answeredQuestions, setActiveQuestionIdx, setAnsweredQuestions, activeQuestionIdx, isFinished, setIsFinished }: { 
  name: string; 
  isIntroductionPhase: boolean;
  setIsIntroductionPhase: (value: boolean) => void;
  question: Question;
  frozen: boolean;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  answeredQuestions: Set<number>;
  setActiveQuestionIdx: (index: number) => void;
  setAnsweredQuestions: (setter: (prev: Set<number>) => Set<number>) => void;
  activeQuestionIdx: number;
  isFinished: boolean;
  setIsFinished: (v: boolean) => void;
}) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [ended, setEnded] = useState(false);
  const [avatarState, setAvatarState] = useState<DualAvatarState>({ ai: "idle", human: "idle" });
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const transcriptIdRef = useRef(0);
  const inProgressRef = useRef<Map<string, number>>(new Map());
  const pendingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const publishedRef = useRef(false);
  const lastAutoAnnounceRef = useRef<string>("");
  const fullscreenAttemptedRef = useRef(false);
  /** When intro→question transition fires; drop late user STT from intro for 2.5s */
  const introEndedAtRef = useRef<number>(0);
  const prevSpeakerRef = useRef<"none" | "ai" | "user">("none");
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);

  const [q2Part, setQ2Part] = useState(1);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const activeRecordingKeyRef = useRef<string | null>(null);
  const currentSegmentRef = useRef<SegmentDescriptor | null>(null);
  const flushedSegmentKeysRef = useRef<Set<string>>(new Set());
  const segmentInteractionRef = useRef<Map<string, QuestionInteractionSnapshot | null>>(new Map());
  const segmentMetricsRef = useRef<{
    started_at_ms: number;
    user_turns: number;
    ai_turns: number;
    student_speaking_ms: number;
    ai_speaking_ms: number;
    student_active_since: number | null;
    ai_active_since: number | null;
    first_response_latency_ms: number | null;
    student_spoke: boolean;
  }>({
    started_at_ms: Date.now(),
    user_turns: 0,
    ai_turns: 0,
    student_speaking_ms: 0,
    ai_speaking_ms: 0,
    student_active_since: null,
    ai_active_since: null,
    first_response_latency_ms: null,
    student_spoke: false,
  });
  const earlyClosePattern = /\b(thank you|thanks for your time|get back to you soon|interview (is )?complete|final summary|no more questions|do you have any questions for me|we have completed the questions|completed the questions|pleasure speaking with you|it was a pleasure speaking with you)\b/i;
  const englishLike = useCallback((text: string) => {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (!cleaned) return false;
    const latinMatches = cleaned.match(/[A-Za-z]/g) ?? [];
    const alphaMatches = cleaned.match(/[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/g) ?? [];
    if (alphaMatches.length === 0) return false;
    return latinMatches.length / alphaMatches.length >= 0.65;
  }, []);
  const shouldDropAiTranscriptLine = useCallback((text: string) => {
    const t = text.toLowerCase().replace(/\s+/g, " ").trim();
    if (!t) return true;
    if (
      t.includes("great! now let's move to the first question") ||
      t.includes("let's move to the first question") ||
      t.includes("move to the first question") ||
      t.startsWith("this is question 1")
    ) return true;
    if (!isFinished && earlyClosePattern.test(t)) return true;
    return false;
  }, [isFinished]);

  const requestFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (typeof root.requestFullscreen !== "function") return;
    try {
      if (!document.fullscreenElement) {
        await root.requestFullscreen();
      }
    } catch (error) {
      console.debug("Fullscreen request skipped", error);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch (error) {
      console.debug("Fullscreen exit skipped", error);
    }
  }, []);

  useEffect(() => {
    if (question.id !== 2) setQ2Part(1);
  }, [question.id]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    setFullscreenSupported(typeof document.documentElement.requestFullscreen === "function");
    syncFullscreen();
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    if (isIntroductionPhase || fullscreenAttemptedRef.current) return;
    fullscreenAttemptedRef.current = true;
    void requestFullscreen();
  }, [isIntroductionPhase, requestFullscreen]);

  const buildSegmentDescriptor = useCallback((q: Question, partOverride?: number): SegmentDescriptor => {
    const resolvedPart = q.id === 2 ? (partOverride ?? 1) : 0;
    const questionKey = `Q${q.id}${resolvedPart > 0 ? `-P${resolvedPart}` : ""}`;
    return {
      segment_id: questionKey,
      question_id: q.id,
      part: resolvedPart,
      question_key: questionKey,
      kind: q.kind,
      started_at_ms: Date.now(),
    };
  }, []);

  const resetSegmentMetrics = useCallback((startedAtMs: number) => {
    segmentMetricsRef.current = {
      started_at_ms: startedAtMs,
      user_turns: 0,
      ai_turns: 0,
      student_speaking_ms: 0,
      ai_speaking_ms: 0,
      student_active_since: null,
      ai_active_since: null,
      first_response_latency_ms: null,
      student_spoke: false,
    };
  }, []);

  const encodeBlobBase64 = useCallback((blob: Blob) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const commaIdx = result.indexOf(",");
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }, []);

  const ensureRecordingStream = useCallback(async () => {
    if (mediaStreamRef.current) return mediaStreamRef.current;
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      return mediaStreamRef.current;
    } catch (e) {
      console.warn("[audio-fallback] mic stream unavailable", e);
      return null;
    }
  }, []);

  const startSegmentRecording = useCallback(async (segment: SegmentDescriptor) => {
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return;
    const stream = await ensureRecordingStream();
    if (!stream) return;
    try {
      const preferredMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const mimeType = preferredMimeTypes.find((candidate) => {
        try {
          return MediaRecorder.isTypeSupported(candidate);
        } catch {
          return false;
        }
      });
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) mediaChunksRef.current.push(event.data);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      activeRecordingKeyRef.current = segment.segment_id;
    } catch (e) {
      console.warn("[audio-fallback] recorder start failed", e);
    }
  }, [ensureRecordingStream]);

  const stopSegmentRecording = useCallback(async (segmentId: string) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || activeRecordingKeyRef.current !== segmentId) return null;
    if (recorder.state === "inactive") {
      const blob = mediaChunksRef.current.length ? new Blob(mediaChunksRef.current, { type: recorder.mimeType || "audio/webm" }) : null;
      mediaRecorderRef.current = null;
      activeRecordingKeyRef.current = null;
      mediaChunksRef.current = [];
      return blob;
    }
    return await new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const blob = mediaChunksRef.current.length ? new Blob(mediaChunksRef.current, { type: recorder.mimeType || "audio/webm" }) : null;
        mediaRecorderRef.current = null;
        activeRecordingKeyRef.current = null;
        mediaChunksRef.current = [];
        resolve(blob);
      };
      recorder.stop();
    });
  }, []);

  const buildSegmentActivitySummary = useCallback((segment: SegmentDescriptor, endedAtMs: number): SegmentActivitySummary => {
    const metrics = segmentMetricsRef.current;
    const current = { ...metrics };
    if (current.student_active_since !== null) {
      current.student_speaking_ms += Math.max(0, endedAtMs - current.student_active_since);
      current.student_active_since = null;
    }
    if (current.ai_active_since !== null) {
      current.ai_speaking_ms += Math.max(0, endedAtMs - current.ai_active_since);
      current.ai_active_since = null;
    }
    segmentMetricsRef.current = current;
    return {
      segment_id: segment.segment_id,
      question_key: segment.question_key,
      started_at_ms: current.started_at_ms,
      ended_at_ms: endedAtMs,
      duration_ms: Math.max(0, endedAtMs - current.started_at_ms),
      student_spoke: current.student_spoke,
      student_turns: current.user_turns,
      ai_turns: current.ai_turns,
      student_speaking_ms: current.student_speaking_ms,
      ai_speaking_ms: current.ai_speaking_ms,
      first_response_latency_ms: current.first_response_latency_ms,
      latest_interaction: segmentInteractionRef.current.get(segment.segment_id) ?? null,
    };
  }, []);

  const uploadSegmentArtifact = useCallback(async (
    segment: SegmentDescriptor,
    reason: string,
    activitySummary?: SegmentActivitySummary,
    blobPromise?: Promise<Blob | null>,
  ) => {
    if (!activitySummary && flushedSegmentKeysRef.current.has(segment.segment_id)) return;
    if (!activitySummary) {
      flushedSegmentKeysRef.current.add(segment.segment_id);
    }
    const endedAtMs = Date.now();
    const summary = activitySummary ?? buildSegmentActivitySummary(segment, endedAtMs);
    const blob = blobPromise ? await blobPromise : await stopSegmentRecording(segment.segment_id);
    let audio_base64: string | undefined;
    let audio_mime_type: string | undefined;
    if (blob && blob.size > 0) {
      try {
        audio_base64 = await encodeBlobBase64(blob);
        audio_mime_type = blob.type || "audio/webm";
      } catch (e) {
        console.warn("[audio-fallback] blob encode failed", e);
      }
    }
    try {
      await fetch(`${BACKEND}/api/question-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: room.localParticipant.identity,
          room: room.name,
          question_id: segment.question_id,
          part: segment.part,
          question_key: segment.question_key,
          status: "artifact_ready",
          grading_mode: audio_base64 ? "artifact_ready" : "artifact_ready_no_audio",
          needs_review: false,
          activity_json: {
            ...summary,
            reason,
            question_kind: segment.kind,
            audio_available: Boolean(audio_base64),
          },
          audio_mime_type,
          audio_base64,
        }),
      });
    } catch (e) {
      console.warn("[audio-fallback] artifact upload failed", e);
      flushedSegmentKeysRef.current.delete(segment.segment_id);
      return;
    }
    segmentInteractionRef.current.delete(segment.segment_id);
  }, [buildSegmentActivitySummary, encodeBlobBase64, room.localParticipant.identity, room.name, stopSegmentRecording]);

  const freezeSegmentForUpload = useCallback((segment: SegmentDescriptor, reason: string) => {
    if (flushedSegmentKeysRef.current.has(segment.segment_id)) return null;
    flushedSegmentKeysRef.current.add(segment.segment_id);
    const endedAtMs = Date.now();
    const activitySummary = buildSegmentActivitySummary(segment, endedAtMs);
    return {
      segment,
      reason,
      activitySummary,
      blobPromise: stopSegmentRecording(segment.segment_id),
    };
  }, [buildSegmentActivitySummary, stopSegmentRecording]);

  const publishQuestionChanged = useCallback((nextIdx: number, nextQ: Question, extra?: Record<string, unknown>) => {
    const eventId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      type: "question_changed",
      code: nextIdx,
      questionId: nextQ.id,
      question: nextQ.id === 2 ? getQ2PartText((extra?.part as number) || 1) : nextQ.question,
      kind: nextQ.kind,
      context: nextQ.context,
      eventId,
      ...(extra || {}),
    };

    const sendOnce = async (attempt: number) => {
      const payloadWithAttempt = {
        ...payload,
        sentAt: Date.now(),
        attempt,
      };
      try {
        room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(payloadWithAttempt)), { reliable: true });
        console.log("[LK] question_changed published", {
          nextId: nextQ.id,
          kind: nextQ.kind,
          code: nextIdx,
          part: (extra as any)?.part,
          attempt,
        });
      } catch (e) { console.warn("[LK] publishData failed", e); }
      try {
        await fetch(`${BACKEND}/api/question-changed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room: room.name, payload: payloadWithAttempt }),
        });
      } catch (e) {
        console.warn("[relay] question_changed failed", e);
      }
    };

    // Fire immediately, then retry in 1s and 2s.
    [0, 1000, 2000].forEach((ms, idx) => {
      setTimeout(() => {
        void sendOnce(idx + 1);
      }, ms);
    });
  }, [room.localParticipant, room.name]);

  const publishFinish = useCallback((payload: Record<string, unknown>) => {
    const sendOnce = async (attempt: number) => {
      try {
        room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(payload)), { reliable: true });
        console.log("[LK] finish published", { attempt });
      } catch (e) { console.warn("[LK] finish publishData failed", e); }
      try {
        await fetch(`${BACKEND}/api/question-changed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room: room.name, payload }),
        });
      } catch (e) {
        console.warn("[relay] finish failed", e);
      }
    };
    [0, 1000, 2000].forEach((ms, idx) => {
      setTimeout(() => {
        void sendOnce(idx + 1);
      }, ms);
    });
  }, [room.localParticipant, room.name]);

  const upsertTranscript = useCallback((who: "ai" | "user", text: string, segId: string, isFinal: boolean) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (/\[system\]/i.test(text)) return;
    const now = Date.now();
    const existingEntryId = inProgressRef.current.get(segId);
    if (existingEntryId !== undefined) {
      setTranscript(prev => prev.map(e => e.id === existingEntryId ? { ...e, text: trimmed, updatedAt: now } : e));
      if (isFinal) inProgressRef.current.delete(segId);
    } else {
      const newId = ++transcriptIdRef.current;
      setTranscript(prev => {
        const recentSameSpeaker = [...prev].reverse().filter((entry) => entry.who === who).slice(0, 4);
        const duplicate = recentSameSpeaker.find((entry) =>
          now - entry.updatedAt < 12000 && isTranscriptNearDuplicate(trimmed, entry.text),
        );
        if (duplicate) {
          if (trimmed.length > duplicate.text.length + 6) {
            return prev.map((entry) => entry.id === duplicate.id ? { ...entry, text: trimmed, updatedAt: now } : entry);
          }
          return prev;
        }
        inProgressRef.current.set(segId, newId);
        return [...prev.slice(-60), { who, text: trimmed, id: newId, updatedAt: now }];
      });
      if (isFinal) inProgressRef.current.delete(segId);
    }
  }, []);

  const doPublish = useCallback(async (canvas: HTMLCanvasElement) => {
    if (publishedRef.current) return;
    publishedRef.current = true;
    try {
      const stream = canvas.captureStream(15);
      const [videoTrack] = stream.getVideoTracks();
      if (!videoTrack) return;
      const lkTrack = new LocalVideoTrack(videoTrack, { name: "playground" } as any);
      await localParticipant.publishTrack(lkTrack, { name: "playground", source: Track.Source.ScreenShare, simulcast: false });
      console.log("[LK] Playground track published ✓");
    } catch (e) {
      publishedRef.current = false;
      console.error("[LK] Playground publish failed:", e);
    }
  }, [localParticipant]);

  useEffect(() => {
    const onStateChange = () => {
      if (room.state === ConnectionState.Connected && pendingCanvasRef.current) doPublish(pendingCanvasRef.current);
    };

    const onActiveSpeakers = (speakers: any[]) => {
      if (ended) return;
      const now = Date.now();
      const metrics = segmentMetricsRef.current;
      const aiTalking = speakers.some((p: any) => String(p.identity).startsWith("agent-"));
      const userTalking = speakers.some((p: any) => p.identity === room.localParticipant.identity);
      if (!isIntroductionPhase) {
        if (userTalking && metrics.student_active_since === null) {
          metrics.student_active_since = now;
          metrics.student_spoke = true;
          if (metrics.first_response_latency_ms === null) {
            metrics.first_response_latency_ms = Math.max(0, now - metrics.started_at_ms);
          }
        } else if (!userTalking && metrics.student_active_since !== null) {
          metrics.student_speaking_ms += Math.max(0, now - metrics.student_active_since);
          metrics.student_active_since = null;
        }

        if (aiTalking && metrics.ai_active_since === null) {
          metrics.ai_active_since = now;
        } else if (!aiTalking && metrics.ai_active_since !== null) {
          metrics.ai_speaking_ms += Math.max(0, now - metrics.ai_active_since);
          metrics.ai_active_since = null;
        }
      }
      if (aiTalking) {
        if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current);
        setAvatarState({ ai: "speaking", human: "idle" });
        prevSpeakerRef.current = "ai";
      } else if (userTalking) {
        if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current);
        setAvatarState({ ai: "idle", human: "speaking" });
        prevSpeakerRef.current = "user";
      } else {
        if (prevSpeakerRef.current === "user") {
          setAvatarState({ ai: "thinking", human: "idle" });
          thinkingTimerRef.current = setTimeout(() => setAvatarState({ ai: "idle", human: "idle" }), 6000);
        } else {
          setAvatarState({ ai: "idle", human: "idle" });
        }
        prevSpeakerRef.current = "none";
      }
    };

    const onTranscriptionReceived = (segments: any[], participant: any) => {
      for (const seg of segments) {
        const text = seg.text ?? seg;
        if (!text) continue;
        const who: "ai" | "user" = String(participant?.identity ?? "").startsWith("agent-") ? "ai" : "user";
        const segId = seg.id ?? `${who}-${seg.firstReceivedTime ?? Date.now()}`;
        const isFinal = seg.final ?? seg.isFinal ?? true;
        if (!isIntroductionPhase && isFinal) {
          if (who === "user") segmentMetricsRef.current.user_turns += 1;
          else segmentMetricsRef.current.ai_turns += 1;
        }
        // Only store transcript once question phase begins; English-only (student + AI).
        if (!isIntroductionPhase && englishLike(text)) {
          const now = Date.now();
          const inGrace = introEndedAtRef.current > 0 && now - introEndedAtRef.current < 2500;
          const aiAllowed = who !== "ai" || !shouldDropAiTranscriptLine(text);
          if (!(inGrace && who === "user") && aiAllowed) {
            upsertTranscript(who, text, segId, isFinal);
          }
        }
        
        // Auto-transition out of intro when AI begins Q1
        if (who === "ai" && isIntroductionPhase) {
          const t = text.toLowerCase();
          if (
            t.includes("move to the first question") ||
            t.includes("let's move to the first question") ||
            t.includes("now let's move to the first question") ||
            t.includes("first question") ||
            t.includes("question 1") ||
            t.includes("question one") ||
            t.includes("on your screen")
          ) {
            introEndedAtRef.current = Date.now();
            setIsIntroductionPhase(false);
          }
        }
        
      }
    };

    const onDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const json = JSON.parse(new TextDecoder().decode(payload));
        if (json.type === "transcript" || json.segment || json.text) {
          const who: "ai" | "user" = String(participant?.identity ?? "").startsWith("agent-") ? "ai" : "user";
          const text = json.text ?? json.segment?.text ?? "";
          if (!isIntroductionPhase && englishLike(text)) {
            const inGrace = introEndedAtRef.current > 0 && Date.now() - introEndedAtRef.current < 2500;
            const aiAllowed = who !== "ai" || !shouldDropAiTranscriptLine(text);
            if (inGrace && who === "user") return;
            if (!aiAllowed) return;
            upsertTranscript(who, text, `data-${Date.now()}`, true);
          }
        }
      } catch {};
    };

    room.on("connectionStateChanged", onStateChange);
    room.on("activeSpeakersChanged", onActiveSpeakers);
    room.on("transcriptionReceived", onTranscriptionReceived);
    room.on("dataReceived", onDataReceived);

    return () => {
      room.off("connectionStateChanged", onStateChange);
      room.off("activeSpeakersChanged", onActiveSpeakers);
      room.off("transcriptionReceived", onTranscriptionReceived);
      room.off("dataReceived", onDataReceived);
    };
  }, [
    room,
    doPublish,
    ended,
    upsertTranscript,
    englishLike,
    shouldDropAiTranscriptLine,
    isIntroductionPhase,
    question.id,
    question.kind,
  ]);

  useEffect(() => { if (ended) setAvatarState({ ai: "ended", human: "ended" }); }, [ended]);

  const publishPlayground = useCallback((canvas: HTMLCanvasElement) => {
    pendingCanvasRef.current = canvas;
    if (room.state === ConnectionState.Connected) doPublish(canvas);
  }, [room, doPublish]);

  useEffect(() => {
    if (isIntroductionPhase) return;
    const nextSegment = buildSegmentDescriptor(question, q2Part);
    const current = currentSegmentRef.current;
    const frozen = current && current.question_key !== nextSegment.question_key
      ? freezeSegmentForUpload(current, "question_changed")
      : null;

    currentSegmentRef.current = nextSegment;
    segmentInteractionRef.current.set(nextSegment.segment_id, null);
    resetSegmentMetrics(nextSegment.started_at_ms);
    flushedSegmentKeysRef.current.delete(nextSegment.segment_id);

    void (async () => {
      if (frozen) {
        await frozen.blobPromise;
      }
      if (currentSegmentRef.current?.segment_id !== nextSegment.segment_id) return;
      await startSegmentRecording(nextSegment);
      if (frozen) {
        void uploadSegmentArtifact(frozen.segment, frozen.reason, frozen.activitySummary, frozen.blobPromise);
      }
    })();
  }, [isIntroductionPhase, question, q2Part, buildSegmentDescriptor, freezeSegmentForUpload, resetSegmentMetrics, startSegmentRecording, uploadSegmentArtifact]);

  useEffect(() => {
    return () => {
      const current = currentSegmentRef.current;
      if (current) {
        const frozen = freezeSegmentForUpload(current, "component_unmount");
        currentSegmentRef.current = null;
        if (frozen) {
          void uploadSegmentArtifact(frozen.segment, frozen.reason, frozen.activitySummary, frozen.blobPromise);
        }
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [freezeSegmentForUpload, uploadSegmentArtifact]);

  // Clear chat when moving to a new question
  useEffect(() => {
    setTranscript([]);
    transcriptIdRef.current = 0;
    inProgressRef.current.clear();
  }, [activeQuestionIdx]);

  // Navigates to next question (agent announcement comes from the auto-visible effect below).
  const navigateToNext = useCallback(() => {
    const currentIdx = QUESTIONS.findIndex(q => q.id === question.id);
    const nextIdx = currentIdx + 1;
    if (nextIdx >= QUESTIONS.length) {
      setIsFinished(true);
      return;
    }
    setAnsweredQuestions(prev => new Set(prev).add(question.id));
    setActiveQuestionIdx(nextIdx);
  }, [question, setAnsweredQuestions, setActiveQuestionIdx, setIsFinished]);

  // Single source of truth: announce when visible question or Q2 part changes.
  useEffect(() => {
    if (isIntroductionPhase) return;
    const idx = QUESTIONS.findIndex(q => q.id === question.id);
    if (idx < 0) return;
    const key = `${question.id}:${question.id === 2 ? q2Part : 0}`;
    if (lastAutoAnnounceRef.current === key) return;
    lastAutoAnnounceRef.current = key;
    publishQuestionChanged(idx, question, question.id === 2 ? { part: q2Part } : undefined);
  }, [activeQuestionIdx, question, q2Part, isIntroductionPhase, publishQuestionChanged]);

  const stateLabel: Record<AvatarState, string> = {
    idle: "Ready",
    speaking: "Speaking",
    listening: "Listening",
    thinking: "Reviewing",
    ended: "Complete",
  };
  const stateColor: Record<AvatarState, string> = {
    idle: "text-slate-300",
    speaking: "text-blue-200",
    listening: "text-sky-200",
    thinking: "text-amber-300",
    ended: "text-white/40",
  };
  const humanStatus: AvatarState = ended
    ? "ended"
    : avatarState.human === "speaking"
      ? "speaking"
      : avatarState.ai === "speaking"
        ? "listening"
        : "idle";
  const aiStatus: AvatarState = ended
    ? "ended"
    : avatarState.ai === "thinking"
      ? "thinking"
      : avatarState.ai === "speaking"
        ? "speaking"
        : "idle";
  const progressPercent = isIntroductionPhase ? 0 : ((activeQuestionIdx + 1) / QUESTIONS.length) * 100;

  // Thank You screen
  if (isFinished) {
    return (
      <div className="relative flex min-h-[100dvh] h-[100dvh] items-center justify-center overflow-hidden bg-[#08101d] px-6">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.08]" />
          <div className="absolute left-[8%] top-[10%] h-64 w-64 rounded-full bg-indigo-500/14 blur-[110px]" />
          <div className="absolute bottom-[8%] right-[10%] h-72 w-72 rounded-full bg-sky-500/10 blur-[120px]" />
        </div>
        <div className="glass w-full max-w-xl rounded-[32px] border border-white/10 p-8 text-center shadow-2xl shadow-black/30 sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-500/15">
              <svg className="h-8 w-8 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <p className="text-xs uppercase tracking-[0.28em] text-white/35">Interview Submitted</p>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">Thank you for completing the session.</h1>
            <p className="text-sm leading-7 text-slate-300 sm:text-base">
              Your responses have been recorded successfully. The admissions team will review your interview and contact you with the next update.
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-4 text-sm text-slate-300">
            Gyan Vihar University AI Interview Console
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100dvh] h-[100dvh] flex-col overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.08]" />
        <div className="absolute left-[8%] top-[10%] h-64 w-64 rounded-full bg-indigo-500/14 blur-[110px]" />
        <div className="absolute bottom-[8%] right-[10%] h-72 w-72 rounded-full bg-sky-500/10 blur-[120px]" />
      </div>

      <header className="glass relative z-10 shrink-0 border-b border-white/10 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10">
              <svg className="h-5 w-5 text-blue-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7.5h15m-15 4.5h15m-15 4.5h9" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Gyan Vihar University</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-white">AI Interview Console</h1>
                <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-medium text-blue-100">
                  {isIntroductionPhase ? "Introduction" : `Question ${activeQuestionIdx + 1} of ${QUESTIONS.length}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <div className="min-w-[9rem]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/35">Candidate</p>
              <p className="truncate text-sm font-medium text-white">{name}</p>
            </div>
            {fullscreenSupported && (
              <button
                type="button"
                onClick={() => void (isFullscreen ? exitFullscreen() : requestFullscreen())}
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-medium text-white/80 transition-all hover:border-white/20 hover:bg-slate-900"
              >
                {isFullscreen ? "Exit full screen" : "Enter full screen"}
              </button>
            )}
            <Timer minutes={10} onEnd={() => setEnded(true)} />
          </div>
        </div>
      </header>

      {isIntroductionPhase ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
            <section className="glass rounded-[30px] border border-white/10 p-6 sm:p-8">
              <div className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-blue-100/80 inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-300" />
                Interview introduction
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                A focused interview environment that feels calm, interactive, and serious.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                The interviewer is introducing the session. Once the first question begins, the layout shifts into a full-screen assessment mode so the question visual, timer, and transcript remain easy to follow.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/35">Interview style</p>
                  <p className="mt-2 text-sm font-medium text-white">Think aloud clearly</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/35">Visual prompts</p>
                  <p className="mt-2 text-sm font-medium text-white">Questions stay large and centered</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/35">Session mode</p>
                  <p className="mt-2 text-sm font-medium text-white">{isFullscreen ? "Full screen active" : "Full screen will be requested"}</p>
                </div>
              </div>

              <div className="mt-8 rounded-[28px] border border-white/10 bg-slate-950/45 p-5 sm:p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/35">Candidate</p>
                    <div className="mt-4 flex flex-col items-center text-center">
                      <HumanAvatar state={ended ? "ended" : avatarState.human} />
                      <h3 className="mt-3 text-lg font-semibold text-white">{name}</h3>
                      <p className={`mt-1 text-sm font-medium ${stateColor[humanStatus]}`}>{stateLabel[humanStatus]}</p>
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/35">Interviewer</p>
                    <div className="mt-4 flex flex-col items-center text-center">
                      <AIAvatar state={ended ? "ended" : avatarState.ai} />
                      <h3 className="mt-3 text-lg font-semibold text-white">AI Interviewer</h3>
                      <p className={`mt-1 text-sm font-medium ${stateColor[aiStatus]}`}>{stateLabel[aiStatus]}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <aside className="glass rounded-[30px] border border-white/10 p-6 sm:p-8">
              <p className="text-xs uppercase tracking-[0.28em] text-white/35">Session Brief</p>
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-sm font-medium text-white">What to do</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Answer naturally, explain your reasoning, and keep your attention on the question visual and timer.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-sm font-medium text-white">What changes next</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">The first question opens in a cleaner workspace with a larger timer, full-screen support, and a transcript panel.</p>
                </div>
                {!isFullscreen && fullscreenSupported && (
                  <button
                    type="button"
                    onClick={() => void requestFullscreen()}
                    className="w-full rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm font-medium text-blue-100 transition-all hover:bg-blue-500/15"
                  >
                    Enter full screen now
                  </button>
                )}
              </div>
            </aside>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 lg:p-5">
          <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="glass relative z-[1] flex min-h-0 flex-col overflow-hidden rounded-[30px] border border-white/10">
              <div className="shrink-0 border-b border-white/10 px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.24em] text-white/35">Current section</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {QUESTIONS.map((q, i) => (
                        <div
                          key={q.id}
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${
                            activeQuestionIdx === i
                              ? "border-blue-400/30 bg-blue-500/15 text-blue-100"
                              : answeredQuestions.has(q.id)
                                ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                                : i > activeQuestionIdx
                                  ? "border-white/10 bg-white/[0.03] text-white/25"
                                  : "border-white/10 bg-white/[0.03] text-white/55"
                          }`}
                        >
                          Q{q.id}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="min-w-[12rem]">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-white/35">
                      <span>Progress</span>
                      <span>{activeQuestionIdx + 1}/{QUESTIONS.length}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-white/45">The AI interviewer sees the same question visual that you do.</p>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
                <QuestionPanel 
                  key={`${question.id}:${question.id === 2 ? q2Part : 0}`}
                  answeredQuestions={answeredQuestions} 
                  question={question} 
                  frozen={frozen} 
                  segmentId={`Q${question.id}${question.id === 2 ? `-P${q2Part}` : ""}`}
                  onCanvasReady={publishPlayground}
                  setActiveQuestionIdx={setActiveQuestionIdx}
                  setAnsweredQuestions={setAnsweredQuestions}
                  q2Part={q2Part}
                  setQ2Part={setQ2Part}
                  onActivitySnapshot={(snapshot) => {
                    segmentInteractionRef.current.set(snapshot.segment_id, snapshot);
                  }}
                />
              </div>

            {!frozen && activeQuestionIdx < QUESTIONS.length - 1 && !(question.id === 2 && q2Part < 3) && (
                <div className="shrink-0 border-t border-white/10 bg-slate-950/70 px-4 py-4 sm:px-5">
                <button
                  type="button"
                  onClick={() => navigateToNext()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-400/30 bg-gradient-to-r from-blue-600/20 to-indigo-600/25 py-3 text-sm font-semibold text-blue-100 transition-all hover:scale-[1.01] hover:from-blue-600/30 hover:to-indigo-600/35 active:scale-[0.99]"
                >
                  Submit & Next
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
            )}
            {!frozen && activeQuestionIdx >= QUESTIONS.length - 1 && (
                <div className="shrink-0 border-t border-white/10 bg-slate-950/70 px-4 py-4 sm:px-5">
                <button
                  type="button"
                  onClick={async () => {
                    if (currentSegmentRef.current) {
                      const frozen = freezeSegmentForUpload(currentSegmentRef.current, "finish_click");
                      currentSegmentRef.current = null;
                      if (frozen) {
                        await uploadSegmentArtifact(frozen.segment, frozen.reason, frozen.activitySummary, frozen.blobPromise);
                      }
                    }
                    const payload = { type: "question_changed", code: QUESTIONS.length - 1, questionId: question.id, question: question.question, kind: question.kind, finish: true };
                    publishFinish(payload);
                    setIsFinished(true);
                  }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-gradient-to-r from-emerald-600/20 to-green-600/25 py-3 text-sm font-semibold text-emerald-100 transition-all hover:scale-[1.01] hover:from-emerald-600/30 hover:to-green-600/35 active:scale-[0.99]"
                >
                  Finish Interview
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
            )}
            </section>

            <aside className="flex min-h-0 flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="glass rounded-[28px] border border-white/10 p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/35">Candidate</p>
                  <div className="mt-4 flex items-center gap-4">
                    <HumanAvatar state={ended ? "ended" : avatarState.human} />
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-white">{name}</p>
                      <p className={`mt-1 text-sm font-medium ${stateColor[humanStatus]}`}>{stateLabel[humanStatus]}</p>
                    </div>
                  </div>
                </div>

                <div className="glass rounded-[28px] border border-white/10 p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/35">Interviewer</p>
                  <div className="mt-4 flex items-center gap-4">
                    <AIAvatar state={ended ? "ended" : avatarState.ai} />
                    <div>
                      <p className="text-base font-semibold text-white">AI Interviewer</p>
                      <p className={`mt-1 text-sm font-medium ${stateColor[aiStatus]}`}>{stateLabel[aiStatus]}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass flex min-h-[14rem] flex-1 flex-col overflow-hidden rounded-[28px] border border-white/10">
                <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-white/35">Live transcript</p>
                    <p className="mt-1 text-sm text-white/55">Keeps the conversation visible while you answer.</p>
                  </div>
                  {transcript.length > 0 && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/50">
                      {transcript.length}
                    </span>
                  )}
                </div>
                <TranscriptView entries={transcript} />
              </div>

              {ended && (
                <div className="animate-fade-up rounded-[28px] border border-amber-400/20 bg-amber-500/10 p-4 text-center text-sm text-amber-100">
                  Time is up. Wrap up your current answer and finish the interview.
                </div>
              )}
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
