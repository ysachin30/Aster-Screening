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

export default function InterviewPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-up">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-400/40 border-t-indigo-400 animate-spin" />
          <p className="text-white/50 text-sm tracking-wide">Preparing your interview room…</p>
        </div>
      </main>
    }>
      <InterviewPageContent />
    </Suspense>
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
    // Resume any suspended AudioContext — must happen inside a user gesture
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        await ctx.resume();
        ctx.close();
      }
    } catch { /* ignore */ }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicOk(true);
    } catch {
      setMicOk(false);
    }
    setUnlocked(true);
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[120px]" />
          <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full bg-emerald-500/8 blur-[100px]" />
        </div>
        <div className="glass rounded-3xl p-10 max-w-sm w-full text-center animate-fade-up shadow-2xl shadow-black/40">
          <div className="relative flex items-center justify-center w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" style={{ animationDuration: "1.6s" }} />
            <div className="w-14 h-14 rounded-full bg-indigo-500/30 border border-indigo-400/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Enable Microphone</h2>
          <p className="text-sm text-white/50 mb-7 leading-relaxed">
            Your browser needs permission to use your mic and play audio.<br />
            Click below and allow access when prompted.
          </p>
          <button
            onClick={unlock}
            className="w-full py-3.5 rounded-xl font-semibold text-sm shimmer-btn text-white shadow-lg shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200"
          >
            Allow Microphone &amp; Start
          </button>
          <p className="mt-4 text-xs text-white/20">The AI interviewer will greet you immediately after</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {micOk === false && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-red-500/20 border border-red-400/30 text-red-300 text-xs">
          Microphone blocked — the AI can't hear you. Check browser permissions.
        </div>
      )}
      {children}
    </>
  );
}

