import { outgoing } from "@/lib/builder-graph";
import { conditionFields, conditionOperators } from "@/lib/builder-nodes";
import { analyseReadiness, type MemberInfo } from "@/lib/readiness";
import type { SimRun } from "@/lib/simulation";
import type { OperationalProcess, TeamMember, Workflow } from "@/lib/types";
import type { BuilderLayout } from "@/lib/workflow-state";

/**
 * Process insights: explainable observations about how work flows, each carrying the evidence it
 * rests on and where that evidence came from. Everything here is a plain rule over data the app
 * already has. Nothing is predicted, learned or generated, and nothing is invented: when there
 * isn't enough data for a rule, it simply produces nothing and the limitation is reported.
 *
 * Three sources are kept apart, and a count from one is never added to a count from another:
 *  - "demo-operational": the fictional operational figures that ship with the concept (stage SLA,
 *    overdue items, team capacity, processes). They describe no real organisation.
 *  - "simulation": runs recorded this session with sample input. They are not operational activity.
 *  - "definition": facts read straight from a workflow's own graph and settings.
 */

export type InsightSource = "demo-operational" | "simulation" | "definition";
/** An observed pattern, an outcome seen in simulation, or a suggested improvement. */
export type InsightKind = "observed" | "simulated" | "suggestion";
export type Priority = "high" | "medium" | "low" | "info";
export type InsightCategory = "bottleneck" | "capacity" | "risk" | "coverage" | "design" | "quality";

export interface Evidence {
  label: string;
  value: string;
  /** Evidence is labelled individually, so an insight can lean on a definition fact and a demo figure without blurring them. */
  source: InsightSource;
}

export interface InsightAction {
  label: string;
  href: string;
}

export interface Insight {
  /** Stable for the same finding on the same workflow and step. */
  id: string;
  /** The rule that produced it. */
  rule: string;
  category: InsightCategory;
  kind: InsightKind;
  /** Where the main finding comes from. */
  source: InsightSource;
  priority: Priority;
  title: string;
  explanation: string;
  evidence: Evidence[];
  workflowId: string;
  workflowName: string;
  /** The step it concerns, where there is one. */
  nodeId?: string;
  /** What to do next, only where the evidence supports one. */
  suggestion?: string;
  actions: InsightAction[];
}

export interface InsightInput {
  workflows: Workflow[];
  layouts: Record<string, BuilderLayout>;
  /** Simulated runs by workflow id, newest first. */
  runs: Record<string, SimRun[]>;
  processes: OperationalProcess[];
  members: TeamMember[];
}

/** Aggregates of the fictional operational data. Never includes simulation. */
export interface OperationalSummary {
  workflowsReviewed: number;
  activeWorkflows: number;
  stagesNeedingAttention: number;
  overdueItems: number;
  itemsInFlight: number;
  processesAtRisk: number;
  processesTotal: number;
}

/** Aggregates of recorded simulation runs. Never includes operational data. */
export interface SimulationSummary {
  runs: number;
  completed: number;
  blocked: number;
  failed: number;
  stopped: number;
  workflowsWithRuns: number;
  /** Times each Condition branch was taken across runs. */
  yes: number;
  no: number;
}

export interface InsightResult {
  insights: Insight[];
  operational: OperationalSummary;
  /** Null when there are no runs. */
  simulation: SimulationSummary | null;
  /** Plain statements of what the data can't support. */
  limitations: string[];
}

/** A stage's owner counts as stretched at or above this share of capacity (the demo team's own capacity figure). */
export const CAPACITY_THRESHOLD = 85;
/** An SLA compliance under this is below the target shown throughout the demo. */
export const SLA_TARGET = 90;

const order: Record<Priority, number> = { high: 0, medium: 1, low: 2, info: 3 };

const wfLinks = (w: Workflow, nodeId?: string): InsightAction[] => [
  { label: "Open workflow", href: `/workflows/${w.id}` },
  ...(nodeId ? [{ label: "Open step in builder", href: `/workflows/${w.id}/builder?focus=${encodeURIComponent(nodeId)}` }] : []),
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fieldLabel = (id: string | undefined) => conditionFields.find((f) => f.id === id)?.label ?? id ?? "";
const operatorLabel = (id: string | undefined) => conditionOperators.find((o) => o.id === id)?.label ?? id ?? "";

/** Every step reachable by following connections forward from `start`, including `start`. */
function reachable(layout: BuilderLayout, start: string): Set<string> {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const at = stack.pop()!;
    if (seen.has(at)) continue;
    seen.add(at);
    for (const e of outgoing(layout, at)) stack.push(e.to);
  }
  return seen;
}

