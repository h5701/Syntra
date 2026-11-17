import { NODE_H, NODE_W, type Pos } from "@/lib/builder-layout";
import { branches, newNodeData, validate, type Branch, type BuilderEdge, type NodeType } from "@/lib/builder-nodes";
import type { BuilderLayout } from "@/lib/workflow-state";

/**
 * The workflow graph. Steps are nodes and connections are explicit edges, each with its own id,
 * a source, a target and, for a Condition's two outgoing paths, a branch (Yes or No).
 *
 * Supported shape: one Trigger with nothing leading into it, one End with nothing leaving it,
 * ordinary steps with exactly one way out, and Conditions with exactly one Yes and one No. Paths
 * may split at a Condition and join again at any later step. Loops are not allowed.
 * Every operation here returns a new graph and never mutates its input.
 */

const STEP = NODE_W + 88;
let nodeSeq = 1;
let edgeSeq = 1;

export const branchName = (b?: Branch) => branches.find((x) => x.id === b)?.label;

/** Id for a connection between two original stages, so the same graph always has the same ids. */
export const defaultEdgeId = (from: string, to: string) => `e-${from}__${to}`;

/** The straight-line connections of a path, in order. Used for default graphs and for upgrading older ones. */
export function linearEdges(order: string[]): BuilderEdge[] {
  return order.slice(0, -1).map((id, i) => ({ id: defaultEdgeId(id, order[i + 1]), from: id, to: order[i + 1] }));
}

/** Upgrades a graph saved before connections were explicit by deriving them from the path order. */
export function withEdges(layout: Omit<BuilderLayout, "edges"> & { edges?: BuilderEdge[] }): BuilderLayout {
  if (layout.edges) return layout as BuilderLayout;
  const edges = linearEdges(layout.order).filter((e) => layout.nodes[e.from]?.type !== "end");
  return { ...layout, edges };
}

export const outgoing = (layout: BuilderLayout, id: string) => layout.edges.filter((e) => e.from === id);
export const incoming = (layout: BuilderLayout, id: string) => layout.edges.filter((e) => e.to === id);

/** True if a path leads from `a` to `b`. */
export function reaches(layout: BuilderLayout, a: string, b: string): boolean {
  const seen = new Set<string>();
  const stack = [a];
  while (stack.length) {
    const at = stack.pop()!;
    if (at === b) return true;
    if (seen.has(at)) continue;
    seen.add(at);
    for (const e of layout.edges) if (e.from === at) stack.push(e.to);
  }
  return false;
}

/** Lists steps in path order: a step always comes after the steps that lead to it. Ties keep their previous order. */
export function topoOrder(layout: BuilderLayout): string[] {
  const rank = new Map(layout.order.map((id, i) => [id, i]));
  const ids = Object.keys(layout.nodes).sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9));
  const indeg = new Map(ids.map((id) => [id, 0]));
  for (const e of layout.edges) if (indeg.has(e.to) && indeg.has(e.from)) indeg.set(e.to, indeg.get(e.to)! + 1);
  const out: string[] = [];
  const ready = ids.filter((id) => indeg.get(id) === 0);
  while (ready.length) {
    ready.sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9));
    const id = ready.shift()!;
    out.push(id);
    for (const e of layout.edges) {
      if (e.from !== id || !indeg.has(e.to)) continue;
      indeg.set(e.to, indeg.get(e.to)! - 1);
      if (indeg.get(e.to) === 0) ready.push(e.to);
    }
  }
  // Anything left is part of a loop; keep it listed so nothing disappears.
  for (const id of ids) if (!out.includes(id)) out.push(id);
  return out;
}

const normalise = (layout: BuilderLayout): BuilderLayout => ({ ...layout, order: topoOrder(layout) });

/** Why a step type can't be added right now, or null if it can. */
export function unavailableReason(layout: BuilderLayout, type: NodeType): string | null {
  const existing = Object.keys(layout.nodes).find((id) => layout.nodes[id].type === type);
  if (type === "trigger" && existing) return `This workflow already starts with "${layout.nodes[existing].name}". One trigger is supported for now.`;
  if (type === "end" && existing) return `This workflow already finishes at "${layout.nodes[existing].name}". One End is supported for now.`;
  return null;
}

