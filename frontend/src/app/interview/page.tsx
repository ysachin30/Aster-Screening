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
import Playground from "@/components/Playground";
import Timer from "@/components/Timer";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const LK_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";

type AvatarState = "idle" | "speaking" | "listening" | "thinking" | "ended";
type TranscriptEntry = { who: "ai" | "user"; text: string; id: number };

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

  useEffect(() => {
    if (!room) return;
    console.log("[LK] Fetching token", { room, sid, name, backend: BACKEND, lkUrl: LK_URL });
    fetch(`${BACKEND}/api/getToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, identity: sid, name }),
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
        <InterviewStage name={name} />
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
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[140px] animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-violet-600/8 blur-[120px] animate-float-delayed" />
        </div>
        <div className="glass rounded-3xl p-10 max-w-sm w-full text-center animate-fade-up shadow-2xl shadow-black/60 relative z-10 border border-white/8">
          <div className="relative flex items-center justify-center w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-indigo-500/15 animate-ping" style={{ animationDuration: "2s" }} />
            <div className="absolute inset-3 rounded-full bg-indigo-500/10 animate-ping" style={{ animationDuration: "2.6s", animationDelay: "0.4s" }} />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/40 to-purple-600/40 border border-indigo-400/50 flex items-center justify-center shadow-xl shadow-indigo-500/30">
              <svg className="w-7 h-7 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Ready to begin?</h2>
          <p className="text-sm text-white/40 mb-8 leading-relaxed">
            Enable your microphone to start your AI-powered interview. The interviewer will greet you immediately.
          </p>
          <button onClick={unlock} className="w-full py-4 rounded-2xl font-semibold text-sm shimmer-btn text-white shadow-xl shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200">
            Allow Microphone &amp; Begin
          </button>
          <p className="mt-5 text-xs text-white/20">Interview duration: 10 minutes</p>
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

function AIAvatar({ state }: { state: AvatarState }) {
  const cfg = {
    idle:      { shadow: "rgba(99,102,241,0.25)",  ring: "border-indigo-500/25",  grad: "from-indigo-950/70 to-purple-950/70" },
    speaking:  { shadow: "rgba(99,102,241,0.65)",  ring: "border-indigo-400/70",  grad: "from-indigo-700/60 to-purple-700/60" },
    listening: { shadow: "rgba(6,182,212,0.55)",   ring: "border-cyan-400/60",    grad: "from-cyan-800/60 to-teal-800/60"   },
    thinking:  { shadow: "rgba(168,85,247,0.45)",  ring: "border-violet-400/50",  grad: "from-violet-900/60 to-indigo-900/60" },
    ended:     { shadow: "rgba(99,102,241,0.15)",  ring: "border-indigo-500/15",  grad: "from-indigo-950/50 to-purple-950/50" },
  }[state];

  return (
    <div className="relative flex items-center justify-center w-44 h-44">
      {/* Ambient glow */}
      <div className="absolute inset-0 rounded-full transition-all duration-700 pointer-events-none"
        style={{ boxShadow: `0 0 70px ${cfg.shadow}, 0 0 140px ${cfg.shadow}50` }} />

      {/* Outward pulse rings — AI speaking */}
      {state === "speaking" && ["-10px", "-22px", "-34px"].map((offset, i) => (
        <div key={i} className="absolute rounded-full border border-indigo-400/20 animate-ping pointer-events-none"
          style={{ inset: offset, animationDuration: `${1 + i * 0.4}s`, animationDelay: `${i * 0.2}s` }} />
      ))}

      {/* Inward pulse rings — listening */}
      {state === "listening" && [4, 10].map((inset, i) => (
        <div key={i} className="absolute rounded-full border border-cyan-400/30 animate-ping pointer-events-none"
          style={{ inset: `${inset}px`, animationDuration: `${1.2 + i * 0.4}s`, animationDelay: `${i * 0.3}s` }} />
      ))}

      {/* Spinning dashed ring — thinking */}
      {state === "thinking" && (
        <div className="absolute inset-1 rounded-full border-2 border-dashed border-violet-400/40 animate-spin-slow pointer-events-none" />
      )}

      {/* Idle breathing */}
      {state === "idle" && (
        <div className="absolute inset-2 rounded-full border border-indigo-400/15 animate-glow-breathe pointer-events-none" />
      )}

      {/* Core circle */}
      <div className={`relative w-32 h-32 rounded-full bg-gradient-to-br ${cfg.grad} border-2 ${cfg.ring} flex items-center justify-center transition-all duration-700`}
        style={{ boxShadow: `inset 0 0 40px ${cfg.shadow}40` }}>

        {state === "speaking" && (
          <div className="flex items-center gap-[3px]">
            {[0, 0.1, 0.05, 0.2, 0.15, 0.08, 0.18].map((d, i) => (
              <div key={i} className="w-[5px] rounded-full bg-indigo-300 animate-wave"
                style={{ animationDelay: `${d}s`, height: "36px" }} />
            ))}
          </div>
        )}

        {state === "listening" && (
          <div className="relative flex items-center justify-center w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-400/40 animate-pulse" />
            <div className="absolute inset-4 rounded-full border border-cyan-400/25 animate-pulse" style={{ animationDelay: "0.4s" }} />
            <svg className="w-7 h-7 text-cyan-300 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </div>
        )}

        {state === "thinking" && (
          <div className="flex items-center gap-2">
            {[0, 0.2, 0.4].map((d, i) => (
              <div key={i} className="w-3 h-3 rounded-full bg-violet-400/80 animate-bounce" style={{ animationDelay: `${d}s` }} />
            ))}
          </div>
        )}

        {state === "ended" && <span className="text-4xl">🎓</span>}

        {state === "idle" && (
          <div className="animate-float">
            <svg className="w-12 h-12 text-indigo-300/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
        )}
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
    <div ref={ref} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
      {entries.map((e) => (
        <div key={e.id} className={`flex gap-2 animate-fade-up ${e.who === "user" ? "flex-row-reverse" : ""}`}>
          <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] mt-0.5
            ${e.who === "ai" ? "bg-indigo-500/20 border border-indigo-400/30" : "bg-emerald-500/20 border border-emerald-400/30"}`}>
            {e.who === "ai" ? "✨" : "👤"}
          </div>
          <div className={`max-w-[84%] px-3 py-2 text-xs leading-relaxed border
            ${e.who === "ai"
              ? "bg-indigo-500/8 border-indigo-400/15 text-white/65 rounded-2xl rounded-tl-sm"
              : "bg-emerald-500/8 border-emerald-400/15 text-white/65 rounded-2xl rounded-tr-sm"}`}>
            {e.text}
          </div>
        </div>
      ))}
    </div>
  );
}

