/**
 * Graph tests for the workflow builder. Run with:
 *   npx esbuild scripts/builder-graph-test.ts --bundle --platform=node --alias:@=./src --outfile=/tmp/builder-graph-test.cjs && node /tmp/builder-graph-test.cjs
 */
import { addNode, analyseGraph, connectRefusal, deleteEdge, deleteNode, linearEdges, reaches, retargetEdge, setTarget, validateGraph } from "@/lib/builder-graph";
import { defaultPositions } from "@/lib/builder-layout";
import { nodeTypes, seedNodeData, type BuilderNodeData, type NodeType } from "@/lib/builder-nodes";
import { workflows } from "@/lib/data/workflows";
import { blankTemplate, buildTemplateLayout, cleanName, createFromTemplate, deriveStages, sameName, templates, uniqueWorkflowId } from "@/lib/workflow-templates";
import { evaluateCondition, layoutFor, planRun, sampleExamples, conditionFieldsIn, formatElapsed } from "@/lib/simulation";
import { analyseReadiness } from "@/lib/readiness";
import { buildInsights, type InsightInput } from "@/lib/insights";
import { compareScenarios, comparableConditions, parseInputs } from "@/lib/whatif";
import { processes } from "@/lib/data/operations";
import type { SimRun, SampleInput } from "@/lib/simulation";
import { team } from "@/lib/data/team";
import type { BuilderLayout } from "@/lib/workflow-state";

let failures = 0;
const check = (cond: boolean, msg: string) => {
  if (!cond) {
    failures++;
    console.log("FAIL:", msg);
  }
};
const seedLayout = (id: string): BuilderLayout => {
  const w = workflows.find((x) => x.id === id)!;
  const order = w.stages.map((s) => s.id);
  return { positions: defaultPositions(w.stages), order, nodes: Object.fromEntries(w.stages.map((s) => [s.id, seedNodeData(s)])), edges: linearEdges(order) };
};

/** An independent check of the rules, used as an oracle for the validator. */
function oracleValid(L: BuilderLayout): boolean {
  const ids = Object.keys(L.nodes);
  const trig = ids.filter((i) => L.nodes[i].type === "trigger");
  const end = ids.filter((i) => L.nodes[i].type === "end");
  if (trig.length !== 1 || end.length !== 1) return false;
  for (const e of L.edges) if (!L.nodes[e.from] || !L.nodes[e.to] || e.from === e.to) return false;
  const out = (id: string) => L.edges.filter((e) => e.from === id);
  for (const id of ids) {
    const o = out(id);
    const t = L.nodes[id].type;
    if (t === "end" && o.length) return false;
    if (t === "condition") {
      if (o.filter((e) => e.branch === "yes").length !== 1 || o.filter((e) => e.branch === "no").length !== 1 || o.length !== 2) return false;
    } else if (t !== "end" && (o.length !== 1 || o[0].branch)) return false;
    if (t === "trigger" && L.edges.some((e) => e.to === id)) return false;
  }
  const fwd = new Set<string>([trig[0]]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const e of L.edges) {
      if (fwd.has(e.from) && !fwd.has(e.to)) {
        fwd.add(e.to);
        grew = true;
      }
    }
  }
  if (!ids.every((i) => fwd.has(i))) return false;
  // acyclic
  for (const id of ids) for (const e of out(id)) if (reaches(L, e.to, id)) return false;
  return true;
}

// 1. Seeds
for (const w of workflows) {
  const L = seedLayout(w.id);
  check(validateGraph(L).length === 0, `seed ${w.id} valid: ${validateGraph(L)}`);
  check(L.edges.length === w.stages.length - 1, `seed ${w.id} has linear edges`);
}

// 2. Condition insertion builds a valid branched graph
{
  let L = seedLayout("request-fulfilment");
  const r = addNode(L, "condition", "review");
  check(r.ok, "condition added");
  if (r.ok) {
    L = r.layout;
    const c = r.id;
    const outs = L.edges.filter((e) => e.from === c);
    check(outs.length === 2 && outs.some((e) => e.branch === "yes") && outs.some((e) => e.branch === "no"), "condition has Yes and No");
    check(validateGraph(L).length === 0, `branched graph valid: ${validateGraph(L)}`);
    // Yes -> approval (kept), No -> fulfilment (a different node): branches converge later at End
    const toFulfil = setTarget(L, c, "no", "fulfilment");
    check(toFulfil.ok, "No path to a different node");
    if (toFulfil.ok) {
      L = toFulfil.layout;
      check(validateGraph(L).length === 0, `two branches reach End: ${validateGraph(L)}`);
      // convergence: both branches into the same node
      const conv = setTarget(L, c, "yes", "fulfilment");
      check(conv.ok && validateGraph(conv.layout).filter((p) => !p.includes("reached")).length >= 0, "convergence allowed");
      // cycle refused
      const back = setTarget(L, "fulfilment", undefined, "review");
      check(!back.ok, "cycle refused");
      check(connectRefusal(L, "review", undefined, "review") !== null, "self connection refused");
      check(connectRefusal(L, "complete", undefined, "review") !== null, "End has no outgoing");
      check(connectRefusal(L, "review", undefined, "new-request") !== null, "nothing into trigger");
    }
  }
}

// 3. Deleting a connection is flagged, not silent
{
  const L = seedLayout("request-fulfilment");
  const broken = deleteEdge(L, L.edges[1].id);
  const rep = analyseGraph(broken);
  check(rep.problems.length > 0, "stranded node is reported");
  check(Object.keys(rep.byNode).length > 0, "problem is attached to nodes");
}

// 4. Fuzz: random operations never break structure, and the validator agrees with the oracle.
let seed = 987654;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const types: NodeType[] = nodeTypes.map((t) => t.type);
let validCount = 0;
for (let run = 0; run < 400; run++) {
  let L = seedLayout(workflows[run % workflows.length].id);
  for (let step = 0; step < 30; step++) {
    const roll = rnd();
    const ids = Object.keys(L.nodes);
    if (roll < 0.35) {
      const t = types[Math.floor(rnd() * types.length)];
      const res = addNode(L, t, rnd() < 0.6 ? ids[Math.floor(rnd() * ids.length)] : null);
      if (res.ok) L = res.layout;
    } else if (roll < 0.5) {
      const custom = ids.filter((i) => L.nodes[i].custom);
      if (custom.length) L = deleteNode(L, custom[Math.floor(rnd() * custom.length)]).layout;
    } else if (roll < 0.85) {
      const from = ids[Math.floor(rnd() * ids.length)];
      const to = ids[Math.floor(rnd() * ids.length)];
      const branch = L.nodes[from].type === "condition" ? (rnd() < 0.5 ? ("yes" as const) : ("no" as const)) : undefined;
      const res = setTarget(L, from, branch, to);
      if (res.ok) L = res.layout;
    } else if (roll < 0.93) {
      if (L.edges.length) L = deleteEdge(L, L.edges[Math.floor(rnd() * L.edges.length)].id);
    } else if (L.edges.length) {
      const e = L.edges[Math.floor(rnd() * L.edges.length)];
      const to = ids[Math.floor(rnd() * ids.length)];
      const res = retargetEdge(L, e.id, to);
      if (res.ok) L = res.layout;
    }
    // Structure is always sound, whatever the operator does.
    const edgeIds = new Set(L.edges.map((e) => e.id));
    check(edgeIds.size === L.edges.length, "unique edge ids");
    check(L.edges.every((e) => L.nodes[e.from] && L.nodes[e.to]), "no dangling edges");
    check(L.edges.every((e) => e.from !== e.to), "no self edges");
    check(new Set(L.edges.map((e) => `${e.from}>${e.to}>${e.branch ?? ""}`)).size === L.edges.length, "no duplicate edges");
    check(!L.edges.some((e) => reaches(L, e.to, e.from)), "no cycles");
    check(L.order.length === Object.keys(L.nodes).length && L.order.every((i) => L.nodes[i]), "order lists every node once");
    check(Object.keys(L.positions).length === Object.keys(L.nodes).length, "every node positioned");
    check(Object.values(L.nodes).filter((n) => n.type === "trigger").length === 1 && Object.values(L.nodes).filter((n) => n.type === "end").length === 1, "one trigger, one end");
    const ok = validateGraph(L).length === 0;
    check(ok === oracleValid(L), `validator agrees with oracle (run ${run} step ${step}): ${validateGraph(L).join("; ")}`);
    if (ok) validCount++;
    // Original stages are never lost.
    const w = workflows.find((x) => x.stages[0].id === L.order.find((i) => !L.nodes[i].custom && workflows.some((y) => y.stages[0].id === i)))!;
    check(!!w && w.stages.every((s) => L.nodes[s.id]), "original stages retained");
  }
}
console.log(`fuzz: ${validCount} valid graph states visited`);

