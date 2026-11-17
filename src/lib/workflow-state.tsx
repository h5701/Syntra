"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { eventsFor, nowStamp } from "@/lib/data/workflow-events";
import { workflows as seedWorkflows } from "@/lib/data/workflows";
import { layoutFor } from "@/lib/simulation";
import { createFromTemplate, deriveStages, type WorkflowTemplate } from "@/lib/workflow-templates";
import type { SimRun } from "@/lib/simulation";
import type { BuilderEdge, BuilderNodeData } from "@/lib/builder-nodes";
import type { StageItem, Workflow, WorkflowEvent, WorkflowStatus } from "@/lib/types";

/**
 * Session-only demo state for workflows. Static demo data stays the source of truth;
 * anything the operator changes is layered on top as an override. No persistence:
 * a refresh clears it.
 */

export interface WorkflowMeta {
  name: string;
  description: string;
  ownerId: string;
  status: WorkflowStatus;
}

/**
 * The builder's graph for a workflow: where each step sits, how steps are connected, and each
 * step's name, description and configuration (original stages and added steps alike).
 */
export interface BuilderLayout {
  positions: Record<string, { x: number; y: number }>;
  /** Every step, listed in path order. Used for numbering only; connections are `edges`. */
  order: string[];
  nodes: Record<string, BuilderNodeData>;
  /** The connections. Explicit, so branches and shared destinations are possible. */
  edges: BuilderEdge[];
}

interface Override {
  meta?: WorkflowMeta;
  builder?: BuilderLayout;
  lastRun?: string;
  /** Requests added to the first stage by simulated runs. */
  added?: StageItem[];
  events?: WorkflowEvent[];
  /** Simulated runs, newest first. Separate from the operational figures: recording one changes none of them. */
  runs?: SimRun[];
}

interface Store {
  overrides: Record<string, Override>;
  /** Workflows created this session, in creation order. Seeded workflows are never in here. */
  created: Workflow[];
  patch: (id: string, fn: (o: Override) => Override) => void;
  create: (template: WorkflowTemplate, input: NewWorkflowInput, actorName: string) => string | null;
}

interface NewWorkflowInput {
  name: string;
  description: string;
  ownerId: string;
}

const WorkflowStateContext = createContext<Store | null>(null);

export function WorkflowStateProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [created, setCreated] = useState<Workflow[]>([]);
  const claimed = useRef(new Set(seedWorkflows.map((w) => w.id)));
  const patch = useCallback((id: string, fn: (o: Override) => Override) => {
    setOverrides((prev) => ({ ...prev, [id]: fn(prev[id] ?? {}) }));
  }, []);
  const create = useCallback((template: WorkflowTemplate, input: NewWorkflowInput, actorName: string) => {
    // `claimed` also holds ids from creations that haven't rendered yet, so two quick creations can't collide.
    const made = createFromTemplate(template, input, claimed.current);
    if (!made) return null;
    const { workflow, layout } = made;
    claimed.current.add(workflow.id);
    const first: WorkflowEvent = {
      id: `local-${eventSeq++}`,
      text: `${actorName} created this workflow from the ${template.name} template. It hasn't run yet.`,
      actorId: input.ownerId,
      time: nowStamp(),
      tone: "neutral",
    };
    setCreated((prev) => [...prev, workflow]);
    setOverrides((prev) => ({ ...prev, [workflow.id]: { builder: layout, events: [first] } }));
    return workflow.id;
  }, []);
  const value = useMemo(() => ({ overrides, created, patch, create }), [overrides, created, patch, create]);
  return <WorkflowStateContext.Provider value={value}>{children}</WorkflowStateContext.Provider>;
}

function useStore() {
  const store = useContext(WorkflowStateContext);
  if (!store) throw new Error("Workflow state hooks must be used inside <WorkflowStateProvider>.");
  return store;
}

/** Layers session changes onto a static workflow. */
function applyOverride(base: Workflow, o?: Override): Workflow {
  if (!o) return base;
  const added = o.added ?? [];
  const nodes = o.builder?.nodes;
  // A created workflow's stages follow its graph, so adding, renaming or deleting a step shows up everywhere.
  const baseStages = base.origin && o.builder ? deriveStages(o.builder, o.meta?.ownerId ?? base.ownerId) : base.stages;
  return {
    ...base,
    ...o.meta,
    lastRun: o.lastRun ?? base.lastRun,
    stages: baseStages.map((s, i) => ({
      ...s,
      name: nodes?.[s.id]?.name ?? s.name,
      description: nodes?.[s.id]?.description ?? s.description,
      ...(i === 0 && added.length ? { count: s.count + added.length, items: [...added, ...s.items] } : {}),
    })),
  };
}