function InterviewStage({ name }: { name: string }) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [ended, setEnded] = useState(false);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const transcriptIdRef = useRef(0);
  const pendingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const publishedRef = useRef(false);
  const prevSpeakerRef = useRef<"none" | "ai" | "user">("none");
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addTranscript = useCallback((who: "ai" | "user", text: string) => {
    if (!text.trim()) return;
    setTranscript(prev => [...prev.slice(-60), { who, text: text.trim(), id: ++transcriptIdRef.current }]);
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
        setAvatarState("speaking");
        prevSpeakerRef.current = "ai";
      } else if (userTalking) {
        if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current);
        setAvatarState("listening");
        prevSpeakerRef.current = "user";
      } else {
        if (prevSpeakerRef.current === "user") {
          setAvatarState("thinking");
          thinkingTimerRef.current = setTimeout(() => setAvatarState("idle"), 6000);
        } else {
          setAvatarState("idle");
        }
        prevSpeakerRef.current = "none";
      }
    };

    const onTranscriptionReceived = (segments: any[], participant: any) => {
      for (const seg of segments) {
        const text = seg.text ?? seg;
        if (!text) continue;
        const who: "ai" | "user" = String(participant?.identity ?? "").startsWith("agent-") ? "ai" : "user";
        addTranscript(who, text);
      }
    };

    const onDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const json = JSON.parse(new TextDecoder().decode(payload));
        if (json.type === "transcript" || json.segment || json.text) {
          const who: "ai" | "user" = String(participant?.identity ?? "").startsWith("agent-") ? "ai" : "user";
          addTranscript(who, json.text ?? json.segment?.text ?? "");
        }
      } catch {}
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
  }, [room, doPublish, ended, addTranscript]);

  useEffect(() => { if (ended) setAvatarState("ended"); }, [ended]);

  const publishPlayground = useCallback((canvas: HTMLCanvasElement) => {
    pendingCanvasRef.current = canvas;
    if (room.state === ConnectionState.Connected) doPublish(canvas);
  }, [room, doPublish]);

  const stateLabel: Record<AvatarState, string> = {
    idle: "Waiting for you…", speaking: "Speaking…", listening: "Listening to you…",
    thinking: "Thinking…", ended: "Interview Complete",
  };
  const stateColor: Record<AvatarState, string> = {
    idle: "text-white/35", speaking: "text-indigo-400", listening: "text-cyan-400",
    thinking: "text-violet-400", ended: "text-white/25",
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Ambient background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/3 w-[700px] h-[700px] rounded-full bg-indigo-700/5 blur-[180px]" />
        <div className="absolute bottom-0 right-1/3 w-[600px] h-[600px] rounded-full bg-violet-700/4 blur-[160px]" />
      </div>

      {/* Header */}
      <header className="glass border-b border-white/5 px-5 py-3.5 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-400/30 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-sm">✨</span>
          </div>
          <div>
            <span className="font-bold text-sm text-white/90">Aster Screening</span>
            <span className="ml-2 text-white/20 text-xs hidden sm:inline">AI Interview</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-xs text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/25 hidden sm:block">{name}</span>
          <Timer minutes={10} onEnd={() => setEnded(true)} />
        </div>
      </header>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3 p-3 overflow-hidden min-h-0">

        {/* Playground */}
        <section className="glass rounded-2xl flex flex-col overflow-hidden min-h-0 border border-white/6">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
              </div>
              <span className="text-xs font-medium text-white/50 ml-1">Problem Space</span>
            </div>
            <span className="text-xs text-white/15 hidden sm:block">Think out loud · The AI is watching</span>
          </div>
          <div className="flex-1 p-3 overflow-hidden">
            <Playground onReady={publishPlayground} frozen={ended} />
          </div>
        </section>

        {/* AI Panel */}
        <aside className="flex flex-col gap-3 min-h-0 overflow-hidden">

          {/* Avatar card */}
          <div className="glass rounded-2xl px-5 py-6 flex flex-col items-center gap-4 shrink-0 border border-white/6">
            <AIAvatar state={ended ? "ended" : avatarState} />
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-white/80">AI Interviewer</p>
              <p className={`text-xs font-medium transition-all duration-500 ${stateColor[ended ? "ended" : avatarState]}`}>
                {stateLabel[ended ? "ended" : avatarState]}
              </p>
            </div>

            {/* User speaking bar */}
            {avatarState === "listening" && !ended && (
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-cyan-500/10 border border-cyan-400/25 animate-fade-up">
                <div className="flex items-end gap-0.5 h-4">
                  {[0, 0.12, 0.06, 0.18, 0.09].map((d, i) => (
                    <div key={i} className="w-[4px] rounded-full bg-cyan-400 animate-wave" style={{ animationDelay: `${d}s`, height: "14px" }} />
                  ))}
                </div>
                <span className="text-xs text-cyan-300/80 font-medium">You're speaking</span>
              </div>
            )}

            {/* Tips row */}
            <div className="w-full grid grid-cols-3 gap-1.5 mt-1">
              {[["🎙️", "Speak naturally"], ["�️", "AI watches board"], ["💡", "Think out loud"]].map(([icon, tip]) => (
                <div key={tip} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/3 border border-white/5">
                  <span className="text-sm">{icon}</span>
                  <p className="text-[9px] text-white/30 text-center leading-tight">{tip}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Transcript */}
          <div className="glass rounded-2xl flex flex-col overflow-hidden flex-1 min-h-0 border border-white/6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/50" />
                <span className="text-xs font-medium text-white/40">Live Transcript</span>
              </div>
              {transcript.length > 0 && (
                <span className="text-[10px] text-white/20">{transcript.length} messages</span>
              )}
            </div>
            <TranscriptView entries={transcript} />
          </div>

          {/* Ended card */}
          {ended && (
            <div className="glass rounded-2xl p-5 text-center animate-fade-up shrink-0 border border-indigo-400/20 bg-indigo-500/5">
              <div className="text-3xl mb-2">🎓</div>
              <p className="text-sm font-bold text-indigo-300">Interview Complete</p>
              <p className="text-xs text-white/30 mt-1.5 leading-relaxed">Generating your evaluation…</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