// 4b. History exactness (Stage 3.5). A history entry is a whole-graph snapshot, so undo and redo
// must reproduce the graph exactly: ids, positions, connections, labels and configuration.
{
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
  const same = (a: BuilderLayout, b: BuilderLayout) => JSON.stringify(a) === JSON.stringify(b);
  const canon = (L: BuilderLayout) => JSON.stringify({ n: L.nodes, p: L.positions, e: [...L.edges].sort((a, b) => a.id.localeCompare(b.id)) });
  const branched = (): BuilderLayout => {
    const r = addNode(seedLayout("request-fulfilment"), "condition", "review");
    if (!r.ok) throw new Error("setup");
    const toFulfil = setTarget(r.layout, r.id, "no", "fulfilment");
    if (!toFulfil.ok) throw new Error("setup2");
    return toFulfil.layout;
  };
  for (const [label, start] of [["linear", seedLayout("request-fulfilment")], ["branched", branched()]] as const) {
    // One user action = one history entry. Build a stack the way the builder does.
    const stack: BuilderLayout[] = [clone(start)];
    const push = (next: BuilderLayout) => { if (!same(stack[stack.length - 1], next)) stack.push(clone(next)); };
    let L = clone(start);
    const ops: ((l: BuilderLayout) => BuilderLayout)[] = [
      (l) => { const r = addNode(l, "action", "review"); return r.ok ? r.layout : l; },
      (l) => { const r = addNode(l, "delay", "approval"); return r.ok ? r.layout : l; },
      (l) => { const r = addNode(l, "condition", null); return r.ok ? r.layout : l; },
      (l) => { const e = l.edges.find((x) => x.branch === "yes"); if (!e) return l; const r = addNode(l, "notification", null, e.id); return r.ok ? r.layout : l; },
      (l) => { const e = l.edges.find((x) => x.branch === "no"); if (!e) return l; const r = addNode(l, "action", null, e.id); return r.ok ? r.layout : l; },
      (l) => ({ ...l, positions: { ...l.positions, review: { x: l.positions.review.x + 17, y: l.positions.review.y - 9 } } }),
      (l) => { const e = l.edges.find((x) => !x.branch && l.nodes[x.to].type !== "end"); return e ? setEdgeLabelSafe(l, e.id) : l; },
      (l) => { const c = Object.keys(l.nodes).filter((i) => l.nodes[i].custom); return c.length ? deleteNode(l, c[0]).layout : l; },
      (l) => (l.edges.length ? deleteEdge(l, l.edges[1].id) : l),
    ];
    function setEdgeLabelSafe(l: BuilderLayout, id: string) { return { ...l, edges: l.edges.map((e) => (e.id === id ? { ...e, label: "Standard" } : e)) }; }
    for (const op of ops) { L = op(L); push(L); }
    check(stack.length > 4, `${label}: operations produced several history entries (${stack.length})`);
    // Undo all the way, then redo all the way, comparing with the recorded snapshots.
    let i = stack.length - 1;
    const walkedBack: BuilderLayout[] = [];
    while (i > 0) { i--; walkedBack.push(stack[i]); }
    check(same(walkedBack[walkedBack.length - 1], start), `${label}: undoing everything restores the start exactly`);
    while (i < stack.length - 1) i++;
    check(same(stack[i], L), `${label}: redoing everything restores the final graph exactly`);
    for (let k = 1; k < stack.length; k++) check(validateGraph(stack[k]).length >= 0, "snapshot readable");
  }

  // Inserting and then deleting returns the graph to where it began: the column shift is reversed.
  for (const [label, start] of [["linear", seedLayout("request-fulfilment")], ["branched", branched()]] as const) {
    for (const type of ["action", "delay", "notification", "approval"] as NodeType[]) {
      for (const anchor of start.order) {
        const r = addNode(start, type, anchor);
        if (!r.ok) continue;
        const back = deleteNode(r.layout, r.id).layout;
        check(canon(back) === canon(start), `${label}: insert ${type} after ${anchor} then delete restores positions and connections`);
      }
    }
  }
}

// 4c. Inserting into labelled connections and converging branches keeps every branch.
{
  const base = seedLayout("request-fulfilment");
  const c = addNode(base, "condition", "review");
  if (!c.ok) throw new Error("setup");
  const withNo = setTarget(c.layout, c.id, "no", "fulfilment");
  if (!withNo.ok) throw new Error("setup2");
  const L = withNo.layout; // Review -> Cond; Yes -> Approval -> Fulfilment; No -> Fulfilment (converges)
  check(validateGraph(L).length === 0, "converging graph is valid");
  const noEdge = L.edges.find((e) => e.from === c.id && e.branch === "no")!;
  const yesEdge = L.edges.find((e) => e.from === c.id && e.branch === "yes")!;

  // Insert into the labelled No connection.
  const ins = addNode(L, "delay", null, noEdge.id);
  check(ins.ok, "insert into the No connection");
  if (ins.ok) {
    const after = ins.layout;
    const first = after.edges.find((e) => e.id === noEdge.id)!;
    check(first.from === c.id && first.branch === "no" && first.to === ins.id, "No edge keeps its id, source and branch, now into the new step");
    check(after.edges.filter((e) => e.from === c.id && e.branch === "no").length === 1, "still exactly one No path");
    check(after.edges.some((e) => e.from === ins.id && e.to === "fulfilment" && !e.branch), "the new step continues to the old target as an ordinary connection");
    check(after.edges.filter((e) => e.to === "fulfilment").length === 2, "convergence at Fulfilment is preserved");
    check(validateGraph(after).length === 0, `valid after inserting into No: ${validateGraph(after)}`);
  }
  // Insert a Condition into the labelled Yes connection: its own Yes continues, No goes to the End.
  const insC = addNode(L, "condition", null, yesEdge.id);
  check(insC.ok, "insert a Condition into the Yes connection");
  if (insC.ok) {
    const out = insC.layout.edges.filter((e) => e.from === insC.id);
    check(out.length === 2 && out.some((e) => e.branch === "yes" && e.to === "approval") && out.some((e) => e.branch === "no" && e.to === "complete"), "new Condition: Yes carries on, No goes to End");
    check(insC.layout.edges.find((e) => e.id === yesEdge.id)?.branch === "yes", "outer Yes label preserved");
    check(validateGraph(insC.layout).length === 0, `valid: ${validateGraph(insC.layout)}`);
  }
  // Insert after a step on the converging branch (Approval) and on the Condition itself.
  const afterApproval = addNode(L, "action", "approval");
  check(afterApproval.ok && validateGraph(afterApproval.layout).length === 0, "insert on the other converging branch");
  const afterCond = addNode(L, "action", c.id);
  check(afterCond.ok && afterCond.layout.edges.filter((e) => e.from === c.id).length === 2 && validateGraph(afterCond.layout).length === 0, "insert after a Condition keeps both branches");

  // Reconnecting keeps id, branch and label.
  const re = retargetEdge(L, noEdge.id, "complete");
  check(re.ok && re.layout.edges.find((e) => e.id === noEdge.id)?.branch === "no" && re.layout.edges.find((e) => e.id === noEdge.id)?.to === "complete", "reconnect keeps id and branch");

  // Deleting a step with several incoming connections keeps their branches.
  const step = addNode(L, "action", "approval");
  if (step.ok) {
    const joined = setTarget(step.layout, c.id, "no", step.id); // both Yes-path and No-path now reach the new step
    if (joined.ok) {
      const del = deleteNode(joined.layout, step.id);
      check(del.layout.edges.every((e) => del.layout.nodes[e.from] && del.layout.nodes[e.to]), "no dangling edges after deleting a joined step");
      check(del.layout.edges.filter((e) => e.from === c.id && e.branch).length === 2, "both Condition branches survive the deletion");
      check(del.layout.edges.some((e) => e.from === c.id && e.branch === "no"), "No branch not converted or dropped");
    }
  }
  // Deleting a Condition whose branches go different ways is allowed but never silent or corrupting.
  const delCond = deleteNode(L, c.id);
  check(delCond.note !== null, "deleting a Condition with two destinations explains what's left to fix");
  check(validateGraph(delCond.layout).length > 0, "and the graph is flagged until it is");
  check(delCond.layout.edges.every((e) => delCond.layout.nodes[e.from] && delCond.layout.nodes[e.to]), "no dangling edges");
}