let eventSeq = 0;
const NO_RUNS: SimRun[] = [];

/** Every workflow with session changes applied. */
export function useWorkflows(): Workflow[] {
  const { overrides, created } = useStore();
  return useMemo(() => [...seedWorkflows, ...created].map((w) => applyOverride(w, overrides[w.id])), [overrides, created]);
}

/**
 * Everything the process insights read, in one place: each workflow with session changes, its saved
 * graph (or the default one built from its stages), and its simulated runs. Operational figures and
 * simulation runs stay separate here too.
 */
export function useInsightInputs() {
  const { overrides, created } = useStore();
  return useMemo(() => {
    const workflows = [...seedWorkflows, ...created].map((w) => applyOverride(w, overrides[w.id]));
    return {
      workflows,
      layouts: Object.fromEntries(workflows.map((w) => [w.id, layoutFor(w, overrides[w.id]?.builder)])) as Record<string, BuilderLayout>,
      runs: Object.fromEntries(workflows.map((w) => [w.id, overrides[w.id]?.runs ?? []])) as Record<string, SimRun[]>,
    };
  }, [overrides, created]);
}

/** True when a workflow with this id exists in this session (seeded, or created and not lost to a refresh). */
export function useWorkflowExists(id: string): boolean {
  const { created } = useStore();
  return seedWorkflows.some((w) => w.id === id) || created.some((w) => w.id === id);
}

/** Creates a draft workflow from a template and returns its id, or null if the template's graph isn't valid. */
export function useCreateWorkflow() {
  return useStore().create;
}

/** One workflow with session changes applied, plus its events and the actions that change it. */
export function useWorkflow(id: string) {
  const { overrides, created, patch } = useStore();
  const base = seedWorkflows.find((w) => w.id === id) ?? created.find((w) => w.id === id);
  if (!base) throw new Error(`Unknown workflow: ${id}`);
  const override = overrides[id];

  const workflow = useMemo(() => applyOverride(base, override), [base, override]);
  const events = useMemo(() => override?.events ?? eventsFor(base), [base, override]);

  const { id: firstId, name: firstName, ownerId: firstOwner } = workflow.stages[0];
  const actions = useMemo(() => {
    const newEvent = (e: Omit<WorkflowEvent, "id" | "time">): WorkflowEvent => ({ ...e, id: `local-${eventSeq++}`, time: nowStamp() });
    const prepend = (o: Override, ...list: WorkflowEvent[]) => [...list, ...(o.events ?? eventsFor(base))];
    // The first stage as it is now: a created workflow's follows its graph, so it can change.
    const first = { id: firstId, name: firstName, ownerId: firstOwner };

    return {
      saveBuilder: (layout: BuilderLayout) => patch(id, (o) => ({ ...o, builder: layout })),
      setMeta: (meta: WorkflowMeta) => patch(id, (o) => ({ ...o, meta })),
      recordRun: (run: SimRun) => patch(id, (o) => ({ ...o, runs: [run, ...(o.runs ?? [])] })),
      addEvent: (e: Omit<WorkflowEvent, "id" | "time">) => patch(id, (o) => ({ ...o, events: prepend(o, newEvent(e)) })),
      startRun: (actorId: string, actorName: string) =>
        patch(id, (o) => ({
          ...o,
          lastRun: "Just now",
          events: prepend(o, newEvent({ text: `Manual run started by ${actorName}`, actorId, stageId: first.id, tone: "neutral" })),
        })),
      /** Finishes a simulated run: two new requests enter the first stage. */
      completeRun: () =>
        patch(id, (o) => {
          const base1 = 1048 + (o.added?.length ?? 0);
          const fresh: StageItem[] = [0, 1].map((n) => ({
            id: `#${base1 + n}`,
            title: "Submitted through the demo portal",
            assigneeId: first.ownerId,
            age: "Just now",
            priority: "medium",
            state: "awaiting triage",
          }));
          return {
            ...o,
            added: [...fresh, ...(o.added ?? [])],
            events: prepend(
              o,
              newEvent({ text: "Run completed successfully (simulated)", stageId: first.id, tone: "good" }),
              ...fresh.map((f) => newEvent({ text: `Request ${f.id} entered ${first.name}`, stageId: first.id, tone: "neutral" })),
            ),
          };
        }),
    };
  }, [base, id, patch, firstId, firstName, firstOwner]);

  return { workflow, events, actions, builder: override?.builder, runs: override?.runs ?? NO_RUNS };
}
