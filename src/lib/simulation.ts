import { defaultPositions } from "@/lib/builder-layout";
import { linearEdges, outgoing, validateGraph, withEdges } from "@/lib/builder-graph";
import { conditionFields, conditionOperators, seedNodeData, summarise, type Branch, type BuilderNodeData, type NodeType } from "@/lib/builder-nodes";
import type { Workflow } from "@/lib/types";
import type { BuilderLayout } from "@/lib/workflow-state";

/**
 * The run simulation. It walks a workflow's saved graph with sample input and records what a run
 * would do. Nothing is executed, sent or changed: no network, no randomness, no clocks. The same
 * graph and input always give the same path and the same timeline.
 *
 * A run is planned in one pass (`planRun`) and the interface reveals it step by step, so manual
 * stepping, pausing and stopping are just a matter of how much of the plan is shown.
 */

/** Sample values, keyed by the Condition field ids they feed (priority, status, type, value). */
export type SampleInput = Record<string, string>;

export type StepOutcome = "done" | "branch" | "ended" | "blocked" | "failed";

/** Why a Condition went the way it did. Everything shown in the decision panel comes from here. */
export interface Decision {
  field: string;
  fieldLabel: string;
  operator: string;
  operatorLabel: string;
  /** The value configured on the Condition. */
  expected: string;
  /** The sample value that was compared, or null if there wasn't one. */
  actual: string | null;
  /** True means Yes, false means No, null means it could not be decided. */
  result: boolean | null;
  branch?: Branch;
  toName?: string;
  problem?: string;
}

export interface RunStep {
  index: number;
  nodeId: string;
  nodeName: string;
  type: NodeType;
  outcome: StepOutcome;
  /** The connection followed to arrive here. */
  viaEdgeId?: string;
  viaBranch?: Branch;
  /** Simulated seconds since the run started. Fixed per step type, never wall-clock time. */
  elapsed: number;
  explanation: string;
  decision?: Decision;
}

export type RunStatus = "completed" | "blocked" | "failed" | "stopped";

export type Plan =
  | { ok: false; problems: string[] }
  | { ok: true; status: Exclude<RunStatus, "stopped">; steps: RunStep[]; error?: string };

/** A finished run, with the graph as it was when the run happened. */
export interface SimRun {
  id: string;
  workflowId: string;
  /** The name at the time of the run. */
  workflowName: string;
  startedAt: string;
  input: SampleInput;
  status: RunStatus;
  /** Only the steps that were reached. */
  steps: RunStep[];
  /** Steps in the full plan. For a stopped run this is more than `steps.length`. */
  plannedSteps: number;
  error?: string;
  snapshot: BuilderLayout;
}