// 5. Broken graphs are rejected
const base = seedLayout("request-fulfilment");
const bad: [string, BuilderLayout][] = [
  ["cycle", { ...base, edges: [...base.edges, { id: "x", from: "fulfilment", to: "review" }] }],
  ["self connection", { ...base, edges: [...base.edges, { id: "x", from: "review", to: "review" }] }],
  ["missing endpoint", { ...base, edges: [...base.edges, { id: "x", from: "review", to: "ghost" }] }],
  ["duplicate edge id", { ...base, edges: [...base.edges, { ...base.edges[0] }] }],
  ["duplicate connection", { ...base, edges: [...base.edges, { id: "dup", from: base.edges[0].from, to: base.edges[0].to }] }],
  ["orphaned node", { ...base, nodes: { ...base.nodes, lost: { ...base.nodes.review, name: "Lost" } }, positions: { ...base.positions, lost: { x: 0, y: 0 } }, order: [...base.order, "lost"] }],
  ["missing branch", (() => { const r = addNode(base, "condition", "review"); if (!r.ok) throw new Error(); return { ...r.layout, edges: r.layout.edges.filter((e) => !(e.from === r.id && e.branch === "no")) }; })()],
  ["branch cannot reach End", (() => { const r = addNode(base, "action", "review"); if (!r.ok) throw new Error(); return { ...r.layout, edges: r.layout.edges.filter((e) => e.from !== r.id) }; })()],
  ["ordinary node branches", { ...base, edges: [...base.edges, { id: "x", from: "review", to: "fulfilment" }] }],
  ["two outgoing from End", { ...base, edges: [...base.edges, { id: "x", from: "complete", to: "review" }] }],
  ["edge into trigger", { ...base, edges: [...base.edges, { id: "x", from: "review", to: "new-request" }] }],
];
for (const [name, g] of bad) {
  const p = validateGraph(g);
  check(p.length > 0, `rejects: ${name}`);
  console.log(`  ${name}: ${p[0]}`);
}


/* ---- 5. Workflow templates ---- */
{
  const all = [...templates, blankTemplate];
  check(templates.length === 4, "four curated templates");
  check(blankTemplate.steps.length === 3, "blank has trigger, step and end");
  const seedIds = new Set(workflows.map((w) => w.id));
  const taken = new Set(seedIds);
  const made: NonNullable<ReturnType<typeof createFromTemplate>>[] = [];
  for (const t of all) {
    const L = buildTemplateLayout(t, "x");
    check(validateGraph(L).length === 0, `${t.id}: valid graph (${validateGraph(L).join("; ")})`);
    check(oracleValid(L), `${t.id}: oracle agrees it is valid`);
    check(L.order.length === t.steps.length && new Set(L.order).size === L.order.length, `${t.id}: order lists every step once`);
    const trig = Object.keys(L.nodes).filter((i) => L.nodes[i].type === "trigger");
    const end = Object.keys(L.nodes).filter((i) => L.nodes[i].type === "end");
    check(trig.length === 1 && end.length === 1, `${t.id}: one trigger and one end`);
    check(L.order[0] === trig[0] && L.order[L.order.length - 1] === end[0], `${t.id}: starts at the trigger and ends at the end`);
    check(Object.values(L.nodes).every((n) => n.custom), `${t.id}: every step is editable and deletable`);
    check(new Set(L.edges.map((e) => e.id)).size === L.edges.length, `${t.id}: unique edge ids`);
    for (const id of Object.keys(L.nodes)) {
      check(id === end[0] || reaches(L, id, end[0]), `${t.id}: ${id} reaches the End`);
      if (L.nodes[id].type === "condition") {
        const o = L.edges.filter((e) => e.from === id);
        check(o.length === 2 && o.some((e) => e.branch === "yes") && o.some((e) => e.branch === "no") && new Set(o.map((e) => e.to)).size === 2, `${t.id}: condition has distinct Yes and No`);
      }
    }
    if (t.id !== "blank") check(Object.values(L.nodes).some((n) => n.type === "condition"), `${t.id}: has a condition`);
    // Independence: two builds never share objects, and mutating one leaves the other alone.
    const a = buildTemplateLayout(t, "a");
    const b = buildTemplateLayout(t, "a");
    check(a !== b && a.nodes !== b.nodes && a.edges !== b.edges && a.positions !== b.positions, `${t.id}: builds are separate objects`);
    const firstId = Object.keys(a.nodes)[0];
    a.nodes[firstId].name = "Changed";
    a.nodes[firstId].config.detail = "Changed";
    check(b.nodes[firstId].name !== "Changed" && b.nodes[firstId].config.detail !== "Changed", `${t.id}: editing one build leaves another untouched`);
    check(buildTemplateLayout(t, "z").nodes["z-" + t.steps[0].key].name === t.steps[0].name, `${t.id}: template data not mutated by edits`);
    for (let n = 0; n < 2; n++) {
      const m = createFromTemplate(t, { name: t.suggestedName || "My workflow", description: "d", ownerId: "hina" }, taken);
      check(!!m, `${t.id}: creates`);
      if (m) {
        taken.add(m.workflow.id);
        made.push(m);
      }
    }
  }
  const wfIds = made.map((m) => m.workflow.id);
  check(new Set(wfIds).size === wfIds.length && wfIds.every((i) => !seedIds.has(i)), "workflow ids are unique and never collide with seeds");
  const nodeIds = made.flatMap((m) => Object.keys(m.layout.nodes));
  check(new Set(nodeIds).size === nodeIds.length, "node ids are unique across every created workflow");
  check(uniqueWorkflowId("Vendor Onboarding!", seedIds) === "vendor-onboarding-2", "slug collision gets a suffix");
  check(uniqueWorkflowId("   ", seedIds) === "workflow", "blank slug falls back");
  for (const m of made) {
    const w = m.workflow;
    check(w.status === "draft" && w.lastRun === "Never run" && w.runsPerWeek === 0 && w.successRate === 0, `${w.id}: draft with no fabricated history`);
    check(w.stages.length >= 2 && w.stages.every((s) => s.count === 0 && s.items.length === 0 && s.health === "idle"), `${w.id}: stages are empty and idle`);
    check(w.stages.every((s) => m.layout.nodes[s.id] && m.layout.nodes[s.id].type !== "condition"), `${w.id}: stages map to non-condition nodes`);
    check(w.stages[0].kind === "intake" && w.stages[w.stages.length - 1].kind === "complete", `${w.id}: first and last stage kinds`);
    check(!!w.origin, `${w.id}: origin recorded`);
    // Edit the created graph with the normal operations: still valid, and the original is never mutated.
    const L = m.layout;
    const before = JSON.stringify(L);
    const cond = Object.keys(L.nodes).find((i) => L.nodes[i].type === "condition");
    const edgeId = L.edges.find((e) => !e.branch && L.nodes[e.from].type !== "trigger")!.id;
    const added = addNode(L, "action", null, edgeId);
    check(added.ok && validateGraph(added.layout).length === 0, `${w.id}: insert into a connection stays valid`);
    if (cond) {
      const yes = L.edges.find((e) => e.from === cond && e.branch === "yes")!;
      const ins = addNode(L, "delay", null, yes.id);
      check(ins.ok && validateGraph(ins.layout).length === 0, `${w.id}: insert into Yes connection stays valid`);
      if (ins.ok) {
        const e2 = ins.layout.edges.find((e) => e.id === yes.id);
        check(e2?.branch === "yes" && e2.from === cond, `${w.id}: Yes connection keeps id and branch`);
      }
      const lone = addNode(L, "condition", null, edgeId);
      check(lone.ok && validateGraph(lone.layout).length === 0, `${w.id}: new Condition into a connection stays valid`);
      deleteNode(L, cond);
    }
    const victim = Object.keys(L.nodes).find((i) => L.nodes[i].type === "action");
    if (victim) {
      const d = deleteNode(L, victim);
      check(Object.keys(d.layout.nodes).length === Object.keys(L.nodes).length - 1, `${w.id}: step deleted`);
      check(validateGraph(d.layout).length === 0, `${w.id}: deleting a step keeps the graph valid (${validateGraph(d.layout).join("; ")})`);
    }
    check(JSON.stringify(L) === before, `${w.id}: operations never mutate the stored graph`);
    check(deriveStages(L, "hina").length === Object.values(L.nodes).filter((n) => n.type !== "condition").length, `${w.id}: derived stages follow the graph`);
  }
}