/* ---- Connections ---- */

/** Why `from` can't connect to `to` (on `branch`), or null if it can. */
export function connectRefusal(layout: BuilderLayout, from: string, branch: Branch | undefined, to: string): string | null {
  const a = layout.nodes[from];
  const b = layout.nodes[to];
  if (!a || !b) return "Choose a step that exists.";
  if (from === to) return "A step can't connect to itself.";
  if (a.type === "end") return `"${a.name}" is the End, so nothing can follow it.`;
  if (b.type === "trigger") return `Nothing can lead into the trigger "${b.name}".`;
  if (a.type === "condition" && !branch) return "Choose whether this is the Yes or the No path.";
  if (a.type !== "condition" && branch) return "Only a Condition has Yes and No paths.";
  if (reaches(layout, to, from)) return `Connecting "${a.name}" to "${b.name}" would make the workflow loop back on itself.`;
  if (layout.edges.some((e) => e.from === from && e.to === to && e.branch === branch)) return `"${a.name}" already connects to "${b.name}".`;
  return null;
}

/** Steps `from` could connect to on `branch`. */
export function connectTargets(layout: BuilderLayout, from: string, branch?: Branch): { id: string; name: string }[] {
  return layout.order.filter((id) => id === layout.edges.find((e) => e.from === from && e.branch === branch)?.to || !connectRefusal(layout, from, branch, id)).map((id) => ({ id, name: layout.nodes[id].name }));
}

export type OpResult = { ok: true; layout: BuilderLayout } | { ok: false; reason: string };

/** Connects `from` to `to`. An existing connection on the same path is re-pointed, keeping its identity. */
export function setTarget(layout: BuilderLayout, from: string, branch: Branch | undefined, to: string): OpResult {
  const existing = layout.edges.find((e) => e.from === from && e.branch === branch);
  if (existing?.to === to) return { ok: false, reason: `"${layout.nodes[from]?.name}" already connects to "${layout.nodes[to]?.name}".` };
  const reason = connectRefusal(layout, from, branch, to);
  if (reason) return { ok: false, reason };
  const edges = existing
    ? layout.edges.map((e) => (e.id === existing.id ? { ...e, to } : e))
    : [...layout.edges, { id: `edge-${edgeSeq++}`, from, to, ...(branch ? { branch } : {}) }];
  return { ok: true, layout: normalise({ ...layout, edges }) };
}

/** Re-points an existing connection at a different step, keeping its id, source and branch. */
export function retargetEdge(layout: BuilderLayout, edgeId: string, to: string): OpResult {
  const edge = layout.edges.find((e) => e.id === edgeId);
  if (!edge) return { ok: false, reason: "That connection no longer exists." };
  return setTarget(layout, edge.from, edge.branch, to);
}

export function setEdgeLabel(layout: BuilderLayout, edgeId: string, label: string): BuilderLayout {
  const text = label.trim();
  return { ...layout, edges: layout.edges.map((e) => (e.id === edgeId && !e.branch ? (text ? { ...e, label: text } : { id: e.id, from: e.from, to: e.to }) : e)) };
}

/** Removes one connection. The step it left is not silently reconnected; the graph checks flag it. */
export function deleteEdge(layout: BuilderLayout, edgeId: string): BuilderLayout {
  return normalise({ ...layout, edges: layout.edges.filter((e) => e.id !== edgeId) });
}

/* ---- Steps ---- */

const overlaps = (a: Pos, b: Pos) => Math.abs(a.x - b.x) < NODE_W + 24 && Math.abs(a.y - b.y) < NODE_H + 24;

export type AddResult =
  | { ok: true; layout: BuilderLayout; id: string; /** The step it went after, or null when it went before the End. */ after: string | null }
  | { ok: false; reason: string };

/**
 * Adds a step by splicing it into an existing connection, so the graph stays whole.
 * - With a connection selected, it goes into that connection, keeping its Yes or No branch.
 * - With a step selected, it goes straight after it (for a Condition, on its first open path, or Yes).
 * - Otherwise it goes just before the End.
 * A new Condition gets a Yes path that carries on where the connection went and a No path to the
 * End, which can be re-pointed afterwards. Later steps shift right to make room.
 */