export function buildInsights(input: InsightInput): InsightResult {
  const found = new Map<string, Insight>();
  const add = (i: Insight) => {
    if (!found.has(i.id)) found.set(i.id, i);
  };
  const memberOf = (id: string) => input.members.find((m) => m.id === id);
  const memberInfo = (id: string): MemberInfo | undefined => memberOf(id);
  /** A stage that is behind, or has trouble gathered in it, whose owner is already stretched. */
  const stretchedOwner = (w: Workflow, stageId: string, nodeId: string | undefined, why: Evidence[]) => {
    const stage = w.stages.find((s) => s.id === stageId);
    const owner = stage && memberOf(stage.ownerId);
    if (!stage || !owner || owner.capacity < CAPACITY_THRESHOLD) return;
    add({
      id: `owner-stretched:${w.id}:${stage.id}`,
      rule: "owner-stretched",
      category: "capacity",
      kind: "suggestion",
      source: "demo-operational",
      priority: "medium",
      title: `${owner.name} is at ${owner.capacity}% capacity on ${stage.name}`,
      explanation: `${stage.name} in ${w.name} is under pressure and its owner already has ${owner.openItems} open items. The delay may come from workload rather than the process itself.`,
      evidence: [{ label: "Owner capacity", value: `${owner.capacity}% (${owner.openItems} open items)`, source: "demo-operational" }, ...why],
      workflowId: w.id,
      workflowName: w.name,
      nodeId,
      suggestion: `Consider sharing ${stage.name} between more than one person, or adjusting how work is assigned, then compare the paths in simulation before changing anything.`,
      actions: wfLinks(w, nodeId),
    });
  };
  const limitations: string[] = [];

  // Created workflows have no operational figures; only seeded ones do.
  const seeded = input.workflows.filter((w) => !w.origin);

  for (const w of seeded) {
    const layout = input.layouts[w.id];
    for (const stage of w.stages) {
      const flagged = stage.health === "attention" || stage.health === "critical";
      const nodeId = layout?.nodes[stage.id] ? stage.id : undefined;

      // Rule: a stage the demo data marks as behind.
      if (flagged && stage.kind !== "complete") {
        add({
          id: `stage-behind:${w.id}:${stage.id}`,
          rule: "stage-behind",
          category: "bottleneck",
          kind: "observed",
          source: "demo-operational",
          priority: stage.health === "critical" ? "high" : "medium",
          title: `${stage.name} is behind in ${w.name}`,
          explanation: `${plural(stage.overdue ?? 0, "item has", "items have")} exceeded the expected time in this stage and SLA compliance is ${stage.sla}%, against a ${SLA_TARGET}% target.`,
          evidence: [
            { label: "SLA compliance", value: `${stage.sla}% (target ${SLA_TARGET}%)`, source: "demo-operational" },
            { label: "Items past expected time", value: String(stage.overdue ?? 0), source: "demo-operational" },
            { label: "Items in the stage", value: `${stage.count} ${stage.countLabel}`, source: "demo-operational" },
            { label: "Typical time in stage", value: `${stage.time} (${stage.timeNote})`, source: "demo-operational" },
          ],
          workflowId: w.id,
          workflowName: w.name,
          nodeId,
          actions: wfLinks(w, nodeId),
        });

        // Rule: the same stage's owner is already stretched.
        stretchedOwner(w, stage.id, nodeId, [
          { label: "Stage SLA compliance", value: `${stage.sla}%`, source: "demo-operational" },
          { label: "Items past expected time", value: String(stage.overdue ?? 0), source: "demo-operational" },
        ]);
      }
    }

    // Rule: a paused workflow still holds work.
    const waiting = w.stages.filter((s) => s.kind !== "complete").reduce((n, s) => n + s.count, 0);
    if (w.status === "paused" && waiting > 0) {
      add({
        id: `paused-with-items:${w.id}:`,
        rule: "paused-with-items",
        category: "risk",
        kind: "observed",
        source: "demo-operational",
        priority: "medium",
        title: `${w.name} is paused with work waiting`,
        explanation: "New items aren't being picked up while a workflow is paused, so work already inside it stays where it is.",
        evidence: [
          { label: "Status", value: "Paused", source: "demo-operational" },
          { label: "Items waiting", value: String(waiting), source: "demo-operational" },
        ],
        workflowId: w.id,
        workflowName: w.name,
        actions: wfLinks(w),
      });
    }

    // Rule: several processes are at risk in the same stage.
    const risky = input.processes.filter((p) => p.workflowId === w.id && p.health !== "on-track");
    const byStage = new Map<string, OperationalProcess[]>();
    for (const p of risky) byStage.set(p.currentStage, [...(byStage.get(p.currentStage) ?? []), p]);
    for (const [stageName, list] of byStage) {
      if (list.length < 2) continue;
      const stage = w.stages.find((s) => s.name === stageName);
      const nodeId = stage && layout?.nodes[stage.id] ? stage.id : undefined;
      add({
        id: `processes-clustered:${w.id}:${stage?.id ?? stageName}`,
        rule: "processes-clustered",
        category: "bottleneck",
        kind: "observed",
        source: "demo-operational",
        priority: list.some((p) => p.health === "blocked") ? "high" : "medium",
        title: `${list.length} processes are at risk in ${stageName}`,
        explanation: `${plural(list.length, "process")} in ${w.name} are blocked, delayed or at risk, and all are currently in ${stageName}. When trouble gathers in one stage, the cause is more likely in that stage than in the individual items.`,
        evidence: list.map((p) => ({ label: `${p.name} (${p.health})`, value: p.note, source: "demo-operational" as const })),
        workflowId: w.id,
        workflowName: w.name,
        nodeId,
        actions: wfLinks(w, nodeId),
      });
      if (stage) stretchedOwner(w, stage.id, nodeId, [{ label: "Processes at risk in the stage", value: String(list.length), source: "demo-operational" }]);
    }
  }

  // Rules that read a workflow's own definition. These apply to every workflow, seeded or created.
  for (const w of input.workflows) {
    const layout = input.layouts[w.id];
    if (!layout) continue;

    for (const id of layout.order) {
      const node = layout.nodes[id];
      if (node?.type !== "approval" || node.config.deadlineHours?.trim()) continue;
      const stage = w.stages.find((s) => s.id === id);
      const evidence: Evidence[] = [{ label: "Deadline (hours)", value: "not set", source: "definition" }];
      let priority: Priority = "low";
      let explanation = `"${node.name}" has no deadline, so an approval that stalls has no time limit and nothing marks it as late.`;
      if (stage && (stage.health === "attention" || stage.health === "critical")) {
        priority = "medium";
        evidence.push({ label: "Items past expected time in this stage", value: String(stage.overdue ?? 0), source: "demo-operational" });
        explanation += ` The demo data also shows this stage behind.`;
      }
      add({
        id: `approval-no-deadline:${w.id}:${id}`,
        rule: "approval-no-deadline",
        category: "design",
        kind: "suggestion",
        source: "definition",
        priority,
        title: `"${node.name}" in ${w.name} has no deadline`,
        explanation,
        evidence,
        workflowId: w.id,
        workflowName: w.name,
        nodeId: id,
        suggestion: "Set a deadline on this approval in the builder. The Approval step has a deadline setting for this.",
        actions: wfLinks(w, id),
      });
    }

    // Rule: one branch of a Condition goes around an approval the other branch goes through.
    for (const id of layout.order) {
      const cond = layout.nodes[id];
      if (cond?.type !== "condition") continue;
      const outs = outgoing(layout, id);
      const yes = outs.find((e) => e.branch === "yes");
      const no = outs.find((e) => e.branch === "no");
      if (!yes || !no) continue;
      const approvals = (from: string) => [...reachable(layout, from)].filter((n) => layout.nodes[n]?.type === "approval");
      const a = approvals(yes.to);
      const b = approvals(no.to);
      const onlyYes = a.filter((n) => !b.includes(n));
      const onlyNo = b.filter((n) => !a.includes(n));
      if ((onlyYes.length > 0) === (onlyNo.length > 0)) continue;
      const skipped = onlyYes.length ? onlyYes : onlyNo;
      const via = onlyYes.length ? "No" : "Yes";
      const through = onlyYes.length ? "Yes" : "No";
      const names = skipped.map((n) => `"${layout.nodes[n].name}"`).join(", ");
      add({
        id: `approval-bypass:${w.id}:${id}`,
        rule: "approval-bypass",
        category: "design",
        kind: "observed",
        source: "definition",
        priority: "info",
        title: `${w.name}: the ${via} path skips approval`,
        explanation: `Requests that take the ${via} path from "${cond.name}" don't go through ${names}. Which requests skip approval depends entirely on that Condition's rule.`,
        evidence: [
          { label: "Condition", value: `${fieldLabel(cond.config.field)} ${operatorLabel(cond.config.operator)} ${cond.config.value || "(no value)"}`, source: "definition" },
          { label: `${through} path`, value: `passes through ${names}`, source: "definition" },
          { label: `${via} path`, value: "does not pass through it", source: "definition" },
        ],
        workflowId: w.id,
        workflowName: w.name,
        nodeId: id,
        suggestion: "Check the rule matches your intent, and compare how different sample inputs are routed using the scenario comparison below.",
        actions: wfLinks(w, id),
      });
    }

    // Rule: setup gaps that stop the workflow being simulated.
    const readiness = analyseReadiness(layout, memberInfo);
    if (!readiness.ready) {
      const first = readiness.errors.find((e) => e.nodeId) ?? readiness.errors[0];
      add({
        id: `not-ready:${w.id}:`,
        rule: "not-ready",
        category: "quality",
        kind: "observed",
        source: "definition",
        priority: "medium",
        title: `${w.name} can't be simulated yet`,
        explanation: `${plural(readiness.errors.length, "setup problem")} must be fixed before this workflow can be simulated, so nothing can be learned from it yet.`,
        evidence: readiness.errors.slice(0, 4).map((e) => ({ label: e.nodeId ? layout.nodes[e.nodeId]?.name ?? "Step" : "Workflow", value: e.short, source: "definition" as const })),
        workflowId: w.id,
        workflowName: w.name,
        nodeId: first?.nodeId ?? undefined,
        suggestion: "Open the builder's readiness panel and work through the list.",
        actions: wfLinks(w, first?.nodeId ?? undefined),
      });
    }
  }

  // Rules over simulation runs. These never read operational data and never feed operational counts.
  const sim: SimulationSummary = { runs: 0, completed: 0, blocked: 0, failed: 0, stopped: 0, workflowsWithRuns: 0, yes: 0, no: 0 };
  for (const w of input.workflows) {
    const runs = input.runs[w.id] ?? [];
    if (runs.length === 0) continue;
    sim.workflowsWithRuns++;
    const branchRuns = { yes: [] as SimRun[], no: [] as SimRun[] };
    for (const r of runs) {
      sim.runs++;
      sim[r.status]++;
      const decisions = r.steps.filter((s) => s.decision?.branch);
      for (const s of decisions) {
        sim[s.decision!.branch!]++;
        branchRuns[s.decision!.branch!].push(r);
      }
    }

    // Rule: only one side of a Condition has been simulated.
    const layout = input.layouts[w.id];
    const cond = layout && layout.order.find((id) => layout.nodes[id]?.type === "condition");
    if (cond && (branchRuns.yes.length > 0) !== (branchRuns.no.length > 0)) {
      const seen = branchRuns.yes.length ? "Yes" : "No";
      const unseen = branchRuns.yes.length ? "No" : "Yes";
      const seenRuns = (branchRuns.yes.length ? branchRuns.yes : branchRuns.no).length;
      add({
        id: `branch-unexercised:${w.id}:${cond}`,
        rule: "branch-unexercised",
        category: "coverage",
        kind: "simulated",
        source: "simulation",
        priority: "low",
        title: `The ${unseen} path of "${layout.nodes[cond].name}" hasn't been simulated`,
        explanation: `${plural(seenRuns, "simulated run")} in ${w.name} took the ${seen} path. Nothing recorded shows how the ${unseen} path behaves.`,
        evidence: [
          { label: `Runs on the ${seen} path`, value: String(seenRuns), source: "simulation" },
          { label: `Runs on the ${unseen} path`, value: "0", source: "simulation" },
          { label: "Runs recorded for this workflow", value: String(runs.length), source: "simulation" },
        ],
        workflowId: w.id,
        workflowName: w.name,
        nodeId: cond,
        suggestion: `Run the simulation again with a sample input that takes the ${unseen} path.`,
        actions: [...wfLinks(w, cond).slice(0, 1), { label: "Open simulation", href: `/workflows/${w.id}#simulation` }],
      });
    }

    // Rule: the same step keeps stopping runs.
    const stops = new Map<string, SimRun[]>();
    for (const r of runs) {
      if (r.status !== "blocked" && r.status !== "failed") continue;
      const last = r.steps[r.steps.length - 1];
      if (last) stops.set(last.nodeId, [...(stops.get(last.nodeId) ?? []), r]);
    }
    for (const [nodeId, list] of stops) {
      if (list.length < 2) continue;
      const last = list[0].steps[list[0].steps.length - 1];
      add({
        id: `repeated-stop:${w.id}:${nodeId}`,
        rule: "repeated-stop",
        category: "risk",
        kind: "simulated",
        source: "simulation",
        priority: "medium",
        title: `${list.length} simulated runs stopped at "${last.nodeName}"`,
        explanation: `Of ${plural(runs.length, "simulated run")} in ${w.name}, ${list.length} ended at the same step without reaching the End. This describes the sample inputs used, not real activity.`,
        evidence: [
          { label: "Runs that stopped here", value: `${list.length} of ${runs.length}`, source: "simulation" },
          { label: "Reason given", value: list[0].error ?? "Stopped before the End", source: "simulation" },
          { label: "Run ids", value: list.map((r) => r.id).slice(0, 3).join(", "), source: "simulation" },
        ],
        workflowId: w.id,
        workflowName: w.name,
        nodeId: layout?.nodes[nodeId] ? nodeId : undefined,
        suggestion: "Check the sample input, or the step's settings, then simulate again.",
        actions: [...wfLinks(w, layout?.nodes[nodeId] ? nodeId : undefined), { label: "Open simulation", href: `/workflows/${w.id}#simulation` }],
      });
    }
  }

  // Summaries. Operational figures come only from the demo data, simulation only from runs.
  const flaggedStages = seeded.flatMap((w) => w.stages.filter((s) => s.kind !== "complete" && (s.health === "attention" || s.health === "critical")));
  const operational: OperationalSummary = {
    workflowsReviewed: seeded.length,
    activeWorkflows: seeded.filter((w) => w.status === "active").length,
    stagesNeedingAttention: flaggedStages.length,
    overdueItems: flaggedStages.reduce((n, s) => n + (s.overdue ?? 0), 0),
    itemsInFlight: seeded.reduce((n, w) => n + w.stages.filter((s) => s.kind !== "complete").reduce((m, s) => m + s.count, 0), 0),
    processesAtRisk: input.processes.filter((p) => p.health !== "on-track").length,
    processesTotal: input.processes.length,
  };

  const created = input.workflows.length - seeded.length;
  if (created > 0) limitations.push(`${plural(created, "workflow")} created this session ${created === 1 ? "has" : "have"} no operational figures, so only definition and simulation insights can apply to ${created === 1 ? "it" : "them"}.`);
  const noRuns = input.workflows.filter((w) => (input.runs[w.id] ?? []).length === 0).length;
  if (sim.runs === 0) limitations.push("No simulated runs exist yet, so there are no simulation insights. Simulations are recorded for this session only.");
  else if (noRuns > 0) limitations.push(`${plural(noRuns, "workflow")} ${noRuns === 1 ? "has" : "have"} no simulated runs, so no simulation insight is possible for ${noRuns === 1 ? "it" : "them"}.`);
  limitations.push("Operational figures are fictional demo data for the Syntra concept. Insights drawn from them describe the demo, not a real organisation.");

  const insights = [...found.values()].sort((a, b) => order[a.priority] - order[b.priority] || input.workflows.findIndex((w) => w.id === a.workflowId) - input.workflows.findIndex((w) => w.id === b.workflowId) || a.id.localeCompare(b.id));
  return { insights, operational, simulation: sim.runs > 0 ? sim : null, limitations };
}