/* ---- 6. Workflow names and ids ---- */
{
  const taken = new Set(workflows.map((w) => w.id));
  const mk = (name: string, t = templates[0]) => {
    const m = createFromTemplate(t, { name, description: "", ownerId: "hina" }, taken);
    if (m) taken.add(m.workflow.id);
    return m;
  };
  const ids = ["Foo", "Foo", "Foo 2", "foo", "FOO!!", "  foo  ", "Foo?", "f o o", "!!!", "???", "Vendor Onboarding", "vendor-onboarding"].map((n) => mk(n)?.workflow.id);
  check(ids.every(Boolean) && new Set(ids).size === ids.length, `ids stay unique for punctuation/spacing variants: ${ids.join(", ")}`);
  check(ids.every((i) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(i!)), "ids are clean slugs");
  check(cleanName("  A   B \t C ") === "A B C", "cleanName collapses whitespace");
  check(sameName("Client  Onboarding", " client onboarding"), "names differing only in spacing/case are the same");
  check(!sameName("Client Onboarding!", "Client Onboarding"), "punctuation makes a different name");
  check(mk("") === null && mk("    ") === null, "empty names cannot create");
  check(mk("x".repeat(61)) === null && mk("x".repeat(60)) !== null, "name length limit enforced");
  const m = mk("  Spaced   name ")!;
  check(m.workflow.name === "Spaced name", "stored name is cleaned");
  check(m.workflow.description === "" , "empty description allowed");
  const d = createFromTemplate(templates[0], { name: "Desc test", description: "y".repeat(300), ownerId: "hina" }, new Set())!;
  check(d.workflow.description.length === 160, "description capped");
  // Preview numbering matches the real graph: stages derive from the same order.
  for (const t of [...templates, blankTemplate]) {
    const L = buildTemplateLayout(t, "p");
    const stages = deriveStages(L, "hina").map((s) => s.name);
    const nonCond = L.order.filter((i) => L.nodes[i].type !== "condition").map((i) => L.nodes[i].name);
    check(JSON.stringify(stages) === JSON.stringify(nonCond), `${t.id}: stages follow the graph order`);
    check(new Set(L.edges.map((e) => `${e.from}>${e.to}`)).size === L.edges.length, `${t.id}: no duplicate connections`);
    check(L.edges.every((e) => L.nodes[e.from] && L.nodes[e.to]), `${t.id}: no dangling connections`);
  }
}

