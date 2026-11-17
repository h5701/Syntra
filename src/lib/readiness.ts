import { analyseGraph, incoming, outgoing, type GraphIssue } from "@/lib/builder-graph";
import { actionKinds, conditionFields, conditionOperators, delayUnits, recipientTypes, triggerEvents, type BuilderNodeData } from "@/lib/builder-nodes";
import type { BuilderLayout } from "@/lib/workflow-state";

/**
 * Execution readiness: is this workflow set up well enough to simulate? It builds on the graph
 * checks the builder already runs (structure, and the settings that block applying an edit) and
 * adds the per-step settings the builder marks "Needs setup". It invents no new fields and runs
 * nothing: a ready workflow is simply one the simulation can walk without hitting a setup gap.
 *
 * Errors block a simulation. Warnings are worth a look but never block.
 * Problems with the sample input (a missing value, a number that isn't one) are not here: those
 * belong to a particular run, and the simulation reports them as a blocked run.
 */

export type Severity = "error" | "warning";

export interface ReadinessIssue {
  /** Stable for the same problem on the same step, whatever else changes. */
  id: string;
  severity: Severity;
  /** Structure is how steps connect, configuration is a step's own settings, advisory is a warning. */
  kind: "structure" | "configuration" | "advisory";
  /** The step to go to. Null for a problem with the workflow as a whole. */
  nodeId: string | null;
  /** A full sentence that names the step. */
  message: string;
  /** The same without the step's name, for showing on the step itself. */
  short: string;
  /** True if this also stops the builder saving. Saving needs a sound graph; simulating needs every step set up too. */
  blocksSave: boolean;
}

export interface Readiness {
  issues: ReadinessIssue[];
  errors: ReadinessIssue[];
  warnings: ReadinessIssue[];
  /** No errors. Warnings don't count against it. */
  ready: boolean;
  byNode: Record<string, ReadinessIssue[]>;
}

/** What readiness needs to know about a team member. */
export interface MemberInfo {
  name: string;
  status: "active" | "away" | "inactive";
}

const known = (list: { id: string }[], id: string | undefined) => !!id && list.some((x) => x.id === id);
const isNumber = (s: string | undefined) => !!s?.trim() && Number.isFinite(Number(s));

/** Structural symptoms that only repeat a root cause already reported are dropped, so one mistake gives one error. */
function withoutSymptoms(layout: BuilderLayout, issues: GraphIssue[]): GraphIssue[] {
  const has = (...codes: string[]) => issues.some((i) => codes.includes(i.code));
  // Anything upstream of a dead end or a loop "has no path to the End"; the dead end is the real problem.
  const explained = has("no-next", "no-branch-yes", "no-branch-no", "loop", "self-loop", "end-missing", "end-many");
  const unreachable = new Set(issues.filter((i) => i.code === "unreachable").map((i) => i.nodeId));
  return issues.filter((i) => {
    if (i.code === "no-path-to-end" && explained) return false;
    // Only the first unreachable step of a stranded stretch is reported; the rest follow from it.
    if (i.code === "unreachable" && i.nodeId && incoming(layout, i.nodeId).some((e) => unreachable.has(e.from))) return false;
    return true;
  });
}

/** The per-step setting problems. Each rule comes from what the builder already asks for or the simulation already needs. */
function configIssues(id: string, node: BuilderNodeData, member: (id: string) => MemberInfo | undefined): { code: string; short: string }[] {
  const c = node.config;
  const out: { code: string; short: string }[] = [];
  const add = (code: string, short: string) => out.push({ code, short });
  const person = (code: string, memberId: string | undefined, missing: string) => {
    if (!(memberId && member(memberId))) add(code, missing);
  };
  switch (node.type) {
    case "trigger":
      if (!known(triggerEvents, c.event)) add("event", "Choose one of the available trigger events");
      if (!c.detail?.trim()) add("detail", "Add the trigger detail");
      break;
    case "action":
      if (!known(actionKinds, c.action)) add("action", "Choose what this action does");
      if (c.action === "create-task" && !c.title?.trim()) add("title", "Add a task title");
      if (c.action === "update-record" && !c.value?.trim()) add("value", "Add the new value");
      if (c.action === "assign-owner") person("owner", c.ownerId, "Choose an owner");
      if (c.action === "send-message" && !c.message?.trim()) add("message", "Write the message");
      break;
    case "condition":
      if (!known(conditionFields, c.field)) add("field", "Choose the field to check");
      if (!known(conditionOperators, c.operator)) add("operator", "Choose how to compare");
      if (!c.value?.trim()) add("value", "Add a value to compare against");
      else if ((c.operator === "greater-than" || c.operator === "less-than") && !isNumber(c.value)) add("value-number", "Use a number to compare against");
      break;
    case "approval":
      person("approver", c.approverId, "Choose an approver");
      break;
    case "delay":
      if (c.unit && !known(delayUnits, c.unit)) add("unit", "Choose minutes, hours or days");
      break;
    case "notification":
      if (!known(recipientTypes, c.recipientType)) add("recipient-type", "Choose who receives it");
      if (!c.message?.trim()) add("message", "Write the message");
      if (c.recipientType === "member") person("recipient", c.memberId, "Choose a recipient");
      break;
    case "end":
      if (!c.outcome?.trim()) add("outcome", "Name the outcome");
      break;
  }
  void id;
  return out;
}

