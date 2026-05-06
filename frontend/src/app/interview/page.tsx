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

type AvatarState = "idle" | "speaking" | "listening" | "thinking" | "ended";

type DualAvatarState = {
  ai: AvatarState;
  human: AvatarState;
};
type TranscriptEntry = { who: "ai" | "user"; text: string; id: number };
type QuestionKind = "gif" | "satellite" | "differentiability" | "text";
type Question = {
  id: number;
  kind: QuestionKind;
  question: string;
  context: string;
  hints: string[];
  answer: string;
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
    hints: [
      "At the microscopic level, what gives rise to the normal force between two surfaces in contact?",
      "Think in isolated manner — where electrons of both surfaces are meeting face to face.",
    ],
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
    hints: [
      "Part 1: Draw the gravitational force (g) pointing toward Earth, and the velocity (v) perpendicular to it.",
      "Part 2: If v becomes zero, which direction would the satellite move?",
      "Part 3: If gravity becomes zero, which direction would the satellite move?",
    ],
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
    hints: [
      "Think about what the derivative represents geometrically — it is the slope of the tangent line. What happens to that slope at a sharp corner?",
      "Drag the probe point on the canvas toward x = 0 and watch what happens to the tangent line.",
    ],
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
    question: "A cube is painted on all six faces and then cut into 27 equal smaller cubes. How many small cubes will have exactly two painted faces?",
    context:
      "A cube divided into 27 cubes means:\n3×3×3\n\nExactly two painted faces occur on edge cubes excluding corners.",
    hints: [
      "How many edges does a cube have?",
      "On each edge, which cubes are not corners?",
    ],
    answer:
      "A cube has 12 edges.\n\nFor a 3×3×3 cube, each edge has 3 small cubes. The two end cubes are corners; the middle cube has exactly two painted faces.\n\nThus: 12×1 = 12.\n\nTherefore, 12 small cubes have exactly two painted faces.",
  },
  {
    id: 5,
    kind: "text",
    question: "Question 5",
    context: "",
    hints: [],
    answer: "",
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
      <div className="min-h-screen bg-[#060810] text-white font-sans antialiased overflow-hidden flex items-center justify-center">
        <div className="text-center space-y-8 max-w-md mx-auto px-8">
          <div className="relative w-32 h-32 mx-auto">
            <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-ping" style={{ animationDuration: "2.6s", animationDelay: "0.4s" }} />
            <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500/40 to-purple-600/40 border border-indigo-400/50 flex items-center justify-center shadow-xl shadow-indigo-500/30">
              <svg className="w-14 h-14 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Ready to begin?</h2>
          <p className="text-sm text-white/40 mb-8 leading-relaxed">
            Enable your microphone to start your AI-powered interview. The interviewer will greet you immediately.
          </p>
          <button
            onClick={unlock}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
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
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-red-500/20 border border-red-400/30 text-red-300 text-xs backdrop-blur-xl shadow-lg">
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
  onCanvasReady,
  answeredQuestions,
  setActiveQuestionIdx,
  setAnsweredQuestions,
}: {
  question: Question;
  frozen: boolean;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  answeredQuestions: Set<number>;
  setActiveQuestionIdx: (index: number) => void;
  setAnsweredQuestions: (setter: (prev: Set<number>) => Set<number>) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showContext, setShowContext] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  // Satellite state (used only when question.kind === "satellite")
  const [satAngle, setSatAngle] = useState(Math.PI / 2); // start at bottom of orbit (opposite position)
  const [drawMode, setDrawMode] = useState(false);
  // Single stroke — starting a new one always replaces the previous
  const [stroke, setStroke] = useState<{ x: number; y: number }[] | null>(null);
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

      // ── USER STROKE — single stroke with neon glow ──
      if (stroke && stroke.length >= 2) {
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

      // ── Force vectors ──
      // Gravity — always shown, magenta (radial inward)
      const gx = cx - sx, gy = cy - sy;
      const glen = Math.hypot(gx, gy) || 1;
      drawArrow(ctx, sx, sy, sx + (gx / glen) * 85, sy + (gy / glen) * 85, "#e040fb", "F_g");
      // Tangential velocity — always shown, cyan
      drawArrow(ctx, sx, sy, sx + tx * 95, sy + ty * 95, "#00d4ff", "v");

      // ── Satellite body — metallic box with gold foil & solar panels ──
      ctx.save();
      // Subtle glow
      ctx.shadowColor = "rgba(220,200,120,0.6)";
      ctx.shadowBlur = 14;
      // Gold Mylar insulation body
      const bodyGrad = ctx.createLinearGradient(sx - 10, sy - 8, sx + 10, sy + 8);
      bodyGrad.addColorStop(0, "#e8d080");
      bodyGrad.addColorStop(0.45, "#c8a840");
      bodyGrad.addColorStop(1, "#8a6a18");
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.roundRect(sx - 10, sy - 8, 20, 16, 3);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Silver face plate
      ctx.fillStyle = "rgba(200,210,225,0.9)";
      ctx.fillRect(sx - 7, sy - 5, 14, 10);
      // Face detail lines
      ctx.strokeStyle = "rgba(100,120,150,0.6)";
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(sx - 2, sy - 5); ctx.lineTo(sx - 2, sy + 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + 2, sy - 5); ctx.lineTo(sx + 2, sy + 5); ctx.stroke();
      // Specular highlight
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(sx - 3, sy - 3, 4, 2, -0.4, 0, 2 * Math.PI);
      ctx.fill();

      // Solar panels — dark navy glass with cyan grid
      const drawPanel = (px: number, py: number, pw: number, ph: number) => {
        const pg = ctx.createLinearGradient(px, py, px + pw, py + ph);
        pg.addColorStop(0, "#0f2a55");
        pg.addColorStop(1, "#0a1c3a");
        ctx.fillStyle = pg;
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeStyle = "rgba(0,180,220,0.5)";
        ctx.lineWidth = 0.8;
        ctx.strokeRect(px, py, pw, ph);
        // grid
        for (let gi = 1; gi < 3; gi++) {
          ctx.beginPath(); ctx.moveTo(px + pw * gi / 3, py); ctx.lineTo(px + pw * gi / 3, py + ph); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(px, py + ph / 2); ctx.lineTo(px + pw, py + ph / 2); ctx.stroke();
      };
      drawPanel(sx - 38, sy - 5, 26, 10); // left panel
      drawPanel(sx + 12, sy - 5, 26, 10); // right panel
      // Panel strut
      ctx.strokeStyle = "rgba(180,190,200,0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx - 12, sy); ctx.lineTo(sx - 38, sy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + 12, sy); ctx.lineTo(sx + 38, sy); ctx.stroke();
      // Antenna
      ctx.strokeStyle = "rgba(200,210,220,0.9)";
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(sx, sy - 8); ctx.lineTo(sx - 3, sy - 18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx - 3, sy - 18); ctx.lineTo(sx - 8, sy - 22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx - 3, sy - 18); ctx.lineTo(sx + 2, sy - 22); ctx.stroke();
      ctx.restore();

      // Satellite label
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.font = "500 12px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 6;
      ctx.fillText("SATELLITE", sx + 16, sy - 14);
      ctx.shadowBlur = 0;

      // ── HUD ──
      // Bottom-left instruction
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.font = "13px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText(
        drawMode ? "✏️  Draw where the satellite will go if gravity is removed"
                 : "🖱️  Drag the satellite to any position on the orbit",
        18, H - 18
      );

      // Legend — clean glass panel
      ctx.fillStyle = "rgba(0,0,8,0.55)";
      ctx.beginPath();
      ctx.roundRect(14, 14, 300, 58, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(14, 14, 300, 58, 6);
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.font = "bold 12px system-ui";
      ctx.fillStyle = "#e040fb";
      ctx.fillText("● F_g  gravitational force  (radial inward)", 24, 24);
      ctx.fillStyle = "#00d4ff";
      ctx.fillText("● v    tangential velocity  (perpendicular)", 24, 43);

      // Mode pill — top right
      const modeLabel = drawMode ? "DRAW MODE" : "DRAG MODE";
      const modeCol = drawMode ? "#00d4ff" : "#e0c060";
      ctx.font = "bold 11px system-ui";
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
    if (hintsRevealed > 0) {
      ctx.fillStyle = "#f59e0b";
      ctx.font = "bold 12px system-ui";
      ctx.fillText("HINTS", 24, y);
      y += 18;
      ctx.fillStyle = "#fbbf24";
      ctx.font = "12px system-ui";
      for (const h of question.hints.slice(0, hintsRevealed)) {
        const lines = wrap("• " + h, W - 48);
        lines.forEach(l => { ctx.fillText(l, 24, y); y += 16; });
        y += 4;
      }
    }
  }, [question, hintsRevealed, satAngle, drawMode, stroke, diffX]);

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
        // Replace any previous stroke — only one stroke at a time
        setStroke([p]);
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
        setStroke(prev => prev ? [...prev, p] : [p]);
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

  const clearStroke = () => setStroke(null);
  const toggleDrawMode = () => setDrawMode(d => !d);

  const remainingHints = question.hints.length - hintsRevealed;
  const isSatellite = question.kind === "satellite";
  const isDiff = question.kind === "differentiability";
  const isInteractive = isSatellite || isDiff;

  return (
    <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
      {/* Question card */}
      <div className="rounded-2xl px-4 py-3 border border-fuchsia-400/25 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/8 to-cyan-500/8 shrink-0 backdrop-blur-md">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-1.5 py-0.5 rounded-md bg-fuchsia-500/20 border border-fuchsia-400/30 text-[9px] font-bold text-fuchsia-300 tracking-widest">
                Q{question.id}
              </span>
              <span className="text-[9px] text-white/30">
                {question.kind === "differentiability" ? "Mathematics" : "Physics"}
              </span>
            </div>
            <h3 className="text-sm font-bold text-white leading-snug">{question.question}</h3>
          </div>
          <button
            onClick={() => setShowContext(!showContext)}
            className="shrink-0 px-2 py-0.5 rounded-lg text-[9px] font-medium bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/60 hover:text-white transition-all"
          >
            {showContext ? "Hide" : "Context"}
          </button>
        </div>
        {showContext && (
          <div className="mt-2 pt-2 border-t border-white/8 max-h-24 overflow-y-auto animate-fade-up">
            <p className="text-[11px] text-white/55 leading-relaxed whitespace-pre-line">{question.context}</p>
          </div>
        )}
      </div>

      {/* Canvas / media area */}
      <div className="relative flex-1 rounded-2xl overflow-hidden border border-white/8 bg-black min-h-0">
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
            isSatellite
              ? `w-full h-full touch-none ${drawMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`
              : isDiff
                ? "w-full h-full touch-none cursor-grab active:cursor-grabbing"
                : "hidden"
          }
        />

        {/* Floating Erase button when satellite + has a stroke */}
        {isSatellite && stroke !== null && (
          <button
            onClick={clearStroke}
            disabled={frozen}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-black/60 hover:bg-black/80 border border-white/20 hover:border-white/40 text-white/80 backdrop-blur-md shadow-lg transition-all disabled:opacity-40"
          >
            🧹 Erase
          </button>
        )}

        {/* Non-interactive visuals */}
        {!isInteractive && (
          <>
            {question.kind === "gif" ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={GIF_URL} alt="visual cue" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950">
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(236,72,153,0.25), transparent 40%), radial-gradient(circle at 80% 30%, rgba(34,211,238,0.18), transparent 45%), radial-gradient(circle at 50% 80%, rgba(139,92,246,0.18), transparent 50%)" }} />
                <div className="absolute inset-0 flex items-center justify-center p-10">
                  <div className="max-w-xl w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-8">
                    <div className="text-xs tracking-widest text-white/40 font-semibold">VISUAL THINKING</div>
                    <div className="mt-2 text-white/80 text-sm leading-relaxed">
                      Use the question text above. When you are ready, click <span className="font-semibold text-fuchsia-200">Submit & Next</span>.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Hints overlay (both modes) */}
        {hintsRevealed > 0 && (
          <div className="absolute top-2 left-2 right-2 flex flex-col gap-1.5 pointer-events-none">
            {question.hints.slice(0, hintsRevealed).map((h, i) => (
              <div key={i} className="px-2.5 py-1.5 rounded-xl bg-amber-500/85 border border-amber-300/50 text-[10px] font-medium text-amber-950 backdrop-blur-md shadow-lg animate-fade-up">
                💡 <span className="font-semibold">{h}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => setHintsRevealed(Math.min(hintsRevealed + 1, question.hints.length))}
          disabled={remainingHints === 0 || frozen}
          className="flex-1 py-2 rounded-xl text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 hover:border-amber-400/50 text-amber-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
        >
          💡 Hint {remainingHints > 0 ? `(${remainingHints})` : "done"}
        </button>
        {isSatellite && (
          <button
            onClick={toggleDrawMode}
            disabled={frozen}
            className={`flex-1 py-2 rounded-xl text-[11px] font-semibold border transition-all disabled:opacity-40 hover:scale-[1.01] active:scale-[0.99] ${
              drawMode
                ? "bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-400/60 text-cyan-100 shadow-sm shadow-cyan-500/40"
                : "bg-white/5 hover:bg-white/10 border-white/20 text-white/70"
            }`}
          >
            {drawMode ? "✏️ Drawing mode — tap to drag" : "✏️ Draw trajectory"}
          </button>
        )}
      </div>
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
  const prevSpeakerRef = useRef<"none" | "ai" | "user">("none");
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const upsertTranscript = useCallback((who: "ai" | "user", text: string, segId: string, isFinal: boolean) => {
    if (!text.trim()) return;
    const existingEntryId = inProgressRef.current.get(segId);
    if (existingEntryId !== undefined) {
      setTranscript(prev => prev.map(e => e.id === existingEntryId ? { ...e, text: text.trim() } : e));
      if (isFinal) inProgressRef.current.delete(segId);
    } else {
      const newId = ++transcriptIdRef.current;
      inProgressRef.current.set(segId, newId);
      setTranscript(prev => [...prev.slice(-60), { who, text: text.trim(), id: newId }]);
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
      const aiTalking = speakers.some((p: any) => String(p.identity).startsWith("agent-"));
      const userTalking = speakers.some((p: any) => p.identity === room.localParticipant.identity);
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
        // Only store transcript once question phase begins
        if (!isIntroductionPhase) {
          upsertTranscript(who, text, segId, isFinal);
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
            setIsIntroductionPhase(false);
          }
        }
        
        // Voice command detection for "submit" in Q2
        if (who === "user" && !isIntroductionPhase && question.kind === "satellite" && 
            text.toLowerCase().includes("submit")) {
          console.log("[Q2] Voice command 'submit' detected, navigating to next question");
          const currentIdx = QUESTIONS.findIndex(q => q.id === question.id);
          const nextIdx = currentIdx + 1;
          if (nextIdx < QUESTIONS.length) {
            setAnsweredQuestions(prev => new Set(prev).add(question.id));
            setActiveQuestionIdx(nextIdx);
            const nextQ = QUESTIONS[nextIdx];
            const payload = { type: "question_changed", code: nextIdx, questionId: nextQ.id, question: nextQ.question, kind: nextQ.kind, context: nextQ.context, hints: nextQ.hints };
            setTimeout(() => {
              try {
                room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(payload)), { reliable: true });
              } catch (e) { console.warn("[LK] publishData failed", e); }
            }, 2000);
          } else {
            setIsFinished(true);
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
          if (!isIntroductionPhase) {
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
  }, [room, doPublish, ended, upsertTranscript]);

  useEffect(() => { if (ended) setAvatarState({ ai: "ended", human: "ended" }); }, [ended]);

  const publishPlayground = useCallback((canvas: HTMLCanvasElement) => {
    pendingCanvasRef.current = canvas;
    if (room.state === ConnectionState.Connected) doPublish(canvas);
  }, [room, doPublish]);

  // Clear chat when moving to a new question
  useEffect(() => {
    setTranscript([]);
    transcriptIdRef.current = 0;
    inProgressRef.current.clear();
  }, [activeQuestionIdx]);

  // Navigates to next question and notifies the AI agent about the new question
  const navigateToNext = useCallback(() => {
    const currentIdx = QUESTIONS.findIndex(q => q.id === question.id);
    const nextIdx = currentIdx + 1;
    if (nextIdx >= QUESTIONS.length) {
      setIsFinished(true);
      return;
    }
    const nextQ = QUESTIONS[nextIdx];
    // Publish data message to agent so it reads the new question aloud
    const payload = { type: "question_changed", code: nextIdx, questionId: nextQ.id, question: nextQ.question, kind: nextQ.kind, context: nextQ.context, hints: nextQ.hints };
    setTimeout(() => {
      try {
        room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(payload)), { reliable: true });
        console.log("[LK] question_changed published", { nextId: nextQ.id, kind: nextQ.kind, code: nextIdx });
      } catch (e) { console.warn("[LK] publishData failed", e); }
    }, 2000);

    setAnsweredQuestions(prev => new Set(prev).add(question.id));
    setActiveQuestionIdx(nextIdx);
  }, [question, setAnsweredQuestions, setActiveQuestionIdx, setIsFinished, room]);

  const stateLabel: Record<AvatarState, string> = {
    idle: "Waiting for you…", speaking: "Speaking…", listening: "Listening to you…",
    thinking: "Thinking…", ended: "Interview Complete",
  };
  const stateColor: Record<AvatarState, string> = {
    idle: "text-violet-300/60", speaking: "text-pink-400", listening: "text-cyan-300",
    thinking: "text-amber-300", ended: "text-white/30",
  };

  // Thank You screen
  if (isFinished) {
    return (
      <div className="h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#060810]">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute top-[-5%] left-[5%] w-[400px] h-[400px] rounded-full bg-fuchsia-500/10 blur-[120px] animate-float" />
          <div className="absolute bottom-[-5%] right-[5%] w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[100px] animate-float-delayed" />
        </div>
        <div className="text-center max-w-lg mx-auto px-8 space-y-8">
          {/* Icon */}
          <div className="relative w-28 h-28 mx-auto">
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/30 to-cyan-500/30 rounded-full blur-2xl animate-pulse" />
            <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-fuchsia-600/40 to-cyan-600/40 border border-fuchsia-400/30 flex items-center justify-center">
              <svg className="w-14 h-14 text-fuchsia-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          {/* Text */}
          <div className="space-y-3">
            <h1 className="text-4xl font-black bg-gradient-to-r from-fuchsia-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Thank You!
            </h1>
            <p className="text-white/70 text-lg font-medium">Your interview has been submitted successfully.</p>
            <p className="text-white/40 text-sm leading-relaxed">
              We appreciate you taking the time to complete this assessment.<br />
              Our team will review your responses and get back to you soon.
            </p>
          </div>
          {/* Branding */}
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass border border-white/10">
            <span className="text-sm">⚡</span>
            <span className="text-white/50 text-xs font-medium tracking-wider">Aster Screening · Gyan Vihar University</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      {/* Ambient neon background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-[-5%] left-[5%] w-[400px] h-[400px] rounded-full bg-fuchsia-500/10 blur-[120px] animate-float" />
        <div className="absolute top-[15%] right-[5%] w-[350px] h-[350px] rounded-full bg-cyan-500/10 blur-[100px] animate-float-delayed" />
        <div className="absolute bottom-[-5%] left-[40%] w-[500px] h-[500px] rounded-full bg-purple-500/8 blur-[140px] animate-float" style={{ animationDelay: "2s" }} />
      </div>

      {/* Header with gamification score */}
      <header className="glass border-b border-white/5 px-4 py-2 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-500/40 to-cyan-500/40 border border-fuchsia-400/40 flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
            <span className="text-sm">⚡</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-sm shimmer-text">Aster Screening</span>
            <span className="text-white/20 text-xs hidden sm:inline">AI Interview</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/30 text-xs text-fuchsia-300 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse shadow-sm shadow-fuchsia-400" />
            Live
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/30 hidden sm:block">{name}</span>
          <Timer minutes={10} onEnd={() => setEnded(true)} />
        </div>
      </header>

      {/* Main content - Intro vs Question phase */}
      {isIntroductionPhase ? (
        // Introduction phase: stunning cosmic experience
        <div className="relative flex-1 overflow-hidden">
          {/* Animated cosmic background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950/50 to-slate-950">
            {/* Floating particles */}
            <div className="absolute inset-0">
              {[...Array(50)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 5}s`,
                    animationDuration: `${3 + Math.random() * 4}s`,
                    opacity: Math.random() * 0.8 + 0.2,
                    boxShadow: '0 0 6px rgba(255,255,255,0.8)'
                  }}
                />
              ))}
            </div>
            
            {/* Nebula clouds */}
            <div className="absolute inset-0">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />
            </div>
            
            {/* Animated grid lines */}
            <svg className="absolute inset-0 w-full h-full opacity-20">
              <defs>
                <linearGradient id="grid" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3" />
                </linearGradient>
              </defs>
              <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="url(#grid)" strokeWidth="1" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid-pattern)" />
            </svg>
          </div>

          {/* Central content */}
          <div className="relative flex-1 flex flex-col items-center justify-center p-8">
            {/* Glowing title */}
            <div className="mb-12 text-center">
              <h1 className="text-5xl md:text-7xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4 animate-pulse" style={{ animationDuration: '3s' }}>
                AI Interview
              </h1>
              <p className="text-lg md:text-xl text-white/60 font-light tracking-wider">Gyan Vihar University</p>
            </div>

            {/* Avatar connection system */}
            <div className="relative mb-12">
              {/* Connection lines */}
              <svg className="absolute inset-0 w-[400px] h-[200px] -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 pointer-events-none">
                <defs>
                  <linearGradient id="connection" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
                <path
                  d="M 100 100 Q 200 50 300 100"
                  stroke="url(#connection)"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="5 5"
                  className="animate-pulse"
                  style={{ animationDuration: '2s' }}
                />
                <circle cx="200" cy="75" r="3" fill="#8b5cf6" className="animate-ping" style={{ animationDuration: '2s' }} />
              </svg>

              {/* Avatar cards */}
              <div className="grid grid-cols-2 gap-16 relative z-10">
                {/* Human Avatar */}
                <div className="relative group">
                  {/* Glow effect */}
                  <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-500 animate-pulse" style={{ animationDuration: '4s' }} />
                  
                  <div className="relative glass backdrop-blur-xl rounded-full p-8 border border-cyan-400/30 overflow-hidden transform transition-all duration-500 hover:scale-105 hover:rotate-3 w-64 h-64 flex flex-col items-center justify-center">
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/10 to-blue-600/10 animate-pulse" style={{ animationDuration: '3s' }} />
                    
                    {/* Speaking indicator */}
                    {avatarState.human === "speaking" && !ended && (
                      <div className="absolute top-4 right-4">
                        <div className="w-4 h-4 bg-cyan-400 rounded-full animate-ping" />
                        <div className="w-4 h-4 bg-cyan-400 rounded-full absolute top-0" />
                      </div>
                    )}
                    
                    <div className="relative z-10 flex flex-col items-center space-y-4">
                      <div className="relative">
                        <div className="absolute inset-0 bg-cyan-400/30 rounded-full blur-xl animate-pulse" style={{ animationDuration: '2s' }} />
                        <HumanAvatar state={ended ? "ended" : avatarState.human} />
                      </div>
                      <div className="text-center">
                        <h3 className="text-xl font-bold text-cyan-100 mb-1">{name}</h3>
                        <p className="text-sm text-cyan-300/70 font-medium">
                          {avatarState.human === "speaking" ? "🎤 Speaking" : "👂 Listening"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Avatar */}
                <div className="relative group">
                  {/* Glow effect */}
                  <div className="absolute -inset-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-500 animate-pulse" style={{ animationDuration: '4s', animationDelay: '2s' }} />
                  
                  <div className="relative glass backdrop-blur-xl rounded-full p-8 border border-fuchsia-400/30 overflow-hidden transform transition-all duration-500 hover:scale-105 hover:-rotate-3 w-64 h-64 flex flex-col items-center justify-center">
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-pink-600/10 animate-pulse" style={{ animationDuration: '3s', animationDelay: '1s' }} />
                    
                    {/* Speaking indicator */}
                    {avatarState.ai === "speaking" && !ended && (
                      <div className="absolute top-4 right-4">
                        <div className="w-4 h-4 bg-fuchsia-400 rounded-full animate-ping" />
                        <div className="w-4 h-4 bg-fuchsia-400 rounded-full absolute top-0" />
                      </div>
                    )}
                    
                    <div className="relative z-10 flex flex-col items-center space-y-4">
                      <div className="relative">
                        <div className="absolute inset-0 bg-fuchsia-400/30 rounded-full blur-xl animate-pulse" style={{ animationDuration: '2s' }} />
                        <AIAvatar state={ended ? "ended" : avatarState.ai} />
                      </div>
                      <div className="text-center">
                        <h3 className="text-xl font-bold text-fuchsia-100 mb-1">AI Interviewer</h3>
                        <p className="text-sm text-fuchsia-300/70 font-medium">
                          {avatarState.ai === "speaking" ? "🎤 Speaking" : avatarState.ai === "thinking" ? "🤔 Thinking" : "👂 Listening"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Status message */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center space-x-2 px-6 py-3 rounded-full glass backdrop-blur-md border border-white/20">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-white/80 font-medium">Introduction Phase</span>
              </div>
              <p className="text-white/40 text-sm max-w-md mx-auto">
                Getting to know each other before we begin the questions
              </p>
            </div>
          </div>
        </div>
      ) : (
        // Question phase: normal layout
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-2 p-2 overflow-hidden min-h-0" style={{ gridTemplateRows: "minmax(0, 1fr)" }}>

          {/* Question + Canvas panel */}
          <section className="glass rounded-2xl flex flex-col overflow-hidden min-h-0 border border-white/8">
            {/* Question tabs — display only, no student navigation */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-1">
                {QUESTIONS.map((q, i) => (
                  <div
                    key={q.id}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold tracking-wider select-none flex items-center gap-1.5 ${
                      activeQuestionIdx === i
                        ? "bg-fuchsia-500/25 border border-fuchsia-400/50 text-fuchsia-200 shadow-sm shadow-fuchsia-500/30"
                        : answeredQuestions.has(q.id)
                          ? "bg-green-500/15 border border-green-400/40 text-green-300"
                          : i > activeQuestionIdx
                            ? "bg-white/3 border border-white/8 text-white/20 cursor-not-allowed"
                            : "bg-white/5 border border-white/10 text-white/40"
                    }`}
                  >
                    {answeredQuestions.has(q.id) ? (
                      <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : i > activeQuestionIdx ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    ) : null}
                    Q{q.id}
                  </div>
                ))}
              </div>
              <span className="text-[10px] text-white/25 hidden sm:flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-fuchsia-400 animate-pulse" />
                The AI sees what you see
              </span>
            </div>

            <div className="flex-1 p-2 overflow-hidden flex flex-col min-h-0">
              <QuestionPanel 
                answeredQuestions={answeredQuestions} 
                question={question} 
                frozen={frozen} 
                onCanvasReady={publishPlayground}
                setActiveQuestionIdx={setActiveQuestionIdx}
                setAnsweredQuestions={setAnsweredQuestions}
              />
            </div>

            {/* Submit & Next / Finish button */}
            {!frozen && (
              <div className="px-3 pb-3 shrink-0">
                {activeQuestionIdx < QUESTIONS.length - 1 ? (
                  <button
                    onClick={navigateToNext}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-fuchsia-600/30 to-purple-600/30 hover:from-fuchsia-600/50 hover:to-purple-600/50 border border-fuchsia-400/40 text-fuchsia-200 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-sm shadow-fuchsia-500/20 flex items-center justify-center gap-2"
                  >
                    Submit & Next
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const payload = { type: "question_changed", code: QUESTIONS.length - 1, questionId: question.id, question: question.question, kind: question.kind, finish: true };
                      setTimeout(() => {
                        try {
                          room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(payload)), { reliable: true });
                          console.log("[LK] finish published");
                        } catch (e) { console.warn("[LK] publishData failed", e); }
                      }, 2000);
                      setIsFinished(true);
                    }}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-green-600/30 to-emerald-600/30 hover:from-green-600/50 hover:to-emerald-600/50 border border-green-400/40 text-green-200 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-sm shadow-green-500/20 flex items-center justify-center gap-2"
                  >
                    Finish Interview
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </section>

          {/* AI Panel with dual avatars */}
          <aside className="flex flex-col gap-2 min-h-0 overflow-hidden">

          {/* Dual Avatar Cards */}
          <div className="grid grid-cols-2 gap-2 shrink-0">
            {/* Human Avatar - Cyan */}
            <div className="glass rounded-2xl px-2 py-2 flex flex-col items-center gap-1 border border-cyan-400/20 relative overflow-hidden">
              <div className="absolute inset-0 opacity-30 pointer-events-none transition-all duration-700"
                style={{
                  background: avatarState.human === "speaking" ? "radial-gradient(circle at 50% 30%, rgba(0,240,255,0.3), transparent 60%)"
                    : "radial-gradient(circle at 50% 30%, rgba(6,182,212,0.1), transparent 60%)",
                }}
              />
              <HumanAvatar state={ended ? "ended" : avatarState.human} />
              <div className="text-center space-y-0.5 relative z-10">
                <p className="text-xs font-bold text-cyan-100">{name}</p>
                <p className="text-[9px] font-medium text-cyan-300/70">
                  {avatarState.human === "speaking" ? "Speaking..." : "Idle"}
                </p>
              </div>
              {avatarState.human === "speaking" && !ended && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400" />
              )}
            </div>

            {/* AI Avatar - Magenta */}
            <div className="glass rounded-2xl px-2 py-2 flex flex-col items-center gap-1 border border-fuchsia-400/20 relative overflow-hidden">
              <div className="absolute inset-0 opacity-30 pointer-events-none transition-all duration-700"
                style={{
                  background: avatarState.ai === "speaking" ? "radial-gradient(circle at 50% 30%, rgba(255,0,255,0.3), transparent 60%)"
                    : avatarState.ai === "thinking" ? "radial-gradient(circle at 50% 30%, rgba(245,158,11,0.2), transparent 60%)"
                    : "radial-gradient(circle at 50% 30%, rgba(176,38,255,0.1), transparent 60%)",
                }}
              />
              <AIAvatar state={ended ? "ended" : avatarState.ai} />
              <div className="text-center space-y-0.5 relative z-10">
                <p className="text-xs font-bold text-fuchsia-100">AI</p>
                <p className="text-[9px] font-medium text-fuchsia-300/70">
                  {avatarState.ai === "speaking" ? "Speaking..." : avatarState.ai === "thinking" ? "Thinking..." : "Idle"}
                </p>
              </div>
              {avatarState.ai === "speaking" && !ended && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse shadow-lg shadow-fuchsia-400" />
              )}
            </div>
          </div>

          {/* Transcript - hidden during introduction */}
          {!isIntroductionPhase && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="glass rounded-2xl flex flex-col overflow-hidden min-h-0 border border-white/8">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-400/60 animate-pulse" />
                    <span className="text-xs font-medium text-white/50">Live Transcript</span>
                  </div>
                  {transcript.length > 0 && (
                    <span className="text-[10px] text-white/25 px-2 py-0.5 rounded-full bg-white/5 border border-white/8">
                      {transcript.length}
                    </span>
                  )}
                </div>
                <TranscriptView entries={transcript} />
              </div>
            </div>
          )}

          {/* Ended card */}
          {ended && (
            <div className="rounded-2xl p-5 text-center animate-fade-up shrink-0 border border-pink-400/30 bg-gradient-to-br from-pink-500/10 to-purple-500/10">
              <div className="text-3xl mb-2">🎓</div>
              <p className="text-sm font-bold shimmer-text">Interview Complete</p>
              <p className="text-xs text-white/40 mt-1.5 leading-relaxed">Generating your evaluation…</p>
            </div>
          )}
        </aside>
        </div>
      )}
    </div>
  );
}