export function addNode(layout: BuilderLayout, type: NodeType, anchorId: string | null, edgeId: string | null = null): AddResult {
  const reason = unavailableReason(layout, type);
  if (reason) return { ok: false, reason };

  const endId = Object.keys(layout.nodes).find((id) => layout.nodes[id].type === "end");
  const anchor = anchorId && layout.nodes[anchorId] && layout.nodes[anchorId].type !== "end" ? anchorId : null;

  // Which connection does the new step go into? A selected connection wins; otherwise the one
  // leaving the selected step; otherwise the one arriving at the End.
  let source: string | null = null;
  let branch: Branch | undefined;
  let spliced: BuilderEdge | undefined;
  const chosen = edgeId ? layout.edges.find((e) => e.id === edgeId) : undefined;
  if (chosen) {
    spliced = chosen;
    source = chosen.from;
    branch = chosen.branch;
  } else if (anchor) {
    source = anchor;
    if (layout.nodes[anchor].type === "condition") branch = branches.find((b) => !layout.edges.some((e) => e.from === anchor && e.branch === b.id))?.id ?? "yes";
    spliced = layout.edges.find((e) => e.from === anchor && e.branch === branch);
  } else if (endId) {
    spliced = layout.edges.find((e) => e.to === endId);
    source = spliced?.from ?? null;
    branch = spliced?.branch;
  }

  const id = `step-${nodeSeq++}`;
  const data = newNodeData(type);
  const target = spliced?.to ?? endId ?? null;
  let edges = layout.edges.filter((e) => e.id !== spliced?.id);
  if (source) edges.push({ id: spliced?.id ?? `edge-${edgeSeq++}`, from: source, to: id, ...(branch ? { branch } : {}), ...(spliced?.label && !branch ? { label: spliced.label } : {}) });
  if (target) {
    if (type === "condition") {
      edges.push({ id: `edge-${edgeSeq++}`, from: id, to: target, branch: "yes" });
      edges.push({ id: `edge-${edgeSeq++}`, from: id, to: endId ?? target, branch: "no" });
    } else edges.push({ id: `edge-${edgeSeq++}`, from: id, to: target });
  }
  edges = edges.filter((e, i, all) => all.findIndex((x) => x.from === e.from && x.to === e.to && x.branch === e.branch) === i);

  // Place it to the right of its source and push everything at or beyond that column along.
  const positions = { ...layout.positions };
  const base: Pos = source ? { x: positions[source].x + STEP, y: positions[source].y } : { x: 0, y: 0 };
  if (source) for (const other of Object.keys(positions)) if (positions[other].x >= base.x - 1) positions[other] = { x: positions[other].x + STEP, y: positions[other].y };
  const placed: Pos = { ...base };
  for (let tries = 0; tries < 8 && Object.values(positions).some((p) => overlaps(p, placed)); tries++) placed.y += NODE_H + 56;
  positions[id] = placed;

  const next = normalise({ order: [...layout.order, id], positions, nodes: { ...layout.nodes, [id]: data }, edges });
  const after = chosen ? layout.nodes[chosen.from].name : anchor ? layout.nodes[anchor].name : null;
  return { ok: true, layout: next, id, after };
}

export interface DeleteResult {
  layout: BuilderLayout;
  /** Set when steps that led into the deleted one now need a new way forward. */
  note: string | null;
}

/**
 * Removes an added step and every connection touching it. Where that's unambiguous the steps
 * before it are joined to the step after it, keeping their branches; otherwise they are left
 * without a way forward, which the graph checks flag clearly.
 */