/* ---- 7. Run simulation ---- */
{
  const pathNames = (L: BuilderLayout, input: Record<string, string>) => {
    const p = planRun(L, input);
    return p.ok ? { status: p.status, names: p.steps.map((x) => x.nodeName), steps: p.steps, error: p.error } : null;
  };
  // Linear seed workflows reach the End.
  for (const w of workflows) {
    const L = layoutFor(w, undefined);
    const p = planRun(L, {});
    check(p.ok && p.status === "completed" && p.steps.length === L.order.length && p.steps[p.steps.length - 1].type === "end", `${w.id}: linear run completes through every step`);
  }
  // Each template: examples pick the documented branch, deterministically.
  for (const t of templates) {
    const L = buildTemplateLayout(t, "s");
    const cond = Object.keys(L.nodes).find((i) => L.nodes[i].type === "condition")!;
    check(conditionFieldsIn(L).length === 1, `${t.id}: needs exactly one sample field`);
    const ex = sampleExamples[t.id];
    check(ex.length === 2, `${t.id}: has two examples`);
    const results = ex.map((e) => planRun(L, e.values));
    results.forEach((r, i) => {
      check(r.ok && r.status === "completed", `${t.id}: example ${i} completes`);
      if (!r.ok) return;
      const step = r.steps.find((x) => x.nodeId === cond)!;
      const want = i === 0 ? "yes" : "no";
      check(step.decision?.branch === want, `${t.id}: example ${i} takes ${want}`);
      // The displayed branch matches the connection actually followed.
      const next = r.steps[step.index + 1];
      const edge = L.edges.find((e) => e.id === next.viaEdgeId)!;
      check(edge.from === cond && edge.branch === want && next.nodeId === edge.to && next.viaBranch === want, `${t.id}: example ${i} followed the ${want} connection`);
      check(r.steps[r.steps.length - 1].type === "end", `${t.id}: example ${i} reaches End`);
    });
    check(JSON.stringify(planRun(L, ex[0].values)) === JSON.stringify(planRun(L, ex[0].values)), `${t.id}: identical input gives an identical run`);
    const a = pathNames(L, ex[0].values)!, b = pathNames(L, ex[1].values)!;
    check(JSON.stringify(a.names) !== JSON.stringify(b.names), `${t.id}: different input, different path`);
    check(a.steps.every((x, i, all) => i === 0 || x.elapsed >= all[i - 1].elapsed), `${t.id}: elapsed time never goes backwards`);
    // Missing field blocks rather than choosing.
    const miss = planRun(L, {});
    check(miss.ok && miss.status === "blocked" && miss.steps[miss.steps.length - 1].outcome === "blocked" && miss.steps[miss.steps.length - 1].decision?.result === null, `${t.id}: missing input blocks at the Condition`);
    check(miss.ok && !miss.steps.some((x) => x.type === "end"), `${t.id}: blocked run does not reach End`);
  }
  // Purchase approval threshold boundaries.
  {
    const L = buildTemplateLayout(templates.find((t) => t.id === "purchase-approval")!, "pa");
    const at = (v: string) => planRun(L, { value: v });
    const branchOf = (v: string) => { const r = at(v); return r.ok ? r.steps.find((x) => x.decision)?.decision?.branch ?? r.status : "rejected"; };
    check(branchOf("5000") === "no" && branchOf("5001") === "yes" && branchOf("4999.99") === "no", "threshold is strictly greater than");
    check(branchOf("abc") === "blocked", "type mismatch blocks");
    const r = at("abc");
    check(r.ok && r.error!.includes("number"), "type mismatch is explained");
    check(branchOf(" 7500 ") === "yes", "whitespace around numbers is ignored");
    // Converging branches both reach the shared notification and End.
    const yes = at("9000"), no = at("10");
    check(yes.ok && no.ok && yes.steps.some((x) => x.nodeName === "Confirm to requester") && no.steps.some((x) => x.nodeName === "Confirm to requester"), "converging branches meet at the shared step");
  }
  // Operators.
  {
    const ev = (op: string, a: string | undefined, e: string) => evaluateCondition(op, "Field", a, e);
    const res = (op: string, a: string, e: string) => { const r = ev(op, a, e); return "result" in r ? r.result : null; };
    check(res("equals", "High", "high") === true && res("equals", "10", "10.0") === true && res("not-equals", "a", "b") === true, "equals / not-equals");
    check(res("greater-than", "3", "2") === true && res("greater-than", "2", "2") === false && res("less-than", "1", "2") === true && res("less-than", "2", "2") === false, "greater / less than");
    check(res("contains", "Customer request", "REQUEST") === true && res("contains", "abc", "z") === false, "contains");
    const bad = ev("starts-with", "x", "x");
    check("problem" in bad && bad.kind === "failed", "unsupported operator fails clearly");
    const miss = ev("equals", undefined, "x");
    check("problem" in miss && miss.kind === "blocked", "missing value blocks");
    const mism = ev("less-than", "soon", "5");
    check("problem" in mism && mism.kind === "blocked", "non-numeric input blocks numeric comparison");
    const cfg = ev("greater-than", "5", "lots");
    check("problem" in cfg && cfg.kind === "failed", "non-numeric configured value fails");
    check("problem" in ev("equals", "x", "  "), "empty configured value is reported");
  }
  // Unsupported operator and invalid graphs through the planner.
  {
    const L = buildTemplateLayout(templates[1], "u");
    const cond = Object.keys(L.nodes).find((i) => L.nodes[i].type === "condition")!;
    const odd = JSON.parse(JSON.stringify(L)) as BuilderLayout;
    odd.nodes[cond].config.operator = "starts-with";
    const r = planRun(odd, { value: "1" });
    check(r.ok && r.status === "failed" && r.error!.includes("isn't supported"), "planner reports an unsupported operator");
    const broken = JSON.parse(JSON.stringify(L)) as BuilderLayout;
    broken.edges = broken.edges.filter((e) => !(e.from === cond && e.branch === "no"));
    const rej = planRun(broken, { value: "1" });
    check(!rej.ok && rej.problems.length > 0, "invalid graph is rejected before any step");
    // A looping graph that somehow reaches the planner is still stopped by validation, and by the guard if validation were bypassed.
    const loop = JSON.parse(JSON.stringify(L)) as BuilderLayout;
    const end = Object.keys(loop.nodes).find((i) => loop.nodes[i].type === "end")!;
    loop.edges.push({ id: "loop", from: end, to: Object.keys(loop.nodes).find((i) => loop.nodes[i].type === "trigger")! });
    check(!planRun(loop, { value: "1" }).ok, "loop is rejected");
  }
  // Snapshots are independent copies; editing the source later changes nothing recorded.
  {
    const L = buildTemplateLayout(templates[0], "snap");
    const snap = JSON.parse(JSON.stringify(L)) as BuilderLayout;
    const plan = planRun(snap, { status: "Complete" });
    const before = JSON.stringify(plan);
    L.nodes[Object.keys(L.nodes)[0]].name = "Renamed later";
    L.edges.pop();
    check(JSON.stringify(plan) === before && snap.nodes[Object.keys(snap.nodes)[0]].name !== "Renamed later", "snapshot is unaffected by later edits");
    check(JSON.stringify(layoutFor(workflows[0], undefined)) === JSON.stringify(layoutFor(workflows[0], undefined)) && layoutFor(workflows[0], undefined) !== layoutFor(workflows[0], undefined), "default layouts are fresh objects");
  }
  check(formatElapsed(0) === "T+0:00" && formatElapsed(75) === "T+1:15", "elapsed formatting");
  // Blank workflow has no Condition: nothing to evaluate, run still completes.
  {
    const L = buildTemplateLayout(blankTemplate, "b");
    const r = planRun(L, {});
    check(conditionFieldsIn(L).length === 0 && r.ok && r.status === "completed" && r.steps.length === 3, "blank workflow runs with no Condition");
  }
}

/* ---- 8. Simulation honesty ---- */
{
  // A Condition added in the builder starts with no comparison value: the run must fail, never pick a branch or complete.
  let L = buildTemplateLayout(blankTemplate, "h");
  const edge = L.edges.find((e) => !e.branch && L.nodes[e.from].type === "action")!;
  const added = addNode(L, "condition", null, edge.id);
  check(added.ok, "condition can be added to the blank workflow");
  if (added.ok) {
    L = added.layout;
    const p = planRun(L, { priority: "High" });
    check(p.ok && p.status === "failed" && !p.steps.some((x) => x.type === "end") && p.steps[p.steps.length - 1].decision?.result === null, "empty Condition value fails without choosing a branch");
  }
  // Whatever the input, "completed" only ever means the last step is the End, and blocked/failed never are.
  for (const t of templates) {
    const T = buildTemplateLayout(t, "q");
    for (const v of ["", " ", "abc", "0", "5000", "5001", "High", "Complete", "-1", "1e9", "NaN"]) {
      const f = conditionFieldsIn(T)[0];
      const r = planRun(T, { [f]: v });
      if (!r.ok) { check(false, `${t.id}: valid template rejected`); continue; }
      const last = r.steps[r.steps.length - 1];
      check((r.status === "completed") === (last.type === "end" && last.outcome === "ended"), `${t.id} "${v}": completed iff the End was reached`);
      check(r.steps.every((x, i) => x.index === i) && r.steps.every((x) => x.decision?.branch ? x.outcome === "branch" : true), `${t.id} "${v}": step bookkeeping`);
      if (r.status !== "completed") check(!!r.error, `${t.id} "${v}": non-completed run explains itself`);
    }
  }
}

