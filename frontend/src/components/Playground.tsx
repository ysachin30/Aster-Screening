"use client";
import { useEffect, useRef } from "react";

type Node = { id: string; x: number; y: number; label: string; color: string };

const INITIAL_NODES: Node[] = [
  { id: "a", x: 80, y: 120, label: "Sensor", color: "#f59e0b" },
  { id: "b", x: 280, y: 80, label: "Controller", color: "#10b981" },
  { id: "c", x: 480, y: 160, label: "Actuator", color: "#6366f1" },
  { id: "d", x: 280, y: 260, label: "Fallback", color: "#ef4444" },
];

export default function Playground({
  onReady,
  frozen,
}: {
  onReady: (canvas: HTMLCanvasElement) => void;
  frozen: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>(JSON.parse(JSON.stringify(INITIAL_NODES)));
  const edgesRef = useRef<Array<[string, string]>>([]);
  const dragRef = useRef<{ id: string | null; dx: number; dy: number }>({ id: null, dx: 0, dy: 0 });
  const connectRef = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onReady(canvas);

    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const drawGrid = () => {
      const step = 32;
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
    };

    const drawArrow = (ax: number, ay: number, bx: number, by: number, color: string) => {
      const angle = Math.atan2(by - ay, bx - ax);
      const endX = bx - Math.cos(angle) * 32;
      const endY = by - Math.sin(angle) * 32;
      const startX = ax + Math.cos(angle) * 32;
      const startY = ay + Math.sin(angle) * 32;

      const grad = ctx.createLinearGradient(startX, startY, endX, endY);
      grad.addColorStop(0, color + "40");
      grad.addColorStop(1, color + "cc");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.shadowBlur = 0;

      const arrowLen = 10;
      ctx.fillStyle = color + "cc";
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - arrowLen * Math.cos(angle - 0.4), endY - arrowLen * Math.sin(angle - 0.4));
      ctx.lineTo(endX - arrowLen * Math.cos(angle + 0.4), endY - arrowLen * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
    };

    const draw = () => {
      ctx.fillStyle = "#060810";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawGrid();

      for (const [from, to] of edgesRef.current) {
        const a = nodesRef.current.find((n) => n.id === from);
        const b = nodesRef.current.find((n) => n.id === to);
        if (!a || !b) continue;
        drawArrow(a.x, a.y, b.x, b.y, "#6366f1");
      }

      for (const n of nodesRef.current) {
        const isDragging = dragRef.current.id === n.id;
        const r = 30;

        ctx.shadowColor = n.color;
        ctx.shadowBlur = isDragging ? 28 : 14;
        ctx.fillStyle = n.color + "30";
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        const grad = ctx.createRadialGradient(n.x - 6, n.y - 6, 2, n.x, n.y, r);
        grad.addColorStop(0, n.color + "ff");
        grad.addColorStop(1, n.color + "aa");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4;
        ctx.fillText(n.label, n.x, n.y + 4);
        ctx.shadowBlur = 0;
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [onReady]);

  const scale = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
    };
  };

  const hit = (x: number, y: number) =>
    nodesRef.current.find((n) => Math.hypot(n.x - x, n.y - y) < 34) || null;

  const onDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (frozen) return;
    const { x, y } = scale(e);
    const node = hit(x, y);
    if (!node) return;
    if (e.shiftKey) {
      connectRef.current = node.id;
    } else {
      dragRef.current = { id: node.id, dx: x - node.x, dy: y - node.y };
    }
  };
  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (frozen) return;
    const { x, y } = scale(e);
    const d = dragRef.current;
    if (d.id) {
      const n = nodesRef.current.find((n) => n.id === d.id);
      if (n) { n.x = x - d.dx; n.y = y - d.dy; }
    }
  };
  const onUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (frozen) return;
    const { x, y } = scale(e);
    if (connectRef.current) {
      const target = hit(x, y);
      if (target && target.id !== connectRef.current) {
        edgesRef.current.push([connectRef.current, target.id]);
      }
      connectRef.current = null;
    }
    dragRef.current = { id: null, dx: 0, dy: 0 };
  };
  const onLeave = () => {
    dragRef.current = { id: null, dx: 0, dy: 0 };
    connectRef.current = null;
  };

  return (
    <div className="flex-1 flex flex-col">
      <p className="text-xs text-white/50 mb-2">
        Drag to move nodes. Shift+drag from one node to another to connect them.
      </p>
      <canvas
        ref={canvasRef}
        width={720}
        height={420}
        className="rounded-lg bg-[#0b0d12] border border-white/10 w-full max-w-full"
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onLeave}
      />
    </div>
  );
}