/** Things that are valid but deserve a look. Each is grounded in team data or how the simulation behaves. */
function advisories(layout: BuilderLayout, id: string, node: BuilderNodeData, member: (id: string) => MemberInfo | undefined): { code: string; short: string }[] {
  const c = node.config;
  const out: { code: string; short: string }[] = [];
  const check = (code: string, memberId: string | undefined, role: string) => {
    const m = memberId ? member(memberId) : undefined;
    if (m && m.status !== "active") out.push({ code, short: `${role} ${m.name} is ${m.status === "away" ? "away" : "inactive"}` });
  };
  if (node.type === "approval") check("approver-status", c.approverId, "Approver");
  if (node.type === "action" && c.action === "assign-owner") check("owner-status", c.ownerId, "Owner");
  if (node.type === "notification" && c.recipientType === "member") check("recipient-status", c.memberId, "Recipient");
  if (node.type === "condition") {
    const outs = outgoing(layout, id);
    const yes = outs.find((e) => e.branch === "yes");
    const no = outs.find((e) => e.branch === "no");
    if (yes && no && yes.to === no.to) out.push({ code: "same-destination", short: "Yes and No lead to the same step, so this check changes nothing" });
  }
  return out;
}

/** Everything standing between this workflow and a simulation, plus anything worth a second look. */
export function analyseReadiness(layout: BuilderLayout, member: (id: string) => MemberInfo | undefined = () => undefined): Readiness {
  const graph = analyseGraph(layout);
  const issues: ReadinessIssue[] = [];
  const seen = new Set<string>();
  const push = (i: ReadinessIssue) => {
    if (seen.has(i.id)) return;
    seen.add(i.id);
    issues.push(i);
  };
  const nameOf = (id: string) => layout.nodes[id]?.name ?? id;

  for (const g of withoutSymptoms(layout, graph.issues)) {
    push({ id: g.id, severity: "error", kind: g.category, nodeId: g.nodeId, message: g.message, short: g.short, blocksSave: true });
  }
  for (const id of layout.order) {
    const node = layout.nodes[id];
    if (!node) continue;
    for (const c of configIssues(id, node, member)) push({ id: `config:${c.code}:${id}`, severity: "error", kind: "configuration", nodeId: id, message: `"${nameOf(id)}": ${c.short}.`, short: c.short, blocksSave: false });
    for (const w of advisories(layout, id, node, member)) push({ id: `advice:${w.code}:${id}`, severity: "warning", kind: "advisory", nodeId: id, message: `"${nameOf(id)}": ${w.short}.`, short: w.short, blocksSave: false });
  }

  // Errors first; within a severity, steps in path order and workflow-level problems at the top.
  const position = (i: ReadinessIssue) => (i.nodeId ? layout.order.indexOf(i.nodeId) : -1);
  issues.sort((a, b) => (a.severity === b.severity ? position(a) - position(b) : a.severity === "error" ? -1 : 1));

  const byNode: Record<string, ReadinessIssue[]> = {};
  for (const i of issues) if (i.nodeId) (byNode[i.nodeId] ??= []).push(i);
  const errors = issues.filter((i) => i.severity === "error");
  return { issues, errors, warnings: issues.filter((i) => i.severity === "warning"), ready: errors.length === 0, byNode };
}