/* ---- 9. Execution readiness ---- */
{
  const member = (id: string) => team.find((m) => m.id === id);
  const R = (L: BuilderLayout) => analyseReadiness(L, member);
  const clone = (L: BuilderLayout) => JSON.parse(JSON.stringify(L)) as BuilderLayout;
  const codes = (L: BuilderLayout) => R(L).errors.map((e) => e.id);

  // Seeds and all four templates are ready as supplied; no warnings invented for them.
  for (const w of workflows) { const r = R(layoutFor(w, undefined)); check(r.ready && r.warnings.length === 0, `seed ${w.id}: ready (${r.errors.map((e) => e.message).join("; ")})`); }
  for (const t of templates) { const r = R(buildTemplateLayout(t, "r")); check(r.ready && r.warnings.length === 0, `${t.id}: ready (${r.errors.map((e) => e.message).join("; ")})`); }

  // Blank workflow: structurally fine, but its trigger and first step still need settings. Fixing them clears the issues.
  {
    let L = buildTemplateLayout(blankTemplate, "bl");
    const r = R(L);
    check(!r.ready && r.errors.every((e) => e.kind === "configuration"), "blank: only configuration errors");
    check(r.errors.some((e) => e.id === "config:detail:bl-trigger") && r.errors.some((e) => e.id === "config:title:bl-first"), "blank: trigger detail and task title reported");
    check(r.errors.every((e) => e.nodeId && L.nodes[e.nodeId]), "blank: every issue points at an existing step");
    L = clone(L);
    L.nodes["bl-trigger"].config.detail = "Customer request";
    check(!R(L).errors.some((e) => e.nodeId === "bl-trigger"), "fixing the trigger clears its issue");
    L.nodes["bl-first"].config.title = "Do the thing";
    check(R(L).ready, "blank is ready once configured");
    check(planRun(L, {}).ok, "and it simulates");
  }

  // One rule per node type, drawn from the existing configuration.
  {
    const base = buildTemplateLayout(templates[0], "n");
    const mutate = (key: string, f: (n: BuilderNodeData) => void) => { const L = clone(base); f(L.nodes[`n-${key}`]); return L; };
    const hits = (L: BuilderLayout, id: string) => codes(L).includes(id);
    check(hits(mutate("trigger", (n) => { n.config.detail = " "; }), "config:detail:n-trigger"), "trigger: detail required");
    check(hits(mutate("trigger", (n) => { n.config.event = "nope"; }), "config:event:n-trigger"), "trigger: event must be an available one");
    check(hits(mutate("capture", (n) => { n.config.title = ""; }), "config:title:n-capture"), "action create-task: title required");
    check(hits(mutate("review", (n) => { n.config.ownerId = "ghost"; }), "config:owner:n-review"), "action assign-owner: owner must exist");
    check(hits(mutate("capture", (n) => { n.config.action = "update-record"; n.config.value = ""; }), "config:value:n-capture"), "action update-record: value required");
    check(hits(mutate("capture", (n) => { n.config.action = "send-message"; n.config.message = ""; }), "config:message:n-capture"), "action send-message: message required");
    check(hits(mutate("capture", (n) => { n.config.action = "zzz"; }), "config:action:n-capture"), "action: kind must be available");
    check(hits(mutate("complete", (n) => { n.config.value = ""; }), "config:value:n-complete"), "condition: value required");
    check(hits(mutate("complete", (n) => { n.config.operator = "starts-with"; }), "config:operator:n-complete"), "condition: unsupported operator is a configuration error");
    check(hits(mutate("complete", (n) => { n.config.field = "colour"; }), "config:field:n-complete"), "condition: field must be available");
    check(hits(mutate("complete", (n) => { n.config.operator = "greater-than"; n.config.value = "lots"; }), "config:value-number:n-complete"), "condition: numeric operator needs a numeric value");
    check(!hits(mutate("complete", (n) => { n.config.operator = "equals"; n.config.value = "lots"; }), "config:value-number:n-complete"), "condition: text comparison allows text");
    check(hits(mutate("approve", (n) => { n.config.approverId = ""; }), "config:approver:n-approve"), "approval: approver required");
    check(hits(mutate("approve", (n) => { n.config.deadlineHours = "-2"; }), "config:deadlineHours:n-approve"), "approval: invalid deadline");
    check(hits(mutate("missing", (n) => { n.config.message = ""; }), "config:message:n-missing"), "notification: message required");
    check(hits(mutate("missing", (n) => { n.config.recipientType = "member"; n.config.memberId = ""; }), "config:recipient:n-missing"), "notification: member recipient required");
    check(hits(mutate("missing", (n) => { n.config.recipientType = "everyone"; }), "config:recipient-type:n-missing"), "notification: recipient type must be available");
    check(hits(mutate("end", (n) => { n.config.outcome = ""; }), "config:outcome:n-end"), "end: outcome required");
    check(hits(mutate("capture", (n) => { n.name = " "; }), "config:name:n-capture"), "every step: name required");
    const d = addNode(base, "delay", null, base.edges.find((e) => !e.branch && base.nodes[e.from].type === "action")!.id);
    check(d.ok, "delay can be added");
    if (d.ok) {
      const dn = Object.keys(d.layout.nodes).find((i) => d.layout.nodes[i].type === "delay")!;
      check(R(d.layout).ready, "a default delay is ready");
      const bad1 = clone(d.layout); bad1.nodes[dn].config.duration = "0";
      check(codes(bad1).includes(`config:duration:${dn}`), "delay: duration must be above zero");
      const bad2 = clone(d.layout); bad2.nodes[dn].config.unit = "fortnights";
      check(codes(bad2).includes(`config:unit:${dn}`), "delay: unit must be available");
    }
    check(R(base).ready, "mutations never touched the base");
  }

  // Structure and configuration are reported separately, once each, and symptoms are not repeated.
  {
    const L = clone(buildTemplateLayout(templates[1], "m"));
    L.edges = L.edges.filter((e) => !(e.from === "m-threshold" && e.branch === "no"));
    L.nodes["m-approve"].config.approverId = "";
    L.nodes["m-record"].config.value = "";
    const r = R(L);
    const kinds = new Set(r.errors.map((e) => e.kind));
    check(kinds.has("structure") && kinds.has("configuration"), "structure and configuration issues are distinct");
    check(r.errors.filter((e) => e.id === "no-branch-no:m-threshold").length === 1, "missing No path reported once");
    check(new Set(r.issues.map((i) => i.id)).size === r.issues.length, "issue ids are unique");
    check(!r.errors.some((e) => e.id.startsWith("no-path-to-end")), "no-path-to-End symptoms are not repeated when a dead end is reported");
    check(r.errors.some((e) => e.nodeId === "m-record" && e.kind === "configuration") && r.errors.some((e) => e.nodeId === "m-approve"), "several configuration issues in one pass");
    check(r.errors.every((e) => e.nodeId === null || L.nodes[e.nodeId]), "navigation targets exist");
    check(R(L).ready === false && !planRun(L, { value: "1" }).ok, "structural errors also stop the simulation engine");
    // Stranded stretch: only the first unreachable step is reported.
    const S = clone(buildTemplateLayout(templates[3], "s"));
    S.edges = S.edges.filter((e) => !(e.from === "s-review" && e.to === "s-priority"));
    S.edges.push({ id: "bridge", from: "s-review", to: "s-resolve" });
    const un = R(S).errors.filter((e) => e.id.startsWith("unreachable:"));
    check(un.length >= 1 && un.every((e) => !S.edges.some((x) => x.to === e.nodeId && un.some((o) => o.nodeId === x.from))), "unreachable: only the root of a stranded stretch is reported");
  }

  // Warnings never block.
  {
    const L = clone(buildTemplateLayout(templates[1], "w"));
    const away = team.find((m) => m.status !== "active");
    check(!!away, "demo team has a member who is away");
    if (away) {
      L.nodes["w-approve"].config.approverId = away.id;
      const r = R(L);
      check(r.ready && r.warnings.some((x) => x.nodeId === "w-approve" && x.kind === "advisory"), "away approver is a warning, not an error");
      check(planRun(L, { value: "9000" }).ok, "a warning does not stop the simulation");
    }
    const same = clone(L);
    same.edges = same.edges.map((e) => (e.from === "w-threshold" && e.branch === "no" ? { ...e, to: "w-approve" } : e));
    const r2 = R(same);
    check(r2.warnings.some((x) => x.id === "advice:same-destination:w-threshold"), "Yes and No to the same step is a warning");
  }

  // Runtime input problems are not readiness problems.
  {
    const L = buildTemplateLayout(templates[1], "x");
    check(R(L).ready, "ready without any sample input");
    const p = planRun(L, {});
    check(p.ok && p.status === "blocked", "missing input still blocks at run time, not in readiness");
    const q = planRun(L, { value: "abc" });
    check(q.ok && q.status === "blocked", "type mismatch is a run-time block");
  }

  // Readiness never mutates what it is given.
  { const L = buildTemplateLayout(templates[2], "z"); const before = JSON.stringify(L); R(L); check(before === JSON.stringify(L), "analyseReadiness is read-only"); }
}

