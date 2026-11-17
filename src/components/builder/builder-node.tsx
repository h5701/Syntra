"use client";

import { motion } from "framer-motion";
import { MemberAvatar } from "@/components/common/member-avatar";
import { StatusMark, healthTone } from "@/components/common/status";
import { healthColor, progressionColor } from "@/components/workflow/flow-colors";
import { stageIcon } from "@/components/workflow/stage-meta";
import { NODE_H, NODE_W, handleY, type Pos } from "@/lib/builder-layout";
import { branchColor } from "@/components/builder/builder-edge";
import { branches, nodeMeta, summarise, type CanvasNode } from "@/lib/builder-nodes";
import { useTeam } from "@/lib/team-state";
import { stageStatusLabel } from "@/lib/workflow-health";
import { cn } from "@/lib/utils";

/**
 * A step on the canvas. Original stages show their live operational data; added steps show what
 * they are configured to do. Positioned in world coordinates; dragging is handled by the canvas.
 */
export function BuilderNode({
  node,
  index,
  total,
  pos,
  selected,
  dragging,
  paused,
  connectHint,
  connecting,
  zoom,
  hasIncoming,
  usedBranches,
  outgoingCount,
  onKey,
}: {
  node: CanvasNode;
  index: number;
  total: number;
  pos: Pos;
  selected: boolean;
  dragging: boolean;
  paused: boolean;
  /** While a connection is being dragged: can it land on this step? */
  connectHint?: "valid" | "invalid" | "target" | "blocked";
  /** A connection is being dragged somewhere on the canvas. Handles stop catching pointers so drops reach steps. */
  connecting: boolean;
  zoom: number;
  hasIncoming: boolean;
  /** Which of a Condition's paths already lead somewhere. */
  usedBranches: string[];
  outgoingCount: number;
  onKey: (mode?: "connect") => void;
}) {
  const { byId, members } = useTeam();
  const { data, stage } = node;
  const meta = nodeMeta(data.type);
  const Icon = stage ? stageIcon[stage.kind] : meta.icon;
  const idle = !!stage && paused && stage.kind !== "complete";
  const flagged = !!stage && !idle && (stage.health === "attention" || stage.health === "critical");
  const accent = stage
    ? idle ? healthColor.idle : flagged ? healthColor[stage.health] : progressionColor(index / Math.max(1, total - 1))
    : meta.accent;
  const hasInput = data.type !== "trigger";
  const hasOutput = data.type !== "end";
  const hasOutgoing = usedBranches.length > 0 || outgoingCount > 0;
  const owner = stage ? byId(stage.ownerId) : undefined;
  const status = stage
    ? idle ? { tone: "neutral" as const, label: "Paused" } : { tone: healthTone[stage.health], label: stageStatusLabel[stage.health] }
    : node.issues.length ? { tone: "warning" as const, label: "Needs setup" } : { tone: "success" as const, label: "Ready" };
  const summary = summarise(data, (id) => members.find((m) => m.id === id)?.name);
  // Handles keep a restrained look but a usable size at any zoom: the hit area grows as the canvas shrinks.
  const hit = Math.min(56, Math.max(24, 34 / zoom));
  const hitW = Math.min(96, Math.max(24, 44 / zoom));
  const dot = Math.max(14, 10 / zoom);
  const personId = data.config.approverId || data.config.ownerId || (data.config.recipientType === "member" ? data.config.memberId : "");

  return (
    <motion.div
      data-node-id={node.id}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${data.name}, ${meta.label} step. ${status.label}.${stage ? ` ${stage.count} ${stage.countLabel}.` : ""} Select to inspect${hasOutput ? ", or press C to edit its connections" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onKey();
        } else if ((e.key === "c" || e.key === "C") && !e.metaKey && !e.ctrlKey && hasOutput) {
          // Keyboard route to connections: open the inspector with the connection menus focused.
          e.preventDefault();
          onKey("connect");
        }
      }}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: stage ? 0.1 + index * 0.07 : 0, duration: 0.35, ease: "easeOut" }}
      className={cn(
        "absolute rounded-2xl p-px outline-none select-none",
        dragging ? "cursor-grabbing" : "cursor-grab",
        connectHint === "valid" && "ring-4 ring-brand-cyan/35",
        connectHint === "target" && "ring-[6px] ring-brand-blue/60",
        connectHint === "invalid" && "opacity-45",
        connectHint === "blocked" && "cursor-not-allowed opacity-70 ring-[6px] ring-danger/45",
        selected
          ? "bg-brand-gradient shadow-[0_18px_44px_-14px_rgb(37_99_255/0.45)]"
          : flagged
            ? stage!.health === "critical" ? "bg-danger/50 shadow-[0_12px_34px_-12px_rgb(229_72_77/0.4)]" : "bg-warning/55 shadow-[0_12px_34px_-12px_rgb(234_122_12/0.45)]"
            : "bg-border shadow-card hover:bg-brand-gradient hover:shadow-lift",
      )}
      style={{ left: pos.x, top: pos.y, width: NODE_W, height: NODE_H }}
    >
      {stage && node.issues.length > 0 && (
        <span className="absolute -top-2.5 left-4 z-10 max-w-[calc(100%-2rem)] truncate rounded-full bg-warning px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase shadow-card">
          {node.issues[0].replace(/\.$/, "")}
        </span>
      )}
      <div className={cn("relative flex h-full flex-col overflow-hidden rounded-[15px] bg-white p-4", flagged && "bg-gradient-to-b from-warning-soft/70 to-white")}>
        <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: accent }} />
        <div className="flex items-center justify-between">
          <span className="flex size-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}1a`, color: accent }}>
            <Icon className="size-[18px]" strokeWidth={1.8} />
          </span>
          <span className="rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase" style={{ backgroundColor: `${accent}14`, color: accent }}>
            {meta.label}
          </span>
        </div>
        <p className={cn("mt-3 truncate text-[0.9375rem] leading-tight font-semibold tracking-tight text-navy", data.type === "condition" && "pr-9")}>{data.name}</p>
        <p className={cn("mt-0.5 truncate text-xs text-muted-foreground", data.type === "condition" && "pr-9")}>{stage ? data.description : summary}</p>

        <div className="mt-auto flex items-center gap-2 text-xs">
          {stage && owner ? (
            <>
              <MemberAvatar id={owner.id} size="xs" />
              <span className="min-w-0 flex-1 truncate font-medium">{owner.name}</span>
            </>
          ) : personId ? (
            <>
              <MemberAvatar id={personId} size="xs" />
              <span className="min-w-0 flex-1 truncate font-medium">{byId(personId).name}</span>
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{node.issues[0] ?? "No owner needed"}</span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <StatusMark tone={status.tone} className="text-xs">{status.label}</StatusMark>
          {stage ? (
            <span className="text-xs text-muted-foreground">
              <span className="text-sm font-bold text-navy tabular-nums">{stage.count}</span> {stage.kind === "complete" ? "closed" : "items"}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Configuration only</span>
          )}
        </div>
      </div>

      {hasInput && (
        <span aria-hidden className={cn("absolute top-1/2 -left-[7px] size-3.5 -translate-y-1/2 rounded-full border-2 bg-white", !hasIncoming && "border-dashed")} style={{ borderColor: accent }} />
      )}
      {hasOutput && data.type !== "condition" && (
        <Handle y={NODE_H / 2} hit={hit} hitW={hitW} dot={dot} color={accent} solid={hasOutgoing} connecting={connecting} title="Drag to connect to another step" />
      )}
      {data.type === "condition" &&
        branches.map((b) => (
          <span key={b.id}>
            <Handle
              y={handleY(b.id) + 1}
              hit={Math.min(hit, 56)}
              hitW={hitW}
              dot={dot}
              color={branchColor[b.id]}
              solid={usedBranches.includes(b.id)}
              connecting={connecting}
              branch={b.id}
              title={`Drag to connect the ${b.label} path`}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-4 -translate-y-1/2 rounded-full px-1.5 py-px text-[9px] font-bold tracking-wider uppercase"
              style={{ top: handleY(b.id) + 1, color: branchColor[b.id], backgroundColor: `${branchColor[b.id]}14` }}
            >
              {b.label}
            </span>
          </span>
        ))}
    </motion.div>
  );
}