export function deleteNode(layout: BuilderLayout, id: string): DeleteResult {
  const node = layout.nodes[id];
  if (!node?.custom) return { layout, note: null };
  const ins = incoming(layout, id);
  const outs = outgoing(layout, id);
  const targets = [...new Set(outs.map((e) => e.to))];
  const heal = targets.length === 1 && outs.length >= 1 ? targets[0] : null;

  let edges = layout.edges.filter((e) => e.from !== id && e.to !== id);
  let stranded = 0;
  for (const e of ins) {
    if (heal && !edges.some((x) => x.from === e.from && x.to === heal && x.branch === e.branch)) edges.push({ ...e, to: heal });
    else if (!heal) stranded++;
  }
  edges = edges.filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i);

  const { [id]: _node, ...nodes } = layout.nodes;
  const { [id]: _pos, ...positions } = layout.positions;
  void _node;
  void _pos;
  // Undo the column shift an insertion made, when nothing else now sits in the removed step's column.
  const removedX = layout.positions[id]?.x;
  const columnFree = removedX !== undefined && Object.values(positions).every((p) => Math.abs(p.x - removedX) >= STEP / 2);
  const closed = columnFree
    ? Object.fromEntries(Object.entries(positions).map(([k, p]) => [k, p.x > removedX! ? { x: p.x - STEP, y: p.y } : p]))
    : positions;
  const next = normalise({ order: layout.order.filter((x) => x !== id), nodes, positions: closed, edges });
  const note = stranded ? `${stranded === 1 ? "A step that led into" : `${stranded} steps that led into`} "${node.name}" ${stranded === 1 ? "needs" : "need"} a new next step.` : null;
  return { layout: next, note };
}

/* ---- Validation ---- */

export interface GraphReport {
  /** Everything wrong with the graph, in plain English. Empty means it can be saved. */
  problems: string[];
  /** The same problems grouped by the step they concern, for marking steps on the canvas. */
  byNode: Record<string, string[]>;
  /** The same problems with a stable id, a kind and the step concerned, for readiness checks and navigation. */
  issues: GraphIssue[];
}

/** One problem in a graph. `id` is stable for the same problem on the same step, whatever else changes. */
export interface GraphIssue {
  id: string;
  /** What kind of rule it is, e.g. "no-next" or "config:duration". */
  code: string;
  /** Structure is about how steps connect; configuration is about one step's own settings. */
  category: "structure" | "configuration";
  nodeId: string | null;
  /** Full sentence, naming the step. */
  message: string;
  /** The same without the step's name, for showing on the step itself. */
  short: string;
}

/**
 * Checks the whole graph. The editing operations keep the structure sound; this is the safety
 * net, and also reports the gaps an operator can still create, like a deleted connection that
 * leaves a step with no way forward.
 */
