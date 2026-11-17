import { Database, FlaskConical, GitBranch } from "lucide-react";
import type { InsightKind, InsightSource, Priority } from "@/lib/insights";
import { cn } from "@/lib/utils";

/** The three places an insight's evidence can come from, kept visibly apart. */
export const sourceInfo: Record<InsightSource, { label: string; short: string; blurb: string; Icon: typeof Database; chip: string }> = {
  "demo-operational": {
    label: "Demo operational data",
    short: "Demo",
    blurb: "Fictional figures that ship with the Syntra concept: stage SLA, overdue items, team capacity and processes. They describe no real organisation.",
    Icon: Database,
    chip: "bg-slate-100 text-slate-700",
  },
  simulation: {
    label: "Simulation",
    short: "Simulation",
    blurb: "Runs you started in this session with sample input. They are not operational activity and are cleared on refresh.",
    Icon: FlaskConical,
    chip: "bg-info-soft text-brand-blue",
  },
  definition: {
    label: "Workflow definition",
    short: "Definition",
    blurb: "Facts read straight from a workflow's own steps, connections and settings. Nothing is measured.",
    Icon: GitBranch,
    chip: "bg-cyan-50 text-cyan-800",
  },
};

export const kindLabel: Record<InsightKind, string> = {
  observed: "Observed pattern",
  simulated: "Simulated outcome",
  suggestion: "Suggested improvement",
};

export const priorityInfo: Record<Priority, { label: string; dot: string }> = {
  high: { label: "High priority", dot: "bg-danger" },
  medium: { label: "Medium priority", dot: "bg-warning" },
  low: { label: "Low priority", dot: "bg-slate-400" },
  info: { label: "For information", dot: "bg-brand-blue" },
};

export function SourceChip({ source, short, className }: { source: InsightSource; short?: boolean; className?: string }) {
  const s = sourceInfo[source];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", s.chip, className)}>
      <s.Icon className="size-3" aria-hidden /> {short ? s.short : s.label}
    </span>
  );
}
