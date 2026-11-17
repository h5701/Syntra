import { conditionFields, conditionOperators } from "@/lib/builder-nodes";
import { planRun, type RunStatus } from "@/lib/simulation";
import type { BuilderLayout } from "@/lib/workflow-state";

/**
 * Scenario comparison: the same sample inputs run through a workflow as it is and through a copy
 * with one Condition's comparison value changed. Both runs use the simulation engine, so the result
 * is which path each input would take and which steps it would meet. It is not a forecast: it says
 * nothing about real volumes, durations or outcomes, and the saved workflow is never touched.
 */

export interface PathOutcome {
  status: Exclude<RunStatus, "stopped"> | "rejected";
  /** Names of the steps visited, in order. */
  path: string[];
  /** The branch taken at the changed Condition, if it was reached and decided. */
  branch?: "yes" | "no";
  approvals: number;
  /** Simulated seconds. Fixed per step type, not a real duration. */
  elapsed: number;
  note?: string;
}

export interface ScenarioRow {
  input: string;
  original: PathOutcome;
  modified: PathOutcome;
  /** The two inputs took different routes through the workflow. */
  changed: boolean;
}

export interface Comparison {
  conditionId: string;
  field: string;
  originalValue: string;
  modifiedValue: string;
  rows: ScenarioRow[];
  changedCount: number;
  /** Approvals met across all inputs, original then modified. */
  approvalsOriginal: number;
  approvalsModified: number;
}

function outcome(layout: BuilderLayout, conditionId: string, field: string, input: string): PathOutcome {
  const plan = planRun(layout, { [field]: input });
  if (!plan.ok) return { status: "rejected", path: [], approvals: 0, elapsed: 0, note: plan.problems[0] };
  const at = plan.steps.find((s) => s.nodeId === conditionId)?.decision;
  return {
    status: plan.status,
    path: plan.steps.map((s) => s.nodeName),
    branch: at?.branch,
    approvals: plan.steps.filter((s) => s.type === "approval").length,
    elapsed: plan.steps[plan.steps.length - 1]?.elapsed ?? 0,
    ...(plan.error ? { note: plan.error } : {}),
  };
}

const sameRoute = (a: PathOutcome, b: PathOutcome) => a.status === b.status && a.path.join("\u0000") === b.path.join("\u0000");

/** Conditions a comparison can change: those that name a field and have a comparison value. */
export function comparableConditions(layout: BuilderLayout): { id: string; name: string; field: string; rule: string; value: string }[] {
  return layout.order.flatMap((id) => {
    const n = layout.nodes[id];
    if (n?.type !== "condition" || !conditionFields.some((f) => f.id === n.config.field)) return [];
    const op = conditionOperators.find((o) => o.id === n.config.operator)?.label ?? n.config.operator ?? "";
    return [{ id, name: n.name, field: n.config.field!, rule: `${conditionFields.find((f) => f.id === n.config.field)!.label} ${op}`, value: n.config.value ?? "" }];
  });
}

/** Splits a comma or line separated list of sample inputs, dropping blanks and repeats. */
export function parseInputs(text: string): string[] {
  return [...new Set(text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))];
}

export function compareScenarios(layout: BuilderLayout, conditionId: string, modifiedValue: string, inputs: string[]): Comparison | null {
  const node = layout.nodes[conditionId];
  if (node?.type !== "condition" || !node.config.field) return null;
  const field = node.config.field;
  // The changed copy is a separate object, so the workflow itself is never edited.
  const copy = JSON.parse(JSON.stringify(layout)) as BuilderLayout;
  copy.nodes[conditionId].config.value = modifiedValue;
  const rows = inputs.map((input): ScenarioRow => {
    const original = outcome(layout, conditionId, field, input);
    const modified = outcome(copy, conditionId, field, input);
    return { input, original, modified, changed: !sameRoute(original, modified) };
  });
  return {
    conditionId,
    field,
    originalValue: node.config.value ?? "",
    modifiedValue,
    rows,
    changedCount: rows.filter((r) => r.changed).length,
    approvalsOriginal: rows.reduce((n, r) => n + r.original.approvals, 0),
    approvalsModified: rows.reduce((n, r) => n + r.modified.approvals, 0),
  };
}
