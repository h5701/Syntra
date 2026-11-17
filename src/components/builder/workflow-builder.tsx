"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Maximize2, Minus, Plus } from "lucide-react";
import { BuilderCanvas } from "@/components/builder/builder-canvas";
import { BuilderCatalogue } from "@/components/builder/builder-catalogue";
import { BuilderDialog } from "@/components/builder/builder-dialog";
import { BuilderEdgeInspector } from "@/components/builder/builder-edge-inspector";
import { BuilderInspector } from "@/components/builder/builder-inspector";
import { BuilderReadiness } from "@/components/builder/builder-readiness";
import { BuilderToolbar } from "@/components/builder/builder-toolbar";
import { Toast } from "@/components/common/toast";
import { workflowStatusTone } from "@/components/common/status";
import { currentUserId } from "@/lib/data/team";
import { addNode, analyseGraph, connectRefusal, connectTargets, deleteEdge, deleteNode, linearEdges, outgoing, retargetEdge, setEdgeLabel, setTarget, unavailableReason, withEdges } from "@/lib/builder-graph";
import { NODE_H, NODE_W, clampZoom, defaultPositions, fitView, focusFirstView, type Pos, type View } from "@/lib/builder-layout";
import { branches, nodeTypes, seedNodeData, validate, type Branch, type CanvasNode, type NodeEdit, type NodeType } from "@/lib/builder-nodes";
import { useSettings } from "@/lib/settings-state";
import { useTeam } from "@/lib/team-state";
import { analyseReadiness, type ReadinessIssue } from "@/lib/readiness";
import { analyseWorkflow } from "@/lib/workflow-health";
import { useWorkflow, type BuilderLayout } from "@/lib/workflow-state";

const noopSubscribe = () => () => {};

const sameLayout = (a: BuilderLayout, b: BuilderLayout) => JSON.stringify(a) === JSON.stringify(b);
const sameEdit = (a: NodeEdit, b: NodeEdit) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Things the operator can do that might lose an unapplied inspector draft. They are described as
 * data (not callbacks) so that, once the draft is resolved, they run against the latest state.
 */
type Action =
  | { k: "select"; id: string | null }
  | { k: "selectEdge"; id: string }
  | { k: "add"; type: NodeType }
  | { k: "save" }
  | { k: "back" };

/**
 * The visual builder. A pannable, zoomable canvas of steps joined along the main path, with a
 * step catalogue and an inspector. Every edit (moving, adding, deleting, renaming, configuring)
 * goes through one undo/redo history and is saved into the shared session state.
 *
 * Two safeguards stop work being lost: an unapplied inspector draft must be applied or discarded
 * before the selection, history or page changes, and unsaved graph changes prompt before leaving.
 * The graph is validated before it can be saved.
 */