const labelOf = (list: { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id;

/** Seconds a step takes in the simulation. Waits are never actually waited for. */
const STEP_SECONDS: Record<NodeType, number> = { trigger: 0, action: 3, approval: 5, delay: 2, notification: 1, condition: 1, end: 0 };

export const formatElapsed = (s: number) => `T+${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const numeric = (s: string) => (s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : null);

type Evaluation = { result: boolean } | { problem: string; kind: "blocked" | "failed" };

/** Compares one sample value with a Condition's configured value, using only the operators the builder offers. */
export function evaluateCondition(operator: string, fieldLabel: string, actual: string | undefined, expected: string): Evaluation {
  if (!conditionOperators.some((o) => o.id === operator)) return { kind: "failed", problem: `The operator "${operator}" isn't supported by the simulation, so the Condition can't be evaluated.` };
  if (!expected.trim()) return { kind: "failed", problem: "This Condition has no comparison value. Set one in the builder." };
  if (actual === undefined || !actual.trim()) return { kind: "blocked", problem: `No sample value was given for "${fieldLabel}", so the Condition can't choose a branch.` };
  const a = actual.trim();
  const e = expected.trim();
  const an = numeric(a);
  const en = numeric(e);
  switch (operator) {
    case "greater-than":
    case "less-than": {
      if (en === null) return { kind: "failed", problem: `This Condition compares with "${e}", which isn't a number, so "${labelOf(conditionOperators, operator)}" can't be applied.` };
      if (an === null) return { kind: "blocked", problem: `"${fieldLabel}" needs a number for this comparison, but the sample value is "${a}".` };
      return { result: operator === "greater-than" ? an > en : an < en };
    }
    case "equals":
    case "not-equals": {
      const same = an !== null && en !== null ? an === en : a.toLowerCase() === e.toLowerCase();
      return { result: operator === "equals" ? same : !same };
    }
    default:
      return { result: a.toLowerCase().includes(e.toLowerCase()) };
  }
}

/** The graph a workflow runs on: its saved builder graph, or the default one built from its stages. */
export function layoutFor(workflow: Workflow, saved: BuilderLayout | undefined): BuilderLayout {
  if (saved) return withEdges(saved);
  const order = workflow.stages.map((s) => s.id);
  return {
    positions: defaultPositions(workflow.stages),
    order,
    nodes: Object.fromEntries(workflow.stages.map((s) => [s.id, seedNodeData(s)])),
    edges: linearEdges(order),
  };
}

/** The Condition fields a graph needs sample values for, in the order they are reached. */
export function conditionFieldsIn(layout: BuilderLayout): string[] {
  const out: string[] = [];
  for (const id of layout.order) {
    const n = layout.nodes[id];
    if (n?.type === "condition" && n.config.field && !out.includes(n.config.field)) out.push(n.config.field);
  }
  return out;
}

function describe(node: BuilderNodeData, nameOf: (id: string) => string | undefined): string {
  const line = summarise(node, nameOf);
  switch (node.type) {
    case "trigger": return `Simulated start. ${line}. No real event occurred.`;
    case "action": return `Simulated step, nothing was changed. ${line}.`;
    case "approval": return `Simulation assumes this approval is granted. No request was sent. ${line}.`;
    case "delay": return `Wait skipped in the simulation. ${line}.`;
    case "notification": return `No message was sent. ${line}.`;
    case "end": return `Reached the End. Outcome: ${node.config.outcome?.trim() || "not named"}.`;
    case "condition": return "";
  }
}

/**
 * Plans a run. Invalid graphs are rejected before any step is taken. Otherwise the result always
 * ends: at the End (completed), at a Condition the input can't decide (blocked), or at a problem
 * with the graph or configuration (failed). A step limit and a visited check stop malformed
 * graphs from looping.
 */
export function planRun(layout: BuilderLayout, input: SampleInput, nameOf: (id: string) => string | undefined = () => undefined): Plan {
  const problems = validateGraph(layout);
  if (problems.length > 0) return { ok: false, problems };
  const start = Object.keys(layout.nodes).find((id) => layout.nodes[id].type === "trigger");
  if (!start) return { ok: false, problems: ["The workflow has no Trigger to start from."] };

  const steps: RunStep[] = [];
  const seen = new Set<string>();
  const limit = Object.keys(layout.nodes).length + 1;
  let current: string | undefined = start;
  let elapsed = 0;
  let via: { edgeId: string; branch?: Branch } | undefined;

  const push = (step: Omit<RunStep, "index" | "viaEdgeId" | "viaBranch" | "elapsed"> & { elapsed?: number }) =>
    steps.push({ ...step, index: steps.length, elapsed: step.elapsed ?? elapsed, viaEdgeId: via?.edgeId, viaBranch: via?.branch });
  const finish = (status: Exclude<RunStatus, "stopped">, error?: string): Plan => ({ ok: true, status, steps, ...(error ? { error } : {}) });

  while (current) {
    const node: BuilderNodeData | undefined = layout.nodes[current];
    if (!node) return finish("failed", "A connection points at a step that doesn't exist.");
    if (seen.has(current) || steps.length >= limit) {
      push({ nodeId: current, nodeName: node.name, type: node.type, outcome: "failed", explanation: "The path came back to a step it had already visited, so the simulation stopped." });
      return finish("failed", "The path loops back on itself.");
    }
    seen.add(current);
    elapsed += STEP_SECONDS[node.type];

    if (node.type === "end") {
      push({ nodeId: current, nodeName: node.name, type: "end", outcome: "ended", explanation: describe(node, nameOf) });
      return finish("completed");
    }

    const outs = outgoing(layout, current);
    if (node.type !== "condition") {
      push({ nodeId: current, nodeName: node.name, type: node.type, outcome: "done", explanation: describe(node, nameOf) });
      if (outs.length !== 1) return finish("failed", `"${node.name}" has ${outs.length === 0 ? "no next step" : "more than one next step"}.`);
      via = { edgeId: outs[0].id };
      current = outs[0].to;
      continue;
    }

    const c = node.config;
    const field = c.field ?? "";
    const fieldLabel = labelOf(conditionFields, field);
    const operator = c.operator ?? "";
    const operatorLabel = labelOf(conditionOperators, operator);
    const expected = c.value ?? "";
    const actualRaw = input[field];
    const base = { field, fieldLabel, operator, operatorLabel, expected, actual: actualRaw?.trim() ? actualRaw.trim() : null };
    const ev = evaluateCondition(operator, fieldLabel, actualRaw, expected);

    if ("problem" in ev) {
      push({ nodeId: current, nodeName: node.name, type: "condition", outcome: ev.kind, explanation: ev.problem, decision: { ...base, result: null, problem: ev.problem } });
      return finish(ev.kind, ev.problem);
    }
    const branch: Branch = ev.result ? "yes" : "no";
    const edge = outs.find((e) => e.branch === branch);
    if (!edge) {
      const msg = `"${node.name}" has no ${branch === "yes" ? "Yes" : "No"} connection.`;
      push({ nodeId: current, nodeName: node.name, type: "condition", outcome: "failed", explanation: msg, decision: { ...base, result: ev.result, problem: msg } });
      return finish("failed", msg);
    }
    const toName = layout.nodes[edge.to]?.name ?? edge.to;
    push({
      nodeId: current,
      nodeName: node.name,
      type: "condition",
      outcome: "branch",
      explanation: `${fieldLabel} (${base.actual}) ${operatorLabel} ${expected} is ${ev.result ? "true" : "false"}, so the ${branch === "yes" ? "Yes" : "No"} path was followed to "${toName}".`,
      decision: { ...base, result: ev.result, branch, toName },
    });
    via = { edgeId: edge.id, branch };
    current = edge.to;
  }
  return finish("failed", "The path ended without reaching an End.");
}

/** Example sample data for each template's Condition. Illustrative only. */
export interface SampleExample {
  label: string;
  note: string;
  values: SampleInput;
}

export const sampleExamples: Record<string, SampleExample[]> = {
  "client-onboarding": [
    { label: "Complete details", note: "Takes the Yes path", values: { status: "Complete" } },
    { label: "Missing details", note: "Takes the No path", values: { status: "Incomplete" } },
  ],
  "purchase-approval": [
    { label: "Larger purchase", note: "Above the example threshold", values: { value: "7500" } },
    { label: "Smaller purchase", note: "Below the example threshold", values: { value: "1200" } },
  ],
  "employee-onboarding": [
    { label: "Office-based", note: "Takes the Yes path", values: { type: "Office-based" } },
    { label: "Remote", note: "Takes the No path", values: { type: "Remote" } },
  ],
  "support-request": [
    { label: "High priority", note: "Takes the Yes path", values: { priority: "High" } },
    { label: "Low priority", note: "Takes the No path", values: { priority: "Low" } },
  ],
};

/** Starting value for a sample field: the first example's value if it has one, otherwise the builder's example. */
export function defaultSample(field: string, templateId: string | null | undefined): string {
  const fromTemplate = templateId ? sampleExamples[templateId]?.[0]?.values[field] : undefined;
  return fromTemplate ?? conditionFields.find((f) => f.id === field)?.example ?? "";
}