export function analyseGraph(layout: BuilderLayout): GraphReport {
  const problems: string[] = [];
  const byNode: Record<string, string[]> = {};
  const { nodes, positions, edges } = layout;
  const name = (id: string) => nodes[id]?.name ?? id;
  const issues: GraphIssue[] = [];
  const flag = (id: string | null, code: string, message: string, category: GraphIssue["category"] = "structure") => {
    problems.push(message);
    const short = message.replace(/^"[^"]*" /, "");
    if (id) (byNode[id] ??= []).push(short);
    issues.push({ id: `${code}:${id ?? "workflow"}`, code, category, nodeId: id, message, short });
  };

  const ids = Object.keys(nodes);
  if (ids.length === 0) return { problems: ["The workflow has no steps."], byNode, issues: [{ id: "no-steps:workflow", code: "no-steps", category: "structure", nodeId: null, message: "The workflow has no steps.", short: "The workflow has no steps." }] };

  // Steps
  const listed = new Set<string>();
  for (const id of layout.order) {
    if (listed.has(id)) flag(null, "listed-twice", `"${name(id)}" is listed more than once.`);
    listed.add(id);
    if (!nodes[id]) flag(null, "list-unknown-step", `The step list includes a step that doesn't exist (${id}).`);
  }
  for (const id of ids) {
    if (!listed.has(id)) flag(id, "not-listed", `"${name(id)}" is missing from the step list.`);
    if (!positions[id]) flag(id, "no-position", `"${name(id)}" has no position on the canvas.`);
  }

  // Connections
  const edgeIds = new Set<string>();
  const seen = new Set<string>();
  let structural = true;
  for (const e of edges) {
    if (edgeIds.has(e.id)) flag(null, "dup-edge-id", `Two connections share the id ${e.id}.`);
    edgeIds.add(e.id);
    if (!nodes[e.from] || !nodes[e.to]) {
      flag(null, "dangling-edge", "A connection points at a step that doesn't exist.");
      structural = false;
      continue;
    }
    if (e.from === e.to) {
      flag(e.from, "self-loop", `"${name(e.from)}" connects to itself.`);
      structural = false;
    }
    const key = `${e.from}>${e.to}>${e.branch ?? ""}`;
    if (seen.has(key)) flag(e.from, "dup-connection", `"${name(e.from)}" has a duplicate connection to "${name(e.to)}".`);
    seen.add(key);
  }
  if (structural) {
    for (const id of ids) {
      // A loop exists if a step can be reached again by following its outgoing connections.
      const first = edges.filter((e) => e.from === id).map((e) => e.to);
      if (first.some((t) => t !== id && reaches(layout, t, id))) {
        flag(id, "loop", `"${name(id)}" is part of a loop. Workflows can't loop back yet.`);
        structural = false;
        break;
      }
    }
  }

  // Start and finish
  const triggers = ids.filter((id) => nodes[id].type === "trigger");
  const ends = ids.filter((id) => nodes[id].type === "end");
  if (triggers.length !== 1) flag(null, triggers.length ? "trigger-many" : "trigger-missing", triggers.length ? "There is more than one Trigger. Only one is supported." : "The workflow needs a Trigger to start it.");
  if (ends.length !== 1) flag(null, ends.length ? "end-many" : "end-missing", ends.length ? "There is more than one End. Only one is supported." : "The workflow needs an End to finish it.");
  for (const t of triggers) if (incoming(layout, t).length) flag(t, "trigger-incoming", `"${name(t)}" is the Trigger, so nothing can lead into it.`);
  for (const e of ends) if (outgoing(layout, e).length) flag(e, "end-outgoing", `"${name(e)}" is the End, so nothing can follow it.`);

  // Every step needs the right ways out
  for (const id of ids) {
    const outs = outgoing(layout, id);
    const type = nodes[id].type;
    if (type === "end") continue;
    if (type === "condition") {
      for (const b of branches) {
        const n = outs.filter((e) => e.branch === b.id).length;
        if (n === 0) flag(id, `no-branch-${b.id}`, `"${name(id)}" has no ${b.label} path.`);
        if (n > 1) flag(id, `many-branch-${b.id}`, `"${name(id)}" has more than one ${b.label} path.`);
      }
      if (outs.some((e) => !e.branch)) flag(id, "unlabelled-branch", `"${name(id)}" has a connection that is neither Yes nor No.`);
    } else {
      if (outs.length === 0) flag(id, "no-next", `"${name(id)}" has no next step.`);
      if (outs.length > 1) flag(id, "many-next", `"${name(id)}" has more than one next step. Only a Condition can branch.`);
      if (outs.some((e) => e.branch)) flag(id, "stray-branch", `"${name(id)}" has a Yes/No connection, but it isn't a Condition.`);
    }
  }

  // Reachability, both ways. Only meaningful once the structure is sound.
  if (structural && triggers.length === 1 && ends.length === 1) {
    const forward = new Set<string>();
    const stack = [triggers[0]];
    while (stack.length) {
      const at = stack.pop()!;
      if (forward.has(at)) continue;
      forward.add(at);
      for (const e of edges) if (e.from === at) stack.push(e.to);
    }
    const backward = new Set<string>();
    const back = [ends[0]];
    while (back.length) {
      const at = back.pop()!;
      if (backward.has(at)) continue;
      backward.add(at);
      for (const e of edges) if (e.to === at) back.push(e.from);
    }
    for (const id of ids) {
      if (!forward.has(id)) flag(id, "unreachable", `"${name(id)}" can't be reached from the Trigger.`);
      else if (!backward.has(id)) flag(id, "no-path-to-end", `"${name(id)}" has no path to the End.`);
    }
  }

  // Each step's own settings
  for (const id of ids) {
    for (const [key, message] of Object.entries(validate(nodes[id]))) flag(id, `config:${key}`, `"${name(id)}": ${message}`, "configuration");
  }

  const uniqueIssues = issues.filter((x, i, all) => all.findIndex((y) => y.id === x.id) === i);
  return { problems: [...new Set(problems)], byNode, issues: uniqueIssues };
}

export const validateGraph = (layout: BuilderLayout) => analyseGraph(layout).problems;