export function WorkflowBuilder({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  const { workflow, actions, builder } = useWorkflow(workflowId);
  const { members } = useTeam();
  const operator = useSettings().settings.profile.name;
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const backHref = `/workflows/${workflow.id}`;

  // What's saved: the stored graph, or the default one built from the workflow's stages.
  const baseline = useMemo<BuilderLayout>(() => {
    if (builder) return withEdges(builder);
    const order = workflow.stages.map((st) => st.id);
    return {
      positions: defaultPositions(workflow.stages),
      order,
      nodes: Object.fromEntries(workflow.stages.map((st) => [st.id, seedNodeData(st)])),
      edges: linearEdges(order),
    };
  }, [builder, workflow.stages]);

  const [saved, setSaved] = useState(baseline);
  const [history, setHistory] = useState<{ stack: BuilderLayout[]; i: number }>({ stack: [baseline], i: 0 });
  const [drag, setDrag] = useState<{ id: string; pos: Pos } | null>(null);
  // The latest drag position, readable by the pointer-up handler before React re-renders.
  const dragRef = useRef<{ id: string; pos: Pos } | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // A link from a readiness problem on the workflow page can name the step to open (?focus=<id>).
  const focusParam = useSearchParams().get("focus");
  const [selectedId, setSelectedId] = useState<string | null>(() => (focusParam && baseline.nodes[focusParam] ? focusParam : null));
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  // Inspector comfort: collapse it to reach the canvas; it fades while a connection is being dragged.
  const [collapsed, setCollapsed] = useState(false);
  const [connectingNow, setConnectingNow] = useState(false);
  const [focusConnections, setFocusConnections] = useState(0);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // The inspector draft: edits typed but not yet applied. Lives here so nothing can lose it silently.
  const [draft, setDraft] = useState<{ id: string; edit: NodeEdit } | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState<Action | null>(null);
  const [draftDialog, setDraftDialog] = useState(false);
  const [leaveDialog, setLeaveDialog] = useState(false);
  // What stopped a save: the readiness issues that block saving, each able to take the person to its step.
  const [problems, setProblems] = useState<ReadinessIssue[] | null>(null);
  // Moves keyboard focus after a readiness action: back to the chip, or onto the step that was chosen.
  const [focusAfter, setFocusAfter] = useState<{ n: number; target: "chip" | string } | null>(null);

  const current = history.stack[history.i];
  const dirty = !sameLayout(current, saved);
  const paused = workflow.status !== "active";
  const health = analyseWorkflow(workflow);

  const memberOf = useCallback((id: string) => members.find((m) => m.id === id), [members]);
  const readiness = useMemo(() => analyseReadiness(current, memberOf), [current, memberOf]);
  const canvasNodes = useMemo<CanvasNode[]>(
    () =>
      current.order.map((id) => {
        const data = current.nodes[id];
        const stage = data.custom ? undefined : workflow.stages.find((s) => s.id === id);
        const found = readiness.byNode[id] ?? [];
        return {
          id,
          data,
          stage,
          issues: found.filter((i) => i.severity === "error").map((i) => i.short),
          warnings: found.filter((i) => i.severity === "warning").map((i) => i.short),
        };
      }),
    [current, workflow.stages, readiness],
  );
  const edges = current.edges;
  const positions = useMemo(() => ({ ...current.positions, ...(drag ? { [drag.id]: drag.pos } : {}) }), [current.positions, drag]);

  const selectedIndex = canvasNodes.findIndex((n) => n.id === selectedId);
  const selected = selectedIndex >= 0 ? canvasNodes[selectedIndex] : null;
  const selectedEdge = current.edges.find((e) => e.id === selectedEdgeId) ?? null;
  const appliedEdit: NodeEdit | null = selected ? { name: selected.data.name, description: selected.data.description, config: selected.data.config } : null;
  const edit = draft && selected && draft.id === selected.id ? draft.edit : appliedEdit;
  const draftDirty = !!(draft && appliedEdit && selected && draft.id === selected.id && !sameEdit(draft.edit, appliedEdit));
  const connections =
    selected && selected.data.type !== "end"
      ? selected.data.type === "condition"
          ? branches.map((b) => ({ branch: b.id as Branch | undefined, to: outgoing(current, selected.id).find((e) => e.branch === b.id)?.to ?? "", targets: connectTargets(current, selected.id, b.id) }))
          : [{ branch: undefined as Branch | undefined, to: outgoing(current, selected.id)[0]?.to ?? "", targets: connectTargets(current, selected.id) }]
      : [];
  const draftErrors = attempted && edit && selected ? validate({ type: selected.data.type, name: edit.name, config: edit.config }) : {};

  // Overview of every step. The starting view is the overview on larger screens, and a readable
  // close-up of the first step on phones, where an overview would be too small to use.
  const overview = useMemo(() => fitView(Object.values(positions), size.w, size.h), [positions, size]);
  const startView = useMemo(() => (size.w > 0 && size.w < 768 ? focusFirstView(positions[current.order[0]], size.h) : overview), [size, positions, current.order, overview]);
  const activeView = view ?? startView;

  /** Adds an entry to the history. Changes that leave the graph as it was are ignored. */
  const commit = useCallback((next: BuilderLayout) => {
    setHistory((h) => (sameLayout(h.stack[h.i], next) ? h : { stack: [...h.stack.slice(0, h.i + 1), next], i: h.i + 1 }));
  }, []);

  const zoomAround = (factor: number) => {
    const z = clampZoom(activeView.z * factor, activeView.z);
    const k = z / activeView.z;
    const px = size.w / 2;
    const py = size.h / 2;
    setView({ z, x: px - (px - activeView.x) * k, y: py - (py - activeView.y) * k });
  };

  const onSize = useCallback((w: number, h: number) => setSize((s) => (s.w === w && s.h === h ? s : { w, h })), []);

  /** Brings a step into view at a readable size, clear of the inspector. */
  const reveal = (pos: Pos) => {
    const wide = size.w >= 768;
    const z = Math.max(activeView.z, 0.6);
    const availW = wide ? size.w - 392 : size.w;
    setView({ z, x: availW / 2 - (pos.x + NODE_W / 2) * z, y: (wide ? size.h / 2 : size.h * 0.17) - (pos.y + NODE_H / 2) * z });
  };

  /** From a readiness problem: select the step it concerns and bring it into view. */
  const goToStep = (id: string) => {
    request({ k: "select", id });
    setCollapsed(false);
    setReadinessOpen(false);
    if (positions[id]) reveal(positions[id]);
    // The panel that had focus is closing. If an unapplied draft is asking a question first, the dialog takes focus instead.
    if (!draftDirty) setFocusAfter((f) => ({ n: (f?.n ?? 0) + 1, target: id }));
  };

  const closeReadiness = () => {
    setReadinessOpen(false);
    setFocusAfter((f) => ({ n: (f?.n ?? 0) + 1, target: "chip" }));
  };

  useEffect(() => {
    if (!focusAfter) return;
    const selector = focusAfter.target === "chip" ? '[aria-controls="builder-readiness"]' : `[data-node-id="${CSS.escape(focusAfter.target)}"]`;
    document.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
  }, [focusAfter]);

  /* ---- Actions that act on the graph ---- */

  /** Applies the draft as one history entry. Returns the new graph, or null if the draft is invalid. */
  const applyDraft = (): BuilderLayout | null => {
    if (!selected || !edit) return null;
    const found = validate({ type: selected.data.type, name: edit.name, config: edit.config });
    if (Object.keys(found).length) {
      setAttempted(true);
      return null;
    }
    const next: BuilderLayout = {
      ...current,
      nodes: { ...current.nodes, [selected.id]: { ...selected.data, name: edit.name.trim(), description: edit.description.trim(), config: edit.config } },
    };
    commit(next);
    setDraft(null);
    setAttempted(false);
    setNotice("Step updated. Save to keep your changes.");
    return next;
  };

  const discardDraft = () => {
    setDraft(null);
    setAttempted(false);
  };

  const doSave = (thenLeave: boolean, graph: BuilderLayout = current) => {
    // Structure stays authoritative: if the graph itself is unsound it can't be saved. The list shown
    // comes from the same readiness check as the panel, so the two never disagree.
    const unsound = analyseGraph(graph).problems;
    if (unsound.length) {
      const blocking = analyseReadiness(graph, memberOf).issues.filter((i) => i.blocksSave);
      setProblems(blocking.length ? blocking : unsound.map((message) => ({ id: message, severity: "error", kind: "structure", nodeId: null, message, short: message, blocksSave: true })));
      return;
    }
    const before = new Set(saved.order);
    const now = new Set(graph.order);
    const added = graph.order.filter((id) => !before.has(id)).length;
    const removed = saved.order.filter((id) => !now.has(id)).length;
    const rewired = JSON.stringify(graph.edges.map((e) => [e.from, e.to, e.branch, e.label])) !== JSON.stringify(saved.edges.map((e) => [e.from, e.to, e.branch, e.label]));
    const parts = [added && `${added} ${added === 1 ? "step" : "steps"} added`, removed && `${removed} removed`, rewired && "connections updated"].filter(Boolean);
    actions.saveBuilder(graph);
    actions.addEvent({ text: `Workflow structure updated in the builder by ${operator}${parts.length ? ` (${parts.join(", ")})` : ""}`, actorId: currentUserId, tone: "neutral" });
    setSaved(graph);
    if (thenLeave) router.push(backHref);
    else {
      // Saving only needs a sound graph. Setup gaps can wait, but they stop simulations, so say so.
      const gaps = analyseReadiness(graph, memberOf).errors.length;
      setNotice(gaps ? `Saved. ${gaps} setup ${gaps === 1 ? "problem still needs" : "problems still need"} fixing before this can be simulated.` : "Workflow changes saved");
    }
  };

  const doAdd = (type: NodeType, graph: BuilderLayout = current) => {
    const result = addNode(graph, type, selectedId, selectedEdgeId);
    if (!result.ok) {
      setNotice(result.reason);
      return;
    }
    commit(result.layout);
    discardDraft();
    setSelectedEdgeId(null);
    setSelectedId(result.id);
    setCatalogueOpen(false);
    reveal(result.layout.positions[result.id]);
    const name = result.layout.nodes[result.id].name;
    setNotice(result.after ? `Added "${name}" after "${result.after}"` : `Added "${name}" to the end of the workflow`);
  };

  const run = (a: Action, graph: BuilderLayout = current) => {
    switch (a.k) {
      case "select":
        discardDraft();
        setCatalogueOpen(false);
        setSelectedEdgeId(null);
        setSelectedId(a.id);
        if (!a.id) setCollapsed(false);
        break;
      case "selectEdge":
        discardDraft();
        setCatalogueOpen(false);
        setSelectedId(null);
        setSelectedEdgeId(a.id);
        break;
      case "add": doAdd(a.type, graph); break;
      case "save": doSave(false, graph); break;
      case "back":
        if (!sameLayout(graph, saved)) setLeaveDialog(true);
        else router.push(backHref);
        break;
    }
  };

  /** Runs an action, unless an unapplied draft is in the way, in which case the operator decides first. */
  const request = (a: Action) => {
    if (a.k === "select" && a.id === selectedId && !selectedEdgeId) return;
    if (a.k === "selectEdge" && a.id === selectedEdgeId) return;
    if (draftDirty) {
      setPending(a);
      setDraftDialog(true);
    } else run(a);
  };

  const resolveDraft = (how: "apply" | "discard") => {
    const a = pending;
    setDraftDialog(false);
    setPending(null);
    if (how === "apply") {
      const next = applyDraft();
      if (!next) return; // invalid: stay put and show the errors inline
      if (a) run(a, next);
    } else {
      discardDraft();
      if (a) run(a);
    }
  };

  const removeStep = (id: string) => {
    const name = current.nodes[id].name;
    const result = deleteNode(current, id);
    commit(result.layout);
    discardDraft();
    setSelectedId(null);
    setNotice(result.note ? `Deleted "${name}". ${result.note}` : `Deleted "${name}". Undo brings it back.`);
  };

  /* ---- Connections. Each is one history entry; refusals explain themselves. ---- */

  const connect = (from: string, branch: Branch | undefined, to: string) => {
    if (draftDirty) {
      setNotice("Apply or discard your step edit before changing connections.");
      return;
    }
    const result = setTarget(current, from, branch, to);
    if (!result.ok) {
      setNotice(result.reason);
      return;
    }
    commit(result.layout);
    const edge = result.layout.edges.find((e) => e.from === from && e.branch === branch);
    const path = branch ? `${branch === "yes" ? "Yes" : "No"} path of "${current.nodes[from].name}"` : `"${current.nodes[from].name}"`;
    setNotice(`${path} now goes to "${current.nodes[to].name}"`);
    if (edge) run({ k: "selectEdge", id: edge.id }, result.layout);
  };

  const disconnect = (from: string, branch: Branch | undefined) => {
    const edge = outgoing(current, from).find((e) => e.branch === branch);
    if (!edge) return;
    commit(deleteEdge(current, edge.id));
    setNotice(`Removed the connection. "${current.nodes[from].name}" needs a new ${branch ? (branch === "yes" ? "Yes" : "No") + " path" : "next step"} before you can save.`);
  };

  const removeEdge = (id: string) => {
    const edge = current.edges.find((e) => e.id === id);
    if (!edge) return;
    commit(deleteEdge(current, id));
    setSelectedEdgeId(null);
    setNotice(`Deleted the connection. "${current.nodes[edge.from].name}" needs a new way forward before you can save.`);
  };

  const retarget = (id: string, to: string) => {
    const result = retargetEdge(current, id, to);
    if (!result.ok) {
      setNotice(result.reason);
      return;
    }
    commit(result.layout);
    setNotice(`Connection now goes to "${current.nodes[to].name}"`);
  };

  const relabel = (id: string, label: string) => commit(setEdgeLabel(current, id, label));

  /** Clicking a handle (rather than dragging it) selects the connection leaving it, or else the step. */
  const handleClick = (from: string, branch: Branch | undefined) => {
    const edge = outgoing(current, from).find((e) => e.branch === branch);
    request(edge ? { k: "selectEdge", id: edge.id } : { k: "select", id: from });
  };

  /** Keyboard route to connections: select the step, expand the inspector and focus its connection menus. */
  const nodeKey = (id: string) => {
    request({ k: "select", id });
    setCollapsed(false);
    setFocusConnections((n) => n + 1);
  };

  /* ---- Keyboard, page lock, and leaving the page ---- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (draftDialog || leaveDialog || problems) return;
      const typing = e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "Delete" || e.key === "Backspace") && selectedEdge && !typing && !draftDirty) {
        e.preventDefault();
        removeEdge(selectedEdge.id);
        return;
      }
      if (e.key !== "Escape") return;
      // Close the topmost thing first: the catalogue, then the selection.
      if (catalogueOpen) setCatalogueOpen(false);
      else request({ k: "select", id: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Closing or refreshing the tab: the browser shows its own warning (wording and buttons aren't ours to set).
  const unsafe = dirty || draftDirty;
  useEffect(() => {
    if (!unsafe) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsafe]);

  if (!mounted) return null;

  const status = workflowStatusTone[workflow.status];
  const catalogueNote = selectedEdge
    ? `Goes into the connection from "${current.nodes[selectedEdge.from].name}" to "${current.nodes[selectedEdge.to].name}"${selectedEdge.branch ? ` (the ${selectedEdge.branch === "yes" ? "Yes" : "No"} path)` : ""}.`
    : selected && selected.data.type !== "end"
      ? `Goes after "${selected.data.name}".`
      : "Goes at the end of the workflow, just before the End step.";
  const unavailable = Object.fromEntries(nodeTypes.map((t) => [t.type, unavailableReason(current, t.type)]).filter(([, r]) => r)) as Partial<Record<NodeType, string>>;

  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <BuilderToolbar
        backHref={backHref}
        name={workflow.name}
        status={{ label: status.label, tone: status.tone === "success" ? "success" : status.tone === "warning" ? "warning" : "neutral" }}
        zoom={activeView.z}
        canUndo={history.i > 0 && !draftDirty}
        canRedo={history.i < history.stack.length - 1 && !draftDirty}
        dirty={dirty}
        onUndo={() => setHistory((h) => ({ ...h, i: Math.max(0, h.i - 1) }))}
        onRedo={() => setHistory((h) => ({ ...h, i: Math.min(h.stack.length - 1, h.i + 1) }))}
        onZoomIn={() => zoomAround(1.2)}
        onZoomOut={() => zoomAround(1 / 1.2)}
        onFit={() => setView(overview)}
        onSave={() => request({ k: "save" })}
        onAdd={() => setCatalogueOpen((o) => !o)}
        readiness={readiness}
        readinessOpen={readinessOpen}
        onReadiness={() => (readinessOpen ? closeReadiness() : setReadinessOpen(true))}
        onBack={() => request({ k: "back" })}
      />

      <div className="relative min-h-0 flex-1">
        {readinessOpen && <BuilderReadiness readiness={readiness} nameOf={(id) => current.nodes[id]?.name ?? id} onGo={goToStep} onClose={closeReadiness} />}
        <BuilderCanvas
          nodes={canvasNodes}
          edges={edges}
          positions={positions}
          view={activeView}
          selectedId={selectedId}
          selectedEdgeId={selectedEdgeId}
          paused={paused}
          draggingId={drag?.id ?? null}
          connectCheck={(from, branch, to) => connectRefusal(current, from, branch, to)}
          onView={setView}
          onSize={onSize}
          onSelect={(id) => request({ k: "select", id })}
          onSelectEdge={(id) => request({ k: "selectEdge", id })}
          onConnect={connect}
          onHandleClick={handleClick}
          onConnectingChange={setConnectingNow}
          onNodeKey={nodeKey}
          onDragStart={() => setView((v) => v ?? startView)}
          onDrag={(id, pos) => {
            dragRef.current = { id, pos };
            setDrag({ id, pos });
          }}
          onDragEnd={(id) => {
            const last = dragRef.current;
            if (last && last.id === id) commit({ ...current, positions: { ...current.positions, [id]: last.pos } });
            dragRef.current = null;
            setDrag(null);
          }}
        />

        {/* Orientation: what you're looking at, and how to move around. */}
        <div className="pointer-events-none absolute bottom-4 left-4 hidden max-w-xs rounded-xl border border-border bg-white/90 px-3.5 py-2.5 text-xs text-muted-foreground shadow-card backdrop-blur md:block">
          <p className="font-semibold text-navy">{canvasNodes.length} steps · {health.title}</p>
          <p className="mt-0.5">Scroll to zoom · drag to pan · drag a handle to connect</p>
          <p className="mt-0.5">Branches are drawn here. The live workflow doesn&apos;t run them.</p>
        </div>

        {/* Zoom controls for narrow screens, where the toolbar can't hold them. */}
        <div className="absolute top-3 left-3 flex items-center gap-0.5 rounded-xl border border-border bg-white p-0.5 shadow-card md:hidden" role="group" aria-label="Zoom">
          <button type="button" onClick={() => zoomAround(1 / 1.2)} aria-label="Zoom out" className="inline-flex size-9 items-center justify-center rounded-lg text-slate-600"><Minus className="size-4" /></button>
          <span className="w-11 text-center text-xs font-semibold tabular-nums">{Math.round(activeView.z * 100)}%</span>
          <button type="button" onClick={() => zoomAround(1.2)} aria-label="Zoom in" className="inline-flex size-9 items-center justify-center rounded-lg text-slate-600"><Plus className="size-4" /></button>
          <button type="button" onClick={() => setView(overview)} aria-label="Fit workflow to screen" className="inline-flex size-9 items-center justify-center rounded-lg text-slate-600"><Maximize2 className="size-4" /></button>
        </div>

        <AnimatePresence>
          {selected && edit && (
            <BuilderInspector
              key="inspector"
              node={selected}
              index={selectedIndex}
              total={canvasNodes.length}
              paused={paused}
              edit={edit}
              dirty={draftDirty}
              errors={draftErrors}
              onEdit={(next) => setDraft({ id: selected.id, edit: next })}
              onApply={() => void applyDraft()}
              onDiscard={discardDraft}
              connections={connections}
              connectionsLocked={draftDirty}
              collapsed={collapsed}
              ghost={connectingNow}
              focusConnections={focusConnections}
              onToggleCollapse={() => setCollapsed((c) => !c)}
              onConnect={(branch, to) => (to ? connect(selected.id, branch, to) : disconnect(selected.id, branch))}
              onDelete={() => removeStep(selected.id)}
              onClose={() => request({ k: "select", id: null })}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedEdge && (
            <BuilderEdgeInspector
              key="edge-inspector"
              edge={selectedEdge}
              from={current.nodes[selectedEdge.from]}
              to={current.nodes[selectedEdge.to]}
              targets={connectTargets(current, selectedEdge.from, selectedEdge.branch)}
              locked={draftDirty}
              collapsed={collapsed}
              ghost={connectingNow}
              onToggleCollapse={() => setCollapsed((c) => !c)}
              onRetarget={(to) => retarget(selectedEdge.id, to)}
              onLabel={(label) => relabel(selectedEdge.id, label)}
              onDelete={() => removeEdge(selectedEdge.id)}
              onClose={() => request({ k: "select", id: null })}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {catalogueOpen && <BuilderCatalogue key="catalogue" note={catalogueNote} unavailable={unavailable} onPick={(type) => request({ k: "add", type })} onClose={() => setCatalogueOpen(false)} />}
        </AnimatePresence>
      </div>

      <BuilderDialog
        open={draftDialog}
        title="Apply your changes to this step?"
        description={`You've edited "${selected?.data.name ?? "this step"}" but haven't applied the changes. Apply them to add them to the workflow, or discard them.`}
        onDismiss={() => {
          setDraftDialog(false);
          setPending(null);
        }}
        actions={[
          { label: "Continue editing", tone: "neutral", onClick: () => { setDraftDialog(false); setPending(null); } },
          { label: "Discard changes", tone: "danger", onClick: () => resolveDraft("discard") },
          { label: "Apply changes", tone: "primary", onClick: () => resolveDraft("apply") },
        ]}
      />

      <BuilderDialog
        open={leaveDialog}
        title="Leave the builder with unsaved changes?"
        description="You've changed this workflow's structure but haven't saved it. Changes are kept for this demo session only once you save."
        onDismiss={() => setLeaveDialog(false)}
        actions={[
          { label: "Stay and keep editing", tone: "neutral", onClick: () => setLeaveDialog(false) },
          { label: "Discard changes", tone: "danger", onClick: () => { setLeaveDialog(false); router.push(backHref); } },
          { label: "Save and leave", tone: "primary", onClick: () => { setLeaveDialog(false); doSave(true); } },
        ]}
      />

      <BuilderDialog
        open={!!problems}
        title="This workflow can't be saved yet"
        description="Saving needs a sound workflow: every step connected, with valid names and numbers. Other setup gaps can be saved and fixed later, but they stop simulations."
        issues={(problems ?? []).map((i) => ({ id: i.id, text: i.message, nodeId: i.nodeId, stepName: i.nodeId ? current.nodes[i.nodeId]?.name : undefined }))}
        onGoToStep={(id) => {
          setProblems(null);
          goToStep(id);
        }}
        onDismiss={() => setProblems(null)}
        actions={[{ label: "Back to editing", tone: "primary", onClick: () => setProblems(null) }]}
      />

      <Toast message={notice} onDone={() => setNotice(null)} placement="top" />
    </div>,
    document.body,
  );
}
