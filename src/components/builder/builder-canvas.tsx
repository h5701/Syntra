"use client";

import { useEffect, useRef, useState } from "react";
import { BuilderEdge, branchColor } from "@/components/builder/builder-edge";
import { BuilderNode } from "@/components/builder/builder-node";
import { clampZoom, edgeGeometry, type Pos, type View } from "@/lib/builder-layout";
import type { Branch, BuilderEdge as EdgeData, CanvasNode } from "@/lib/builder-nodes";
import { cn } from "@/lib/utils";

interface Gesture {
  kind: "pan" | "node" | "connect";
  id?: string;
  edgeId?: string;
  branch?: Branch;
  startX: number;
  startY: number;
  origin: Pos | View;
  moved: boolean;
}

/**
 * The workspace: dot grid, pan and zoom, draggable steps and the connections between them.
 * Pointer logic lives here; state (view, positions, selection, the graph) is owned by the builder.
 * Dragging from a step's output handle draws a connection and drops it on another step.
 */
export function BuilderCanvas({
  nodes,
  edges,
  positions,
  view,
  selectedId,
  selectedEdgeId,
  paused,
  draggingId,
  connectCheck,
  onView,
  onSize,
  onSelect,
  onSelectEdge,
  onConnect,
  onHandleClick,
  onConnectingChange,
  onNodeKey,
  onDragStart,
  onDrag,
  onDragEnd,
}: {
  nodes: CanvasNode[];
  /** Connections, from the graph. */
  edges: EdgeData[];
  positions: Record<string, Pos>;
  view: View;
  selectedId: string | null;
  selectedEdgeId: string | null;
  paused: boolean;
  draggingId: string | null;
  /** Why a drag from `from` (on `branch`) can't land on `to`, or null if it can. */
  connectCheck: (from: string, branch: Branch | undefined, to: string) => string | null;
  onView: (v: View) => void;
  onSize: (w: number, h: number) => void;
  onSelect: (id: string | null) => void;
  onSelectEdge: (id: string) => void;
  onConnect: (from: string, branch: Branch | undefined, to: string) => void;
  /** A click (no drag) on an output handle: select its connection, or the step if it has none. */
  onHandleClick: (from: string, branch: Branch | undefined) => void;
  onConnectingChange: (connecting: boolean) => void;
  onNodeKey: (id: string, mode?: "connect") => void;
  onDragStart: () => void;
  onDrag: (id: string, pos: Pos) => void;
  onDragEnd: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [connecting, setConnecting] = useState<{ from: string; branch?: Branch; x: number; y: number; over?: string; reason?: string | null } | null>(null);
  // Latest view for the native wheel listener, which is attached once.
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  });

  // Track size so the builder can fit the workflow to the viewport.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onSize(el.clientWidth, el.clientHeight));
    ro.observe(el);
    onSize(el.clientWidth, el.clientHeight);
    return () => ro.disconnect();
  }, [onSize]);

  // Wheel zoom around the cursor. Native listener so we can preventDefault.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const z = clampZoom(v.z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), v.z);
      const k = z / v.z;
      onView({ z, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onView]);

  // Escape cancels a connection that's being dragged.
  useEffect(() => {
    if (!connecting) return;
    const cancel = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      gesture.current = null;
      onConnectingChange(false);
      setConnecting(null);
    };
    window.addEventListener("keydown", cancel, true);
    return () => window.removeEventListener("keydown", cancel, true);
  }, [connecting, onConnectingChange]);

  const world = (e: React.PointerEvent<HTMLDivElement>): Pos => {
    const rect = ref.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left - view.x) / view.z, y: (e.clientY - rect.top - view.y) / view.z };
  };

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | SVGElement;
    const handle = target.closest<HTMLElement>("[data-handle-out]");
    const nodeEl = target.closest<HTMLElement>("[data-node-id]");
    const edgeEl = target.closest<SVGElement | HTMLElement>("[data-edge-id]");
    try {
      ref.current?.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety; dragging still works without it.
    }
    if (handle && nodeEl) {
      const branch = (handle.dataset.branch as Branch | undefined) || undefined;
      gesture.current = { kind: "connect", id: nodeEl.dataset.nodeId!, branch, startX: e.clientX, startY: e.clientY, origin: { x: 0, y: 0 }, moved: false };
    } else if (nodeEl) {
      const id = nodeEl.dataset.nodeId!;
      onSelect(id);
      onDragStart();
      gesture.current = { kind: "node", id, startX: e.clientX, startY: e.clientY, origin: { ...positions[id] }, moved: false };
    } else {
      gesture.current = { kind: "pan", edgeId: edgeEl?.getAttribute("data-edge-id") ?? undefined, startX: e.clientX, startY: e.clientY, origin: { ...view }, moved: false };
    }
  };

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) < 4) return;
    g.moved = true;
    if (g.kind === "pan") {
      const o = g.origin as View;
      onView({ ...o, x: o.x + dx, y: o.y + dy });
    } else if (g.kind === "node") {
      const o = g.origin as Pos;
      onDrag(g.id!, { x: Math.round(o.x + dx / view.z), y: Math.round(o.y + dy / view.z) });
    } else {
      const p = world(e);
      if (!connecting) onConnectingChange(true);
      const over = ref.current?.ownerDocument.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
      setConnecting({ from: g.id!, branch: g.branch, x: p.x, y: p.y, over: over && over !== g.id ? over : undefined, reason: over && over !== g.id ? connectCheck(g.id!, g.branch, over) : null });
    }
  };

  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    try {
      if (ref.current?.hasPointerCapture(e.pointerId)) ref.current.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (connecting) onConnectingChange(false);
    setConnecting(null);
    if (!g) return;
    if (g.kind === "connect" && !g.moved) onHandleClick(g.id!, g.branch);
    if (g.kind === "pan" && !g.moved) {
      if (g.edgeId) onSelectEdge(g.edgeId);
      else onSelect(null);
    }
    if (g.kind === "node" && g.moved) onDragEnd(g.id!);
    if (g.kind === "connect" && g.moved) {
      const under = ref.current?.ownerDocument.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-node-id]");
      if (under?.dataset.nodeId) onConnect(g.id!, g.branch, under.dataset.nodeId);
    }
  };

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const indexOf = new Map(nodes.map((n, i) => [n.id, i]));
  const labelOf = (e: EdgeData) => (e.branch ? (e.branch === "yes" ? "Yes" : "No") : e.label);
  const connectFrom = connecting ? connecting.from : null;

  return (
    <div
      ref={ref}
      role="application"
      aria-label="Workflow canvas. Drag to pan, scroll to zoom, drag steps to rearrange, drag from a step's handle to connect."
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className={cn("absolute inset-0 touch-none overflow-hidden bg-[#fbfcff] select-none active:cursor-grabbing", connecting ? "cursor-crosshair" : "cursor-grab")}
      style={{
        backgroundImage:
          "radial-gradient(700px 360px at 8% 0%, rgb(37 99 255 / 0.07), transparent 70%), radial-gradient(700px 400px at 95% 100%, rgb(124 58 237 / 0.07), transparent 70%), radial-gradient(circle, rgb(37 60 140 / 0.2) 1px, transparent 1.4px)",
        backgroundSize: `auto, auto, ${28 * view.z}px ${28 * view.z}px`,
        backgroundPosition: `0 0, 0 0, ${view.x}px ${view.y}px`,
      }}
    >
      <div className="absolute top-0 left-0 origin-top-left will-change-transform" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
        <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width={1} height={1} aria-hidden={false}>
          {edges.map((e) => {
            const from = byId.get(e.from)!;
            const to = byId.get(e.to)!;
            return (
              <BuilderEdge
                key={e.id}
                id={e.id}
                from={positions[e.from]}
                to={positions[e.to]}
                branch={e.branch}
                position={indexOf.get(e.to)! / Math.max(1, nodes.length - 1)}
                targetHealth={to.stage?.health ?? "healthy"}
                paused={paused}
                configured={!from.stage || !to.stage}
                selected={selectedEdgeId === e.id}
                ariaLabel={`Connection from ${from.data.name} to ${to.data.name}${e.branch ? `, ${e.branch === "yes" ? "Yes" : "No"} path` : ""}. Select to inspect`}
                onKeySelect={() => onSelectEdge(e.id)}
              />
            );
          })}
          {connecting && (() => {
            const g = edgeGeometry(positions[connecting.from], { x: connecting.x, y: connecting.y - 92 }, connecting.branch);
            const color = connecting.branch ? branchColor[connecting.branch] : "#2563ff";
            return <path d={g.d} fill="none" stroke={color} strokeWidth={3} strokeDasharray="7 7" strokeLinecap="round" opacity={0.85} />;
          })()}
        </svg>

        {connecting && (
          <span
            className={cn("pointer-events-none absolute z-10 rounded-full border bg-white px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap shadow-lift", connecting.reason ? "border-danger/40 text-danger" : "border-border text-navy")}
            style={{ left: connecting.x + 14 / view.z, top: connecting.y + 14 / view.z, transform: `scale(${1 / view.z})`, transformOrigin: "top left" }}
          >
            {connecting.over ? (connecting.reason ?? `Connect to "${byId.get(connecting.over)?.data.name}"`) : "Drop on a step to connect"}
          </span>
        )}

        {/* Labels on connections: Yes and No on branches, plus any label an operator has added. */}
        {edges.map((e) => {
          const text = labelOf(e);
          const chip = !e.branch && !e.label && byId.get(e.from)!.stage?.movedToday !== undefined && byId.get(e.to)!.stage && !paused && e.id === `e-${e.from}__${e.to}`;
          if (!text && !chip) return null;
          const m = edgeGeometry(positions[e.from], positions[e.to], e.branch).mid;
          const selected = selectedEdgeId === e.id;
          const color = e.branch ? branchColor[e.branch] : undefined;
          return (
            <span
              key={`label-${e.id}`}
              data-edge-id={e.id}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border bg-white px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap shadow-card",
                e.branch ? "cursor-pointer uppercase" : chip && !text ? "pointer-events-none -translate-y-[170%] text-muted-foreground tabular-nums" : "cursor-pointer text-muted-foreground",
                selected && "ring-2 ring-brand-blue/40",
              )}
              style={{ left: m.x, top: m.y, color, borderColor: color ? `${color}55` : undefined }}
            >
              {text ?? `+${byId.get(e.from)!.stage!.movedToday} today`}
            </span>
          );
        })}

        {nodes.map((n) => {
          const refused = connectFrom && n.id !== connectFrom ? connectCheck(connectFrom, connecting?.branch, n.id) : null;
          const hint = connectFrom && n.id !== connectFrom ? (connecting?.over === n.id ? (refused ? "blocked" : "target") : refused ? "invalid" : "valid") : undefined;
          return (
            <BuilderNode
              key={n.id}
              node={n}
              index={indexOf.get(n.id)!}
              total={nodes.length}
              pos={positions[n.id]}
              selected={selectedId === n.id}
              dragging={draggingId === n.id}
              paused={paused}
              connectHint={hint}
              connecting={!!connecting}
              zoom={view.z}
              outgoingCount={edges.filter((e) => e.from === n.id).length}
              hasIncoming={edges.some((e) => e.to === n.id)}
              usedBranches={edges.filter((e) => e.from === n.id && e.branch).map((e) => e.branch!)}
              onKey={(mode) => (mode ? onNodeKey(n.id, mode) : onSelect(n.id))}
            />
          );
        })}
      </div>
    </div>
  );
}