function AIVoiceOrb({ active }: { active: boolean }) {
  return (
    <div className="relative flex items-center justify-center w-20 h-20 mx-auto">
      {active && (
        <>
          <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" style={{ animationDuration: "1.4s" }} />
          <div className="absolute inset-2 rounded-full bg-indigo-500/15 animate-ping" style={{ animationDuration: "1.8s", animationDelay: "0.3s" }} />
        </>
      )}
      <div className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500
        ${active ? "bg-indigo-500/30 shadow-lg shadow-indigo-500/40 border border-indigo-400/50" : "bg-white/5 border border-white/10"}`}>
        <svg className={`w-6 h-6 transition-colors duration-300 ${active ? "text-indigo-300" : "text-white/30"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
    </div>
  );
}

function InterviewStage({ name }: { name: string }) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [ended, setEnded] = useState(false);
  const [aiActive] = useState(true);
  const pendingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const publishedRef = useRef(false);
  const remoteAudioSeenRef = useRef(false);
  const fallbackGreetingSpokenRef = useRef(false); // kept to avoid unused-var errors

  const doPublish = useCallback(async (canvas: HTMLCanvasElement) => {
    if (publishedRef.current) return;
    publishedRef.current = true;
    console.log("[LK] Attempting playground publish — room state:", room.state);
    try {
      const stream = canvas.captureStream(15);
      const [videoTrack] = stream.getVideoTracks();
      if (!videoTrack) { console.warn("[LK] No video track from captureStream"); return; }
      console.log("[LK] captureStream OK — track label:", videoTrack.label);
      const lkTrack = new LocalVideoTrack(videoTrack, { name: "playground" } as any);
      await localParticipant.publishTrack(lkTrack, {
        name: "playground",
        source: Track.Source.ScreenShare,
        simulcast: false,
      });
      console.log("[LK] Playground track published ✓");
    } catch (e) {
      publishedRef.current = false;
      console.error("[LK] Playground publish failed:", e);
    }
  }, [localParticipant, room.state]);

  useEffect(() => {
    const onStateChange = () => {
      console.log("[LK] connectionStateChanged →", room.state);
      if (room.state === ConnectionState.Connected) {
        console.log("[LK] Room CONNECTED ✓ participants:", room.numParticipants);
        if (pendingCanvasRef.current) doPublish(pendingCanvasRef.current);
      }
    };
    const onDisconnected = (reason?: any) => console.warn("[LK] Room DISCONNECTED reason:", reason);
    const onReconnecting = () => console.warn("[LK] Room RECONNECTING…");
    const onReconnected = () => console.log("[LK] Room RECONNECTED ✓");
    const onParticipantConnected = (p: any) => {
      console.log("[LK] Participant joined:", p.identity, p.name);
    };
    const onTrackSubscribed = (track: any, pub: any, p: any) => {
      console.log("[LK] Track subscribed  participant:", p.identity, "kind:", track.kind, "name:", track.name);
      if (String(p.identity).startsWith("agent-") && track.kind === "audio") {
        remoteAudioSeenRef.current = true;
        console.log("[LK] AI audio track subscribed ✓ — real LiveKit AI audio active");
      }
    };
    const onMediaDevicesError = (e: any) => console.error("[LK] MediaDevices error:", e);

    const onDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const text = new TextDecoder().decode(payload);
        const json = JSON.parse(text);
        const who = participant?.identity ?? "agent";
        if (json.type === "transcript" || json.segment || json.text) {
          const msg = json.text ?? json.segment?.text ?? text;
          console.log(`[TRANSCRIPT] ${who}: ${msg}`);
        } else {
          console.log("[LK] dataReceived raw:", who, text.slice(0, 200));
        }
      } catch {
        console.log("[LK] dataReceived (binary):", payload.byteLength, "bytes");
      }
    };

    const onTranscriptionReceived = (segments: any[], participant: any) => {
      for (const seg of segments) {
        const who = participant?.identity ?? "agent";
        console.log(`[TRANSCRIPT] ${who}: ${seg.text ?? seg}`);
      }
    };

    room.on("connectionStateChanged", onStateChange);
    room.on("disconnected", onDisconnected);
    room.on("reconnecting", onReconnecting);
    room.on("reconnected", onReconnected);
    room.on("participantConnected", onParticipantConnected);
    room.on("trackSubscribed", onTrackSubscribed);
    room.on("mediaDevicesError", onMediaDevicesError);
    room.on("dataReceived", onDataReceived);
    room.on("transcriptionReceived", onTranscriptionReceived);

    console.log("[LK] useEffect mounted — current room state:", room.state, "participants:", room.numParticipants);

    return () => {
      room.off("connectionStateChanged", onStateChange);
      room.off("disconnected", onDisconnected);
      room.off("reconnecting", onReconnecting);
      room.off("reconnected", onReconnected);
      room.off("participantConnected", onParticipantConnected);
      room.off("trackSubscribed", onTrackSubscribed);
      room.off("mediaDevicesError", onMediaDevicesError);
      room.off("dataReceived", onDataReceived);
      room.off("transcriptionReceived", onTranscriptionReceived);
    };
  }, [room, doPublish]);

  const publishPlayground = useCallback((canvas: HTMLCanvasElement) => {
    pendingCanvasRef.current = canvas;
    console.log("[LK] publishPlayground called — room state:", room.state);
    if (room.state === ConnectionState.Connected) {
      doPublish(canvas);
    } else {
      console.log("[LK] Room not connected yet, queued canvas for later publish");
    }
  }, [room, doPublish]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* top nav bar */}
      <header className="glass border-b border-white/5 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <span className="font-semibold text-sm text-white/80">GyanVihar Interview</span>
          <span className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/30 hidden sm:block">
            Hi, <span className="text-white/60">{name}</span>
          </span>
          <Timer minutes={10} onEnd={() => setEnded(true)} />
        </div>
      </header>

      {/* main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 p-4 overflow-hidden">
        {/* playground panel */}
        <section className="glass rounded-2xl flex flex-col overflow-hidden min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-400" />
              <h2 className="text-sm font-semibold text-white/80">System Playground</h2>
            </div>
            <span className="text-xs text-white/25 hidden sm:block">Shift+drag to connect nodes</span>
          </div>
          <div className="flex-1 p-3 overflow-hidden">
            <Playground onReady={publishPlayground} frozen={ended} />
          </div>
        </section>

        {/* AI sidebar */}
        <aside className="glass rounded-2xl flex flex-col gap-4 p-4 overflow-y-auto">
          {/* AI orb */}
          <div className="pt-2">
            <AIVoiceOrb active={aiActive && !ended} />
            <div className="mt-3 text-center">
              <p className="text-sm font-medium text-white/70">AI Interviewer</p>
              <p className="text-xs text-white/30 mt-0.5">
                {ended ? "Session ended" : "Listening…"}
              </p>
            </div>
          </div>

          <div className="border-t border-white/5" />

          {/* tips */}
          <div className="space-y-2">
            {[
              { icon: "🎙️", text: "Speak naturally — the AI hears you in real-time" },
              { icon: "👁️", text: "Your playground is streamed live to the AI" },
              { icon: "💡", text: "Think out loud, explain your reasoning" },
            ].map((tip) => (
              <div key={tip.text} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/3 border border-white/5">
                <span className="text-base leading-none mt-0.5">{tip.icon}</span>
                <p className="text-xs text-white/40 leading-relaxed">{tip.text}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-white/5" />

          {/* mic status */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-400/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-white/60">Microphone</p>
              <p className="text-xs text-emerald-400">Active</p>
            </div>
          </div>

          {/* ended state */}
          {ended && (
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-400/25 text-center animate-fade-up">
              <div className="text-2xl mb-2">🎓</div>
              <p className="text-sm font-semibold text-indigo-300">Interview Complete</p>
              <p className="text-xs text-white/40 mt-1 leading-relaxed">
                Your evaluation is being generated. Results will be shared shortly.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