/**
 * A step's output handle. The visible dot is small; the invisible area around it is larger,
 * grows as the canvas zooms out, and reaches mostly outwards so it doesn't steal clicks from the step.
 */
function Handle({
  y,
  hit,
  hitW,
  dot,
  color,
  solid,
  connecting,
  branch,
  title,
}: {
  y: number;
  hit: number;
  /** Width can be larger than height: it grows outwards into the gap, away from the other handle. */
  hitW: number;
  dot: number;
  color: string;
  solid: boolean;
  connecting: boolean;
  branch?: string;
  title: string;
}) {
  const INSET = 8; // how far the hit area reaches into the step
  return (
    <span
      data-handle-out=""
      data-branch={branch}
      title={title}
      className={cn("group/handle absolute cursor-crosshair", connecting && "pointer-events-none")}
      style={{ top: y, right: -(hitW - INSET), width: hitW, height: hit, transform: "translateY(-50%)" }}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 -translate-y-1/2 rounded-full border-2 bg-white shadow-card transition-all",
          "group-hover/handle:scale-125 group-hover/handle:shadow-lift group-active/handle:scale-110",
          !solid && "border-dashed",
        )}
        style={{ left: INSET - dot / 2, width: dot, height: dot, borderColor: color, boxShadow: undefined }}
      />
    </span>
  );
}
