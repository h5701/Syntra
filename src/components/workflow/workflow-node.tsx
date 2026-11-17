"use client";

import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { MemberAvatar } from "@/components/common/member-avatar";
import { StatusMark, healthTone } from "@/components/common/status";
import { healthColor, progressionColor } from "@/components/workflow/flow-colors";
import { stageIcon } from "@/components/workflow/stage-meta";
import { stageStatusLabel } from "@/lib/workflow-health";
import { useTeam } from "@/lib/team-state";
import { cn } from "@/lib/utils";
import type { WorkflowStage } from "@/lib/types";

const timeColor = {
  healthy: "text-navy",
  done: "text-navy",
  idle: "text-muted-foreground",
  attention: "text-warning",
  critical: "text-danger",
};

/** A stage of the process: number, icon, status, count, owner and processing time. */
export function WorkflowNode({
  stage,
  index,
  total,
  selected,
  onSelect,
  highlight,
  paused,
}: {
  stage: WorkflowStage;
  index: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
  /** Small caption marking the stage that needs attention first. */
  highlight?: "Bottleneck" | "Most work here";
  paused?: boolean;
}) {
  const Icon = stageIcon[stage.kind];
  const { byId } = useTeam();
  const owner = byId(stage.ownerId);
  const isPaused = !!paused && stage.kind !== "complete";
  const flagged = !isPaused && (stage.health === "attention" || stage.health === "critical");
  const shown = isPaused ? { tone: "neutral" as const, label: "Paused" } : { tone: healthTone[stage.health], label: stageStatusLabel[stage.health] };
  const accent = isPaused ? healthColor.idle : flagged || stage.health === "idle" ? healthColor[stage.health] : progressionColor(index / Math.max(1, total - 1));

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Stage ${index + 1}, ${stage.name}: ${paused && stage.kind !== "complete" ? "Paused" : stageStatusLabel[stage.health]}, ${stage.count} ${stage.countLabel}. Open details`}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.1 + index * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.985 }}
      className={cn(
        "group relative w-full rounded-2xl p-px text-left outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 xl:max-w-[212px] xl:min-w-0 xl:flex-[1_1_0]",
        selected
          ? "bg-brand-gradient shadow-lift"
          : flagged && stage.health === "critical"
            ? "bg-danger/50 shadow-[0_10px_30px_-10px_rgb(229_72_77/0.4)]"
            : flagged && stage.health === "attention"
              ? "bg-warning/55 shadow-[0_10px_30px_-10px_rgb(234_122_12/0.45)]"
              : "bg-border shadow-card hover:bg-brand-gradient hover:shadow-lift",
      )}
    >
      {highlight && !isPaused && (
        <span
          className={cn(
            "absolute -top-2.5 left-4 z-10 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap text-white uppercase shadow-card",
            highlight === "Bottleneck" ? "bg-warning" : "bg-brand-gradient",
          )}
        >
          {highlight}
        </span>
      )}
      <div className={cn("relative flex h-full flex-col overflow-hidden rounded-[15px] bg-white p-4", flagged && "bg-gradient-to-b from-warning-soft/70 to-white")}>
        <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: accent }} />
        <div className="flex items-start justify-between">
          <span className="flex size-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}1a`, color: accent }}>
            <Icon className="size-5" strokeWidth={1.8} />
          </span>
          <span className="text-xs font-semibold text-slate-400 tabular-nums">Stage {String(index + 1).padStart(2, "0")}</span>
        </div>

        <p className="mt-3.5 text-[0.9375rem] font-semibold tracking-tight text-navy">{stage.name}</p>
        <div className="mt-1.5 flex items-center">
          <span className="relative flex items-center">
            {flagged && (
              <span className="live-pulse absolute left-2 size-2 rounded-full" style={{ backgroundColor: accent, animation: "live-pulse 2s ease-out infinite" }} />
            )}
            <StatusMark tone={shown.tone} soft className="max-w-full text-left leading-tight whitespace-normal">
              {shown.label}
            </StatusMark>
          </span>
        </div>

        <div className="mt-4">
          <p className="text-[2rem] leading-none font-bold tracking-tight text-navy tabular-nums">{stage.count}</p>
          <p className="mt-1 text-xs text-muted-foreground">{stage.countLabel}</p>
        </div>

        <div className="mt-4 space-y-2 border-t border-border pt-3 text-xs">
          <div className="flex items-center gap-2">
            <MemberAvatar id={owner.id} size="xs" />
            <span className="truncate font-medium">{owner.name}</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-slate-400" />
              <span className={cn("font-semibold tabular-nums", timeColor[isPaused ? "idle" : stage.health])}>{stage.time}</span>
            </div>
            <p className={cn("mt-0.5 pl-5 text-[11px]", flagged ? timeColor[isPaused ? "idle" : stage.health] : "text-muted-foreground")}>{stage.timeNote}</p>
          </div>
        </div>
      </div>
    </motion.button>
  );
}