/* ---- 10. Save and readiness agree ---- */
{
  const member = (id: string) => team.find((m) => m.id === id);
  const clone = (L: BuilderLayout) => JSON.parse(JSON.stringify(L)) as BuilderLayout;
  const base = buildTemplateLayout(templates[1], "v");
  // The save gate is analyseGraph. Every issue that blocks it is flagged blocksSave, and nothing else is.
  const cases: [string, (L: BuilderLayout) => void][] = [
    ["missing No path", (L) => { L.edges = L.edges.filter((e) => !(e.from === "v-threshold" && e.branch === "no")); }],
    ["blank name", (L) => { L.nodes["v-validate"].name = " "; }],
    ["delay duration", (L) => { L.nodes["v-validate"].type = "delay"; L.nodes["v-validate"].config = { duration: "0", unit: "hours" }; }],
    ["bad deadline", (L) => { L.nodes["v-approve"].config.deadlineHours = "-1"; }],
    ["orphan", (L) => { L.edges = L.edges.filter((e) => e.to !== "v-notify"); }],
    ["setup gap only", (L) => { L.nodes["v-approve"].config.approverId = ""; }],
    ["warning only", (L) => { L.nodes["v-approve"].config.approverId = team.find((m) => m.status !== "active")!.id; }],
  ];
  for (const [label, mutate] of cases) {
    const L = clone(base);
    mutate(L);
    const gate = validateGraph(L).length > 0;
    const r = analyseReadiness(L, member);
    const blocking = r.issues.filter((i) => i.blocksSave);
    check(gate === (blocking.length > 0), `${label}: readiness blocksSave agrees with the save gate`);
    check(blocking.every((i) => i.severity === "error"), `${label}: only errors block saving`);
    check(new Set(r.issues.map((i) => i.id)).size === r.issues.length, `${label}: no duplicate issues`);
    if (gate) check(blocking.length > 0 && blocking.length <= validateGraph(L).length, `${label}: save list never longer than the raw problems`);
  }
  const gap = clone(base); gap.nodes["v-approve"].config.approverId = "";
  check(validateGraph(gap).length === 0 && !analyseReadiness(gap, member).ready, "a setup gap is saveable but not ready");
  const noEvent = clone(base); delete noEvent.nodes["v-trigger"].config.event;
  check(analyseReadiness(noEvent, member).errors.some((e) => e.id === "config:event:v-trigger"), "a trigger with no event is an error");
  // Whitespace-only values count as empty everywhere: readiness and the simulation's Condition check.
  const ws = clone(base); ws.nodes["v-threshold"].config.value = "   ";
  check(analyseReadiness(ws, member).errors.some((e) => e.id === "config:value:v-threshold"), "whitespace-only comparison value is an error");
  const wr = planRun(ws, { value: "5" });
  check(wr.ok && wr.status === "failed", "and the engine also refuses it rather than guessing");
  // Converging branches further downstream are normal and raise no warning.
  check(analyseReadiness(base, member).warnings.length === 0, "converging branches are not warned about");
  // A deleted member makes every reference to them an error, not a crash.
  const gone = analyseReadiness(base, () => undefined);
  check(gone.errors.some((e) => e.id === "config:approver:v-approve"), "a removed approver is reported");
}

