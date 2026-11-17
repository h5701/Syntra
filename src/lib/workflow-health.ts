import type { Workflow, WorkflowStage } from "@/lib/types";

export interface WorkflowHealth {
  tone: "success" | "warning" | "danger" | "neutral";
  title: string;
  sentence: string;
  overdue: number;
  inFlight: number;
  /** The stage that deserves attention first: the worst one, otherwise where most work sits. */
  currentStageId: string | null;
  currentReason: "bottleneck" | "busiest" | null;
}

const flagged = (s: WorkflowStage) => s.health === "attention" || s.health === "critical";

export const inFlightCount = (w: Pick<Workflow, "stages">) =>
  w.stages.filter((s) => s.kind !== "complete").reduce((n, s) => n + s.count, 0);

export function analyseWorkflow(w: Workflow): WorkflowHealth {
  const open = w.stages.filter((s) => s.kind !== "complete");
  const inFlight = inFlightCount(w);
  const bad = open.filter(flagged);
  const overdue = bad.reduce((n, s) => n + (s.overdue ?? 0), 0);
  const worst = bad.find((s) => s.health === "critical") ?? bad[0];
  const busiest = [...open].sort((a, b) => b.count - a.count)[0];

  const current =
    w.status !== "active" || inFlight === 0
      ? { id: null, reason: null as WorkflowHealth["currentReason"] }
      : worst
        ? { id: worst.id, reason: "bottleneck" as const }
        : { id: busiest.id, reason: "busiest" as const };

  const base = { overdue, inFlight, currentStageId: current.id, currentReason: current.reason };

  if (w.status === "draft")
    return { ...base, tone: "neutral", title: "Not running yet", sentence: "This workflow is a draft. Set it to Active to start picking up work." };
  if (w.status === "paused")
    return {
      ...base,
      tone: "warning",
      title: "Paused",
      sentence: inFlight > 0 ? `No new items are being picked up. ${inFlight} items are waiting where they are.` : "No new items are being picked up.",
    };
  if (worst?.health === "critical")
    return { ...base, tone: "danger", title: "At risk", sentence: `${overdue} ${overdue === 1 ? "item has" : "items have"} exceeded the expected processing time in ${worst.name}.` };
  if (worst)
    return { ...base, tone: "warning", title: "Needs attention", sentence: `${overdue} ${overdue === 1 ? "item has" : "items have"} exceeded the expected processing time, mostly in ${worst.name}.` };
  return { ...base, tone: "success", title: "Healthy", sentence: "Most items are progressing normally." };
}

/** One vocabulary for stage status everywhere, derived from health rather than free text. */
export const stageStatusLabel: Record<WorkflowStage["health"], string> = {
  healthy: "Healthy",
  attention: "Needs attention",
  critical: "At risk",
  idle: "Idle",
  done: "Completed",
};
