"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState, Track, LocalVideoTrack } from "livekit-client";
import Timer from "../../components/Timer";
import { getStoredAssessmentSequence } from "@/lib/assessment";

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

const questionDiscipline = (question: Question) => {
  if (question.kind === "differentiability") return "Mathematics";
  if (question.id === 5) return "Logic";
  return "Physics";
};

const questionSequenceLabel = (question: Question, part: number) => {
  if (question.id !== 2) return `Question ${question.id}`;
  return `Question 2.${part}`;
};

async function enterFullscreenFocus() {
  if (typeof document === "undefined") return;
  const root = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };

  if (document.fullscreenElement) return;

  try {
    if (root.requestFullscreen) {
      await root.requestFullscreen();
    } else if (root.webkitRequestFullscreen) {
      await root.webkitRequestFullscreen();
    }
  } catch {
    // Browser can reject fullscreen; the focus layout still works without it.
  }
}

export default function InterviewPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <InterviewPageContent />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="surface-panel rounded-2xl px-8 py-9 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <div className="h-8 w-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
        </div>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Preparing room</p>
        <p className="mt-1.5 text-sm font-medium text-slate-700">Establishing your AESTR assessment session</p>
      </div>
    </main>
  );
}

function InterviewPageContent() {
  const params = useSearchParams();
  const room = params.get("room") || "";
  const name = params.get("name") || "Student";
  const sid = params.get("sid") || "";
  const seqParam = Number(params.get("seq") || 0);
  const [token, setToken] = useState<string | null>(null);
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
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="surface-panel flex max-w-md flex-col items-center gap-4 rounded-2xl px-8 py-9 text-center shadow-sm">
          <div className="h-12 w-12 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Connecting</p>
            <p className="mt-1.5 text-sm font-medium text-slate-700">Preparing your interview environment...</p>
          </div>
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
          candidateSequence={Number.isFinite(seqParam) && seqParam > 0 ? seqParam : undefined}
          isIntroductionPhase={isIntroductionPhase}
          setIsIntroductionPhase={setIsIntroductionPhase}
          question={QUESTIONS[activeQuestionIdx]}
          frozen={false}
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-panel max-w-3xl rounded-2xl p-6 sm:p-8 shadow-sm"
        >
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Pre-flight check
              </div>
              <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm">
                <div className="absolute h-36 w-36 rounded-full border border-slate-100" />
                <div className="absolute h-28 w-28 rounded-full border border-slate-200 animate-spin-slow" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.25rem] border border-indigo-100 bg-indigo-50">
                  <svg className="h-9 w-9 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Access required</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                Enable your microphone to enter the assessment environment.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
                AESTR uses live audio monitoring throughout the interview. Once enabled, the
                platform will transition into a distraction-free fullscreen experience.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <SignalBadge label="Requirement" value="Microphone access" tone="live" />
                <SignalBadge label="Mode" value="Fullscreen focus" />
                <SignalBadge label="Monitoring" value="AI reviewed" />
              </div>

              <button
                onClick={unlock}
                className="btn-primary mt-8 inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold w-full sm:w-auto"
              >
                Enable microphone
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {micOk === false && (
        <div
          className="fixed left-1/2 z-40 max-w-[min(calc(100vw-1.5rem),24rem)] -translate-x-1/2 rounded-2xl border border-red-400/20 bg-red-500/12 px-4 py-3 text-center text-[11px] text-red-100 shadow-lg backdrop-blur-xl bottom-[max(1rem,env(safe-area-inset-bottom))] lg:bottom-auto lg:top-4"
          role="status"
        >
          Microphone access is blocked. Update browser permissions to continue.
        </div>
      )}
      {children}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function VideoConference({ name, isIntroductionPhase, setIsIntroductionPhase }: { 
  name: string; 
  isIntroductionPhase: boolean;
  setIsIntroductionPhase: (value: boolean) => void;
}) {
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AIAvatar({ state }: { state: AvatarState }) {
  // SPEAKING — neon magenta MORPHING BLOB with sound waves
  if (state === "speaking") {
    return (
      <div className="relative flex items-center justify-center w-32 h-32">
        {/* Outward radial pulses */}
        {[0, 0.25, 0.5].map((d, i) => (
          <div key={i} className="absolute rounded-full border-2 border-fuchsia-500/50 pointer-events-none animate-ripple-out"
            style={{ inset: `-${5 + i * 4}px`, animationDelay: `${d}s` }} />
        ))}
        {/* Halo glow */}
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{ boxShadow: "0 0 80px rgba(255,0,255,0.6), 0 0 120px rgba(176,38,255,0.4)" }} />
        {/* The morphing blob */}
        <div className="relative w-24 h-24 animate-blob-morph bg-gradient-to-br from-fuchsia-400 via-magenta-500 to-purple-600 flex items-center justify-center"
          style={{ boxShadow: "inset 0 -12px 24px rgba(176,38,255,0.6), inset 0 12px 24px rgba(255,0,255,0.5)" }}>
          {/* EQ bars */}
          <div className="flex items-center gap-[2px]">
            {[0.05, 0.18, 0.08, 0.22, 0.1, 0.16, 0.06].map((d, i) => (
              <div key={i} className="w-[4px] rounded-full bg-white animate-wave"
                style={{ animationDelay: `${d}s`, height: "32px", boxShadow: "0 0 8px rgba(255,255,255,0.9)" }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // THINKING — amber/gold spinning rings
  if (state === "thinking") {
    return (
      <div className="relative flex items-center justify-center w-32 h-32">
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{ boxShadow: "0 0 50px rgba(245,158,11,0.6)" }} />
        <div className="absolute inset-1 rounded-full border-4 border-dashed border-amber-400/70 animate-spin-slow pointer-events-none" />
        <div className="absolute inset-5 rounded-full border-2 border-dashed border-orange-300/50 pointer-events-none animate-spin-slow"
          style={{ animationDirection: "reverse", animationDuration: "3s" }} />
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-pink-500 flex items-center justify-center"
          style={{ boxShadow: "inset 0 0 24px rgba(245,158,11,0.4)" }}>
          <div className="flex items-center gap-1">
            {[0, 0.2, 0.4].map((d, i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: `${d}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ENDED
  if (state === "ended") {
    return (
      <div className="relative flex items-center justify-center w-32 h-32">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-fuchsia-700/50 to-purple-700/50 border-2 border-fuchsia-400/30 flex items-center justify-center">
          <span className="text-4xl">🤖</span>
        </div>
      </div>
    );
  }

  // IDLE — gentle magenta/purple floating sparkle
  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <div className="absolute inset-0 rounded-full pointer-events-none"
        style={{ boxShadow: "0 0 40px rgba(176,38,255,0.35)" }} />
      <div className="absolute inset-2 rounded-full border border-fuchsia-400/20 animate-glow-breathe pointer-events-none" />
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-fuchsia-600/60 via-purple-600/60 to-magenta-600/40 border-2 border-fuchsia-400/40 flex items-center justify-center animate-float"
        style={{ boxShadow: "inset 0 0 24px rgba(176,38,255,0.3)" }}>
        <svg className="w-10 h-10 text-fuchsia-200/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function HumanAvatar({ state }: { state: AvatarState }) {
  // SPEAKING — neon cyan MORPHING BLOB with sound waves
  if (state === "speaking") {
    return (
      <div className="relative flex items-center justify-center w-32 h-32">
        {/* Outward radial pulses */}
        {[0, 0.25, 0.5].map((d, i) => (
          <div key={i} className="absolute rounded-full border-2 border-cyan-500/50 pointer-events-none animate-ripple-out"
            style={{ inset: `-${5 + i * 4}px`, animationDelay: `${d}s` }} />
        ))}
        {/* Halo glow */}
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{ boxShadow: "0 0 80px rgba(0,240,255,0.6), 0 0 120px rgba(6,182,212,0.4)" }} />
        {/* The morphing blob */}
        <div className="relative w-24 h-24 animate-blob-morph bg-gradient-to-br from-cyan-400 via-teal-500 to-emerald-600 flex items-center justify-center"
          style={{ boxShadow: "inset 0 -12px 24px rgba(6,182,212,0.6), inset 0 12px 24px rgba(0,240,255,0.5)" }}>
          {/* EQ bars */}
          <div className="flex items-center gap-[2px]">
            {[0.05, 0.18, 0.08, 0.22, 0.1, 0.16, 0.06].map((d, i) => (
              <div key={i} className="w-[4px] rounded-full bg-white animate-wave"
                style={{ animationDelay: `${d}s`, height: "32px", boxShadow: "0 0 8px rgba(255,255,255,0.9)" }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ENDED
  if (state === "ended") {
    return (
      <div className="relative flex items-center justify-center w-32 h-32">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-700/50 to-teal-700/50 border-2 border-cyan-400/30 flex items-center justify-center">
          <span className="text-4xl">👤</span>
        </div>
      </div>
    );
  }

  // IDLE — gentle cyan/teal floating sparkle
  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <div className="absolute inset-0 rounded-full pointer-events-none"
        style={{ boxShadow: "0 0 40px rgba(0,240,255,0.35)" }} />
      <div className="absolute inset-2 rounded-full border border-cyan-400/20 animate-glow-breathe pointer-events-none" />
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-cyan-600/60 via-teal-600/60 to-emerald-600/40 border-2 border-cyan-400/40 flex items-center justify-center animate-float"
        style={{ boxShadow: "inset 0 0 24px rgba(0,240,255,0.3)" }}>
        <svg className="w-10 h-10 text-cyan-200/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TranscriptView({ entries }: { entries: TranscriptEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-4 py-8">
        <div>
          <div className="w-10 h-10 rounded-full bg-white/4 flex items-center justify-center mx-auto mb-3 border border-white/8">
            <span className="text-sm">💬</span>
          </div>
          <p className="text-xs text-white/20">Conversation will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0">
      {entries.map((e) => (
        <div key={e.id} className={`flex gap-2 animate-fade-up ${e.who === "user" ? "flex-row-reverse" : ""}`}>
          <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] mt-0.5
            ${e.who === "ai" ? "bg-fuchsia-500/25 border border-fuchsia-400/40 shadow-sm shadow-fuchsia-500/30" : "bg-cyan-500/25 border border-cyan-400/40 shadow-sm shadow-cyan-500/30"}`}>
            {e.who === "ai" ? "🤖" : "👤"}
          </div>
          <div className={`max-w-[84%] px-3 py-2 text-xs leading-relaxed border
            ${e.who === "ai"
              ? "bg-fuchsia-500/10 border-fuchsia-400/25 text-white/80 rounded-2xl rounded-tl-sm"
              : "bg-cyan-500/10 border-cyan-400/25 text-white/80 rounded-2xl rounded-tr-sm"}`}>
            {e.text}
          </div>
        </div>
      ))}
    </div>
  );
}

function SignalBadge({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "live" | "warning";
}) {
  const toneClass = tone === "live"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-full border px-2.5 py-1 text-[10px] ${toneClass} shadow-sm`}>
      <span className="mr-1.5 font-bold uppercase tracking-widest opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function AssessmentTranscriptView({ entries }: { entries: TranscriptEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex min-h-[16rem] flex-1 items-center justify-center px-6 py-8 text-center">
        <div className="max-w-xs">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 shadow-sm">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3h6m-9 7.5h12A2.25 2.25 0 0 0 18.75 16.5v-9A2.25 2.25 0 0 0 16.5 5.25h-9A2.25 2.25 0 0 0 5.25 7.5v9A2.25 2.25 0 0 0 7.5 18.75Z" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-800">Live transcript will appear here</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            The assessment feed updates as the interviewer speaks and your responses are detected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {entries.map((entry) => (
        <motion.div
          key={entry.id}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex ${entry.who === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[88%] rounded-2xl border px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
              entry.who === "user"
                ? "border-slate-200 bg-white text-slate-800 rounded-tr-sm"
                : "border-indigo-100 bg-indigo-50 text-indigo-950 rounded-tl-sm"
            }`}
          >
            <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest opacity-60">
              <span
                className={`h-1.5 w-1.5 rounded-full ${entry.who === "user" ? "bg-slate-400" : "bg-indigo-400"}`}
              />
              {entry.who === "user" ? "Candidate" : "AESTR AI"}
            </div>
            {entry.text}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function AssessmentAvatar({
  state,
  tone,
  label,
}: {
  state: AvatarState;
  tone: "ai" | "human";
  label: string;
}) {
  const palette = tone === "ai"
    ? {
        ring: "border-indigo-200",
        inner: "bg-indigo-50",
        accent: "bg-indigo-500",
        text: "text-indigo-900",
      }
    : {
        ring: "border-slate-200",
        inner: "bg-white",
        accent: "bg-slate-500",
        text: "text-slate-900",
      };

  const bars = state === "speaking";
  const thinking = state === "thinking";
  const ended = state === "ended";

  return (
    <div className="relative flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24">
      <div className={`absolute inset-0 rounded-full border ${palette.ring} bg-white shadow-sm`} />
      <div
        className={`absolute inset-2 rounded-full border border-slate-100 ${thinking ? "animate-spin-slow" : ""}`}
      />
      <div
        className={`relative flex h-[60px] w-[60px] items-center justify-center rounded-full border border-slate-200 ${palette.inner} shadow-inner sm:h-[68px] sm:w-[68px]`}
      >
        {ended ? (
          <svg className={`h-6 w-6 ${palette.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 1 0 15 0 7.5 7.5 0 1 0-15 0" />
          </svg>
        ) : bars ? (
          <div className="flex items-end gap-1">
            {[14, 22, 16, 24].map((height, index) => (
              <span
                key={`${label}-${height}`}
                className={`block w-1 rounded-full ${palette.accent} animate-wave ${index % 2 === 0 ? "opacity-80" : ""}`}
                style={{ height, animationDelay: `${index * 0.1}s` }}
              />
            ))}
          </div>
        ) : thinking ? (
          <div className="relative flex h-6 w-6 items-center justify-center">
            <span className={`absolute h-1.5 w-1.5 rounded-full ${palette.accent}`} />
            <span className={`absolute h-6 w-6 rounded-full border-2 border-slate-200 border-t-${tone === 'ai' ? 'indigo' : 'slate'}-400 animate-spin`} />
          </div>
        ) : (
          <span className={`text-sm font-bold tracking-widest ${palette.text}`}>{label}</span>
        )}
      </div>
    </div>
  );
}

function FocusCountdownOverlay({ value }: { value: number | null }) {
  return (
    <AnimatePresence>
      {value !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-md"
        >
          <div className="text-center">
            <motion.p
              key={value}
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05, y: -4 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="text-[5rem] font-semibold tracking-tight text-slate-900 sm:text-[7rem]"
            >
              {value}
            </motion.p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Entering focus mode
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
  q2Part,
  setQ2Part,
  onActivitySnapshot,
}: {
  question: Question;
  frozen: boolean;
  segmentId: string;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
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
  const responseGuidance = isSatelliteInteractive
    ? drawMode
      ? "Draw directly on the frame to explain your reasoning before advancing."
      : "Drag the model to inspect the scenario, then switch to drawing when you are ready."
    : isDiff
      ? "Drag the point across the curve and describe what happens near the corner."
      : "Speak clearly and structure your answer before continuing.";

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
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <div className="surface-panel shrink-0 rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 shadow-sm">
                {questionSequenceLabel(question, part)}
              </span>
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 shadow-sm">
                {questionDiscipline(question)}
              </span>
              {isQ2 && (
                <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 shadow-sm">
                  Part {part} of 3
                </span>
              )}
            </div>

            <h2 className="mt-4 max-w-4xl text-2xl font-semibold leading-snug text-slate-900 sm:text-3xl">
              {displayedQuestion}
            </h2>
          </div>

          <button
            onClick={() => setShowContext(!showContext)}
            className="btn-secondary shrink-0 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium"
          >
            {showContext ? "Hide context" : "View context"}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {showContext && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">{question.context}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr] items-start">
        <div className="surface-muted flex flex-col rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Response guidance</p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-700">{responseGuidance}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Input mode</p>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">
                {isInteractive ? "Interactive response" : "Voice response"}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                {isInteractive
                  ? "Manipulate the visual frame while explaining your reasoning aloud."
                  : "Think aloud clearly so the interviewer can assess your reasoning process."}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Assessment note</p>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">The interviewer sees this panel live</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Keep your explanation structured and use the visual region when it supports your answer.
              </p>
            </div>
          </div>
        </div>

        <div className="surface-panel flex flex-col rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-200">
          <div className="mb-3 flex items-center justify-between px-1 sm:px-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Media frame</p>
              <p className="mt-0.5 text-xs font-medium text-slate-700">
                {isInteractive ? "Use the workspace to support your response." : "Review the prompt visual before answering."}
              </p>
            </div>

            {isSatelliteInteractive && strokes.length > 0 && (
              <button
                onClick={clearStroke}
                disabled={frozen}
                className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
              >
                Clear drawing
              </button>
            )}
          </div>

          <div className="relative w-full aspect-video min-h-[280px] overflow-hidden rounded-[1.25rem] border border-slate-200 bg-slate-900 shadow-inner flex items-center justify-center">
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
                  ? `absolute inset-0 z-[2] h-full w-full touch-none ${drawMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`
                  : isDiff
                    ? "absolute inset-0 z-[2] h-full w-full touch-none cursor-grab active:cursor-grabbing"
                    : "hidden"
              }
            />

            {!isInteractive && (
              <div className="absolute inset-0 z-[2] flex items-center justify-center bg-slate-800 p-4">
                {question.kind === "gif" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={GIF_URL} alt="Question visual" className="h-full w-full object-contain rounded-md" />
                ) : isQ2TheoryPart ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={Q2_THEORY_GIF_URL} alt="Satellite theory visual" className="h-full w-full object-contain rounded-md" />
                ) : isQ4BridgeGif ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={Q4_BRIDGE_GIF_URL} alt="Bridge puzzle visual" className="h-full w-full object-contain rounded-md" />
                ) : isQ5LogicGif ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={Q5_LOGIC_GIF_URL} alt="Logic puzzle visual" className="h-full w-full object-contain rounded-md" />
                ) : (
                  <div className="max-w-xl rounded-xl border border-slate-600 bg-slate-700/50 p-6 text-center shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Visual prompt</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">
                      Use the question text and respond aloud when you are ready to proceed.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="surface-muted shrink-0 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Answer area</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Speak clearly, keep your reasoning structured, and use the controls below when the task requires interaction.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[20rem]">
            {isSatelliteInteractive && (
              <button
                onClick={toggleDrawMode}
                disabled={frozen}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition-all disabled:opacity-40 ${
                  drawMode
                    ? "border border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm"
                    : "btn-secondary"
                }`}
              >
                {drawMode ? "Switch to drag mode" : "Enable drawing mode"}
              </button>
            )}

            {isSatellite && isQ2 && typeof setQ2Part === "function" && part < 3 && (
              <button
                onClick={() => {
                  clearStroke();
                  setShowContext(false);
                  setDrawMode(false);
                  setQ2Part((p) => Math.min(3, p + 1));
                }}
                disabled={frozen || !canAdvanceQ2Part}
                className="btn-primary rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                {canAdvanceQ2Part ? "Continue to next part" : "Complete the drawing to continue"}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function InterviewStage({ name, candidateSequence: initialCandidateSequence, isIntroductionPhase, setIsIntroductionPhase, question, frozen, setActiveQuestionIdx, setAnsweredQuestions, activeQuestionIdx, isFinished, setIsFinished }: { 
  name: string; 
  candidateSequence?: number;
  isIntroductionPhase: boolean;
  setIsIntroductionPhase: (value: boolean) => void;
  question: Question;
  frozen: boolean;
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
  /** When intro→question transition fires; drop late user STT from intro for 2.5s */
  const introEndedAtRef = useRef<number>(0);
  const prevSpeakerRef = useRef<"none" | "ai" | "user">("none");
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [q2Part, setQ2Part] = useState(1);
  const [candidateSequence, setCandidateSequence] = useState(2793);
  const [cameraReady, setCameraReady] = useState(false);
  const [focusCountdown, setFocusCountdown] = useState<number | null>(null);
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

  useEffect(() => {
    if (question.id !== 2) setQ2Part(1);
  }, [question.id]);

  useEffect(() => {
    setCandidateSequence(initialCandidateSequence ?? getStoredAssessmentSequence());
  }, [initialCandidateSequence]);

  useEffect(() => {
    let cancelled = false;

    if (!navigator.mediaDevices?.enumerateDevices) return undefined;

    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (!cancelled) {
          setCameraReady(devices.some((device) => device.kind === "videoinput"));
        }
      })
      .catch(() => {
        if (!cancelled) setCameraReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isIntroductionPhase) return;

    void enterFullscreenFocus();
    setFocusCountdown(3);

    const interval = window.setInterval(() => {
      setFocusCountdown((value) => {
        if (value === null) return null;
        if (value <= 1) {
          window.clearInterval(interval);
          return null;
        }
        return value - 1;
      });
    }, 900);

    return () => window.clearInterval(interval);
  }, [isIntroductionPhase]);

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

  useEffect(() => {
    if (!isFinished || typeof document === "undefined" || !document.fullscreenElement) return;
    const exit = document.exitFullscreen?.bind(document);
    if (!exit) return;
    void exit().catch(() => {});
  }, [isFinished]);

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
    idle: "Waiting for you…", speaking: "Speaking…", listening: "Listening to you…",
    thinking: "Thinking…", ended: "Interview Complete",
  };
  const progressPercent = useMemo(() => {
    const base = ((activeQuestionIdx + 1) / QUESTIONS.length) * 100;
    if (question.id !== 2) return base;
    return ((activeQuestionIdx + Math.max(1, q2Part) / 3) / QUESTIONS.length) * 100;
  }, [activeQuestionIdx, question.id, q2Part]);

  // Thank You screen
  if (isFinished) {
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-slate-50 px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-panel max-w-2xl rounded-2xl p-8 text-center sm:p-10 shadow-sm"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-emerald-50 text-emerald-600 shadow-sm">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 1 0 15 0 7.5 7.5 0 1 0-15 0" />
            </svg>
          </div>

          <p className="mt-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">Assessment submitted</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Your AESTR interview is complete.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
            Your responses have been captured and sent for review. Faculty and AI evaluation will
            continue from here.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Candidate</p>
              <p className="mt-1.5 text-lg font-semibold text-slate-900">#{candidateSequence}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</p>
              <p className="mt-1.5 text-lg font-semibold text-slate-900">Under review</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Platform</p>
              <p className="mt-1.5 text-lg font-semibold text-slate-900">AESTR</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-50">
      <FocusCountdownOverlay value={focusCountdown} />

      <header className="surface-panel sticky top-0 z-40 shrink-0 border-b border-slate-200 shadow-sm">
        <div className="px-4 py-4 lg:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <span className="text-sm font-bold tracking-widest">AE</span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">AESTR Assessment</p>
                <h1 className="text-xl font-semibold tracking-tight text-slate-900 leading-tight">
                  University Admission Screening
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <SignalBadge label="Candidate" value={name} />
              <SignalBadge label="Sequence" value={`#${candidateSequence}`} />
              <SignalBadge
                label="Camera"
                value={cameraReady ? "Ready" : "Unavailable"}
                tone={cameraReady ? "live" : "warning"}
              />
              <SignalBadge label="Mic" value="Live" tone="live" />
              <Timer minutes={10} onEnd={() => setEnded(true)} />
            </div>
          </div>

          {!isIntroductionPhase && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <span>{questionSequenceLabel(question, q2Part)}</span>
                <span>{Math.round(progressPercent)}% complete</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <motion.div
                  className="h-full rounded-full bg-indigo-500"
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {isIntroductionPhase ? (
        <div className="flex-1 px-4 py-8 lg:px-6 lg:py-12">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.08fr_0.92fr]">
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="surface-panel rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Interview introduction</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                AESTR Admission Screening Interview
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
                This assessment is timed, AI monitored, and designed to reflect the pace and
                seriousness of a real university interview. Stay focused, answer clearly, and be
                ready to explain your reasoning aloud.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Duration</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">10 minutes</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Microphone</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">Required</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Camera</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {cameraReady ? "Ready" : "Check device"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sequence</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">#{candidateSequence}</p>
                </div>
              </div>

              <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Assessment notice</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Your responses are reviewed by AI and admissions staff. The system will enter
                  fullscreen focus mode as soon as questioning begins, followed by a short
                  countdown.
                </p>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              className="grid gap-6 content-start"
            >
              <div className="surface-panel rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 flex flex-col items-center">
                    <AssessmentAvatar state={ended ? "ended" : avatarState.human} tone="human" label="YOU" />
                    <p className="mt-4 text-center text-sm font-semibold text-slate-900">{name}</p>
                    <p className="mt-1 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {stateLabel[ended ? "ended" : avatarState.human]}
                    </p>
                  </div>

                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5 flex flex-col items-center">
                    <AssessmentAvatar state={ended ? "ended" : avatarState.ai} tone="ai" label="AI" />
                    <p className="mt-4 text-center text-sm font-semibold text-slate-900">AESTR Interviewer</p>
                    <p className="mt-1 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {stateLabel[ended ? "ended" : avatarState.ai]}
                    </p>
                  </div>
                </div>
              </div>

              <div className="surface-panel rounded-2xl p-6 shadow-sm border border-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Current state</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">Introduction in progress</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  The interviewer is establishing the session before switching to assessment mode.
                </p>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  <SignalBadge label="Status" value="Live session" tone="live" />
                  <SignalBadge label="Focus" value="Countdown pending" />
                </div>
              </div>
            </motion.section>
          </div>
        </div>
      ) : (
        <div className="flex-1 px-4 py-8 lg:px-6 lg:py-10">
          <div className="mx-auto grid max-w-[90rem] items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="flex flex-col gap-8 min-w-0">
              <div className="grid gap-4 shrink-0 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Focus mode</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">Assessment shell active</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    Minimal chrome, fullscreen prompt, and persistent timing controls.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">AI status</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">
                    {avatarState.ai === "thinking" ? "Analyzing response" : "Listening live"}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {avatarState.ai === "thinking"
                      ? "The interviewer is evaluating your latest response."
                      : "Your reasoning is being evaluated continuously as you speak."}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Response mode</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">
                    {question.kind === "satellite" || question.kind === "differentiability"
                      ? "Voice + interaction"
                      : "Voice response"}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    Use the prompt and media frame together when the task requires it.
                  </p>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <QuestionPanel
                  key={`${question.id}:${question.id === 2 ? q2Part : 0}`}
                  question={question}
                  frozen={frozen}
                  segmentId={`Q${question.id}${question.id === 2 ? `-P${q2Part}` : ""}`}
                  onCanvasReady={publishPlayground}
                  q2Part={q2Part}
                  setQ2Part={setQ2Part}
                  onActivitySnapshot={(snapshot) => {
                    segmentInteractionRef.current.set(snapshot.segment_id, snapshot);
                  }}
                />
              </AnimatePresence>

              {!frozen && activeQuestionIdx < QUESTIONS.length - 1 && !(question.id === 2 && q2Part < 3) && (
                <div className="pt-2 pb-6">
                  <button
                    type="button"
                    onClick={() => navigateToNext()}
                    className="btn-primary flex w-full max-w-md mx-auto items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-semibold"
                  >
                    Submit and continue
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </div>
              )}

              {!frozen && activeQuestionIdx >= QUESTIONS.length - 1 && (
                <div className="pt-2 pb-6">
                  <button
                    type="button"
                    onClick={async () => {
                      if (currentSegmentRef.current) {
                        const currentFrozen = freezeSegmentForUpload(currentSegmentRef.current, "finish_click");
                        currentSegmentRef.current = null;
                        if (currentFrozen) {
                          await uploadSegmentArtifact(
                            currentFrozen.segment,
                            currentFrozen.reason,
                            currentFrozen.activitySummary,
                            currentFrozen.blobPromise,
                          );
                        }
                      }
                      const payload = {
                        type: "question_changed",
                        code: QUESTIONS.length - 1,
                        questionId: question.id,
                        question: question.question,
                        kind: question.kind,
                        finish: true,
                      };
                      publishFinish(payload);
                      setIsFinished(true);
                    }}
                    className="flex w-full max-w-md mx-auto items-center justify-center gap-2 rounded-xl border-2 border-emerald-500 bg-emerald-500 px-6 py-4 text-base font-semibold text-white hover:bg-emerald-600 transition-colors shadow-sm"
                  >
                    Finish interview
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 1 0 15 0 7.5 7.5 0 1 0-15 0" />
                    </svg>
                  </button>
                </div>
              )}
            </section>

            <aside className="xl:sticky xl:top-[120px] flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 shrink-0">
                <div className="surface-panel rounded-2xl p-5 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-4">
                    <AssessmentAvatar state={ended ? "ended" : avatarState.human} tone="human" label="YOU" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{name}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Candidate channel
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {stateLabel[ended ? "ended" : avatarState.human]}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="surface-panel rounded-2xl p-5 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-4">
                    <AssessmentAvatar state={ended ? "ended" : avatarState.ai} tone="ai" label="AI" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">AESTR Interviewer</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Evaluation channel
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {stateLabel[ended ? "ended" : avatarState.ai]}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Analysis state</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {ended
                    ? "Finalizing evaluation"
                    : avatarState.ai === "thinking"
                      ? "Analyzing response"
                      : "Monitoring live answer"}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {ended
                    ? "Your session has ended and the platform is packaging your final submission."
                    : avatarState.ai === "thinking"
                      ? "The interviewer is processing your latest response before continuing."
                      : "Stay concise and speak clearly while the interviewer listens."}
                </p>
              </div>

              <div className="surface-panel flex flex-col overflow-hidden rounded-2xl shadow-sm border border-slate-200 h-[360px]">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50/50">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Transcript</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-700">Live conversation log</p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
                    {transcript.length} entries
                  </div>
                </div>
                <AssessmentTranscriptView entries={transcript} />
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