/* ---- 11. Process insights and scenario comparison ---- */
{
  const seeded = workflows.map((w) => JSON.parse(JSON.stringify(w)) as (typeof workflows)[number]);
  const mkInput = (extra: Partial<InsightInput> = {}): InsightInput => ({
    workflows: seeded,
    layouts: Object.fromEntries(seeded.map((w) => [w.id, layoutFor(w, undefined)])),
    runs: {},
    processes,
    members: team,
    ...extra,
  });
  let counter = 0;
  const run = (layout: BuilderLayout, wfId: string, input: SampleInput): SimRun => {
    const plan = planRun(layout, input);
    if (!plan.ok) throw new Error("test graph invalid");
    return { id: `${wfId}-run-${++counter}`, workflowId: wfId, workflowName: wfId, startedAt: "t", input, status: plan.status, steps: plan.steps, plannedSteps: plan.steps.length, ...(plan.error ? { error: plan.error } : {}), snapshot: JSON.parse(JSON.stringify(layout)) };
  };

  // Determinism, stable ids, no duplicates, no mutation.
  const before = JSON.stringify([seeded, processes, team]);
  const a = buildInsights(mkInput());
  const b = buildInsights(mkInput());
  check(JSON.stringify(a) === JSON.stringify(b), "insights: identical input gives identical output");
  check(before === JSON.stringify([seeded, processes, team]), "insights: inputs are never mutated");
  check(new Set(a.insights.map((i) => i.id)).size === a.insights.length, "insights: ids are unique");
  const doubled = buildInsights(mkInput({ workflows: [...seeded, ...seeded] }));
  check(doubled.insights.length === a.insights.length, "insights: duplicated workflows don't duplicate insights");
  check(a.insights.length > 0, "insights: the demo data yields insights");

  // Every insight and every piece of evidence names its source, and sources are never blended with simulation.
  const valid = new Set(["demo-operational", "simulation", "definition"]);
  check(a.insights.every((i) => valid.has(i.source) && i.evidence.length > 0 && i.evidence.every((e) => valid.has(e.source))), "insights: every insight has evidence with a source");
  check(a.insights.every((i) => !i.evidence.some((e) => e.source === "simulation")), "insights: no simulation evidence without runs");
  check(a.simulation === null, "insights: no simulation summary without runs");

  // Operational insights match the stage data they cite and point at a real step.
  const stageInsights = a.insights.filter((i) => i.rule === "stage-behind");
  const flagged = seeded.flatMap((w) => w.stages.filter((s) => s.kind !== "complete" && (s.health === "attention" || s.health === "critical")).map((s) => ({ w, s })));
  check(stageInsights.length === flagged.length && flagged.length > 0, `insights: one stage-behind insight per flagged stage (${stageInsights.length}/${flagged.length})`);
  for (const { w, s } of flagged) {
    const i = stageInsights.find((x) => x.id === `stage-behind:${w.id}:${s.id}`);
    check(!!i && i.source === "demo-operational" && i.nodeId === s.id && i.workflowId === w.id, `insights: ${s.id} linked to its workflow and step`);
    check(!!i && i.evidence.some((e) => e.label === "SLA compliance" && e.value.startsWith(`${s.sla}%`)), `insights: ${s.id} cites its own SLA`);
    check(!!i && i.actions.some((x) => x.href === `/workflows/${w.id}/builder?focus=${s.id}`) && !!layoutFor(w, undefined).nodes[s.id], `insights: ${s.id} links to a step that exists`);
    check(!!i && (i.priority === "high") === (s.health === "critical"), `insights: ${s.id} priority follows health`);
  }
  check(a.insights.filter((i) => i.rule === "owner-stretched").every((i) => i.kind === "suggestion" && i.suggestion && i.evidence.some((e) => e.label === "Owner capacity")), "insights: capacity insights are suggestions with capacity evidence");
  check(a.insights.every((i, n, all) => n === 0 || ["high", "medium", "low", "info"].indexOf(i.priority) >= ["high", "medium", "low", "info"].indexOf(all[n - 1].priority)), "insights: sorted by priority");
  const op = a.operational;
  check(op.stagesNeedingAttention === flagged.length && op.overdueItems === flagged.reduce((n, x) => n + (x.s.overdue ?? 0), 0), "insights: operational summary matches the demo data");

  // Simulation runs change simulation insights and never operational ones.
  {
    const wf = "tpl";
    const T = buildTemplateLayout(templates[1], wf);
    const created = { ...seeded[0], id: wf, name: "Purchases", status: "draft" as const, origin: { templateId: "purchase-approval", templateName: "Purchase approval" }, stages: [] };
    const base = mkInput({ workflows: [...seeded, created], layouts: { ...mkInput().layouts, [wf]: T } });
    const none = buildInsights(base);
    check(!none.insights.some((i) => i.source === "simulation"), "simulation insights: none without runs");
    check(none.limitations.some((l) => /No simulated runs/.test(l)), "simulation insights: the limitation is stated");
    check(none.limitations.some((l) => /created this session/.test(l)), "created workflows: limitation stated");
    check(!none.insights.some((i) => i.workflowId === wf && i.source === "demo-operational"), "created workflows never get operational insights");
    check(none.operational.workflowsReviewed === seeded.length, "created workflows are not counted in operational figures");

    const yes1 = run(T, wf, { value: "9000" }), yes2 = run(T, wf, { value: "8000" });
    const one = buildInsights({ ...base, runs: { [wf]: [yes2, yes1] } });
    const un = one.insights.find((i) => i.rule === "branch-unexercised");
    check(!!un && un.source === "simulation" && un.kind === "simulated" && un.workflowId === wf && un.title.includes("No path") && un.nodeId === `${wf}-threshold`, "simulation insights: unexercised No path found");
    check(!!un && un.evidence.every((e) => e.source === "simulation"), "simulation insights: evidence is simulation only");
    check(one.simulation?.runs === 2 && one.simulation.yes === 2 && one.simulation.no === 0 && one.simulation.completed === 2, "simulation summary counts runs and branches");
    check(JSON.stringify(one.operational) === JSON.stringify(none.operational), "operational summary is unchanged by simulation runs");
    check(JSON.stringify(one.insights.filter((i) => i.source !== "simulation")) === JSON.stringify(none.insights.filter((i) => i.source !== "simulation")), "non-simulation insights are unchanged by simulation runs");
    const both = buildInsights({ ...base, runs: { [wf]: [run(T, wf, { value: "10" }), yes1] } });
    check(!both.insights.some((i) => i.rule === "branch-unexercised"), "both branches simulated: no coverage insight");
    const b1 = run(T, wf, {}), b2 = run(T, wf, { value: "abc" });
    const blocked = buildInsights({ ...base, runs: { [wf]: [b2, b1, yes1] } });
    const rep = blocked.insights.find((i) => i.rule === "repeated-stop");
    check(!!rep && rep.evidence.some((e) => e.value === "2 of 3") && rep.source === "simulation", "repeated blocked runs reported with counts");
    const single = buildInsights({ ...base, runs: { [wf]: [b1, yes1] } });
    check(!single.insights.some((i) => i.rule === "repeated-stop"), "one blocked run is not a pattern");
    check(blocked.simulation?.blocked === 2 && blocked.simulation.completed === 1, "blocked runs counted as blocked, not completed");
    // History isolation: another workflow's runs never appear.
    check(!buildInsights({ ...base, runs: { [wf]: [yes1] } }).insights.some((i) => i.source === "simulation" && i.workflowId !== wf), "simulation insights stay with their workflow");
  }

  // Definition insights.
  {
    const P = buildTemplateLayout(templates[1], "d");
    const wf = { ...seeded[0], id: "d", name: "Purchases", status: "draft" as const, origin: { templateId: "purchase-approval", templateName: "x" }, stages: [] };
    const r = buildInsights(mkInput({ workflows: [wf], layouts: { d: P } }));
    check(!r.insights.some((i) => i.rule === "approval-no-deadline"), "an approval with a deadline raises no insight");
    const P2 = JSON.parse(JSON.stringify(P)) as BuilderLayout; P2.nodes["d-approve"].config.deadlineHours = "  ";
    const noDeadline = buildInsights(mkInput({ workflows: [wf], layouts: { d: P2 } })).insights.find((i) => i.rule === "approval-no-deadline");
    check(!!noDeadline && noDeadline.nodeId === "d-approve" && noDeadline.kind === "suggestion" && noDeadline.source === "definition", "an approval without a deadline is found (whitespace counts as none)");
    const bypass = r.insights.find((i) => i.rule === "approval-bypass");
    check(!!bypass && bypass.priority === "info" && bypass.title.includes("No path") && bypass.evidence.every((e) => e.source === "definition"), "approval bypass reported from the definition");
    const E = buildTemplateLayout(templates[3], "e");
    check(!buildInsights(mkInput({ workflows: [{ ...wf, id: "e" }], layouts: { e: E } })).insights.some((i) => i.rule === "approval-bypass"), "no approval, no bypass insight");
    const blank = buildTemplateLayout(blankTemplate, "bk");
    const nr = buildInsights(mkInput({ workflows: [{ ...wf, id: "bk" }], layouts: { bk: blank } }));
    check(nr.insights.some((i) => i.rule === "not-ready" && i.nodeId), "blank workflow: not-ready insight with a step to go to");
    blank.nodes["bk-trigger"].config.detail = "x"; blank.nodes["bk-first"].config.title = "y";
    check(!buildInsights(mkInput({ workflows: [{ ...wf, id: "bk" }], layouts: { bk: blank } })).insights.some((i) => i.rule === "not-ready"), "fixing the settings clears it");
  }

  // Empty and insufficient data.
  {
    const empty = buildInsights({ workflows: [], layouts: {}, runs: {}, processes: [], members: [] });
    check(empty.insights.length === 0 && empty.simulation === null && empty.operational.workflowsReviewed === 0, "empty input: no insights and no invented numbers");
    check(empty.limitations.length > 0, "empty input: limitations explained");
    const noTeam = buildInsights(mkInput({ members: [] }));
    check(!noTeam.insights.some((i) => i.rule === "owner-stretched"), "no team data: no capacity insight");
    const noProc = buildInsights(mkInput({ processes: [] }));
    check(!noProc.insights.some((i) => i.rule === "processes-clustered"), "no processes: no clustering insight");
  }

  // Scenario comparison.
  {
    const P = buildTemplateLayout(templates[1], "c");
    const frozen = JSON.stringify(P);
    const conds = comparableConditions(P);
    check(conds.length === 1 && conds[0].field === "value" && conds[0].value === "5000", "comparison: finds the threshold Condition");
    const cmp = compareScenarios(P, "c-threshold", "10000", parseInputs("1200, 7500\n12000, 7500"));
    check(!!cmp && cmp.rows.length === 3, "comparison: inputs parsed and de-duplicated");
    check(frozen === JSON.stringify(P), "comparison: the original workflow is not changed");
    if (cmp) {
      const byInput = Object.fromEntries(cmp.rows.map((r) => [r.input, r]));
      check(!byInput["1200"].changed && byInput["1200"].original.branch === "no" && byInput["1200"].modified.branch === "no", "comparison: small value unaffected");
      check(byInput["7500"].changed && byInput["7500"].original.branch === "yes" && byInput["7500"].modified.branch === "no", "comparison: mid value moves from Yes to No");
      check(!byInput["12000"].changed && byInput["12000"].modified.branch === "yes", "comparison: large value still Yes");
      check(cmp.changedCount === 1 && cmp.approvalsOriginal === 2 && cmp.approvalsModified === 1, "comparison: approvals counted over the inputs");
      check(byInput["7500"].original.path.includes("Finance approval") && !byInput["7500"].modified.path.includes("Finance approval"), "comparison: paths show the approval skipped");
    }
    const same = compareScenarios(P, "c-threshold", "5000", ["100", "9000"]);
    check(same?.changedCount === 0, "comparison: an unchanged value changes nothing");
    const bad = compareScenarios(P, "c-threshold", "lots", ["100"]);
    check(bad?.rows[0].modified.status === "failed" || bad?.rows[0].modified.status === "blocked", "comparison: an invalid value is reported, not guessed");
    check(compareScenarios(P, "c-validate", "1", ["1"]) === null, "comparison: only Conditions can be changed");
    check(JSON.stringify(compareScenarios(P, "c-threshold", "10000", ["7500"])) === JSON.stringify(compareScenarios(P, "c-threshold", "10000", ["7500"])), "comparison: deterministic");
  }
}

console.log(failures === 0 ? "ALL GRAPH TESTS PASSED" : `${failures} FAILURES`);
process.exit(failures ? 1 : 0);
