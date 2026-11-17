"use client";

import { useEffectEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, FlaskConical, TriangleAlert, Pause, Play, RotateCcw, SkipForward, Square, Workflow, X } from "lucide-react";
import { Card, CardHeader } from "@/components/common/section";
import { RunStatusChip, RunTimeline, statusInfo } from "@/components/workflow/run-timeline";
import { Input } from "@/components/ui/input";
import { conditionFields, conditionOperators } from "@/lib/builder-nodes";
import { nowStamp } from "@/lib/data/workflow-events";
import { conditionFieldsIn, defaultSample, layoutFor, planRun, sampleExamples, type Plan, type RunStatus, type SampleInput, type SimRun } from "@/lib/simulation";
import { analyseReadiness } from "@/lib/readiness";
import { useTeam } from "@/lib/team-state";
import { useWorkflow, type BuilderLayout } from "@/lib/workflow-state";
import { workflowStatusTone } from "@/components/common/status";
import { cn } from "@/lib/utils";

/** An unfinished run. Only a run that ends, or is stopped, is recorded in the history. */
interface Live {
  plan: Extract<Plan, { ok: true }>;
  input: SampleInput;
  /** How many steps of the plan have been revealed. */
  shown: number;
  auto: boolean;
  paused: boolean;
  snapshot: BuilderLayout;
  /** Demo-clock time when the run began, not when it ended. */
  startedAt: string;
}

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (notify: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", notify);
  return () => mq.removeEventListener("change", notify);
};
const readReduced = () => window.matchMedia(REDUCED).matches;

const STEP_MS = 900;
let runSeq = 1;

const btn =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-3.5 text-sm font-semibold shadow-card transition-colors motion-reduce:transition-none hover:bg-soft focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";
const primary =
  "bg-brand-gradient inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white shadow-lift transition-opacity motion-reduce:transition-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";

/**
 * Simulated runs of a workflow's saved graph. This is a walkthrough with sample data: nothing is
 * executed, sent or changed, and it never touches the workflow's status, metrics or "last run".
 */
export function SimulationPanel({ workflowId }: { workflowId: string }) {
  const { workflow, builder, runs, actions } = useWorkflow(workflowId);
  const { byId, members } = useTeam();
  const layout = useMemo(() => layoutFor(workflow, builder), [workflow, builder]);
  const fields = useMemo(() => conditionFieldsIn(layout), [layout]);
  // Setup problems are checked from the saved graph. They are separate from sample-input problems, which only a run can find.
  const readiness = useMemo(() => analyseReadiness(layout, (id) => members.find((m) => m.id === id)), [layout, members]);
  const blocked = !readiness.ready;
  const conditions = layout.order.map((id) => layout.nodes[id]).filter((n) => n.type === "condition");
  const templateId = workflow.origin?.templateId;
  const examples = (templateId ? sampleExamples[templateId] : undefined)?.filter((e) => Object.keys(e.values).every((k) => fields.includes(k))) ?? [];

  const [edited, setEdited] = useState<SampleInput>({});
  const [live, setLive] = useState<Live | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  // Focus is only moved for someone who is still working inside this section (or has no focus at all).
  const sectionRef = useRef<HTMLElement>(null);
  const pauseRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  // Bumped when a run starts from the controls, so focus follows to the control that replaces Start.
  const [focusRunTick, setFocusRunTick] = useState(0);
  // A change here moves focus to the result. Only changes made on purpose bump it.
  const [focusTick, setFocusTick] = useState(0);
  // Spoken status. Updated only for meaningful changes, never for each timer tick.
  const [announce, setAnnounce] = useState("");
  // Read live so the page reacts to the preference, but a run keeps the mode it started with.
  const reduceMotion = useSyncExternalStore(subscribeReduced, readReduced, () => false);

  const valueOf = (f: string) => edited[f] ?? defaultSample(f, templateId);
  const input: SampleInput = Object.fromEntries(fields.map((f) => [f, valueOf(f)]));
  const nameOf = (id: string) => byId(id)?.name;
  const status = workflowStatusTone[workflow.status];
  const selected = runs.find((r) => r.id === selectedId) ?? null;

  const record = (l: Live, shown: number, stopped: boolean) => {
    const status: RunStatus = stopped ? "stopped" : l.plan.status;
    const run: SimRun = {
      id: `${workflowId}-run-${runSeq++}`,
      workflowId,
      workflowName: workflow.name,
      startedAt: l.startedAt,
      input: l.input,
      status,
      steps: l.plan.steps.slice(0, shown),
      plannedSteps: l.plan.steps.length,
      ...(stopped ? {} : l.plan.error ? { error: l.plan.error } : {}),
      snapshot: l.snapshot,
    };
    actions.recordRun(run);
    setLive(null);
    setSelectedId(run.id);
    const message = `Simulation ${statusInfo[status].label.toLowerCase()}. ${stopped ? `Stopped after ${shown} of ${l.plan.steps.length} planned steps. ` : l.plan.error ? `${l.plan.error} ` : ""}Added to run history for this session.`;
    setNote(message);
    setAnnounce(message);
    // The controls that had focus are about to be replaced, so hand focus to the result. If focus
    // was somewhere else (the user moved on during an automatic run), leave it alone.
    const focusWasInControls = !document.activeElement || document.activeElement === document.body || !!sectionRef.current?.contains(document.activeElement);
    if (focusWasInControls) setFocusTick((n) => n + 1);
  };

  useEffect(() => {
    if (focusTick > 0) resultRef.current?.focus();
  }, [focusTick]);

  useEffect(() => {
    if (focusRunTick > 0) (pauseRef.current ?? nextRef.current)?.focus();
  }, [focusRunTick]);

  const advance = () => {
    if (!live) return;
    const n = live.shown + 1;
    if (n >= live.plan.steps.length) record(live, live.plan.steps.length, false);
    else {
      setLive({ ...live, shown: n });
      // Automatic runs stay quiet. Someone stepping by hand hears each step they asked for.
      if (!live.auto || live.paused) setAnnounce(`Step ${n} of ${live.plan.steps.length}: ${live.plan.steps[n - 1].nodeName}.`);
    }
  };
  // The timer calls the latest `advance` without restarting when unrelated state changes.
  const tick = useEffectEvent(() => advance());

  useEffect(() => {
    if (!live || !live.auto || live.paused) return;
    const t = setTimeout(() => tick(), STEP_MS);
    return () => clearTimeout(t);
  }, [live]);

  const start = (wantAuto: boolean) => {
    if (blocked) return;
    const plan = planRun(layout, input, nameOf);
    if (!plan.ok) {
      setRejected(plan.problems);
      return;
    }
    setRejected(null);
    setSelectedId(null);
    // Honour a reduced-motion preference by stepping manually instead of auto-advancing.
    const auto = wantAuto && !reduceMotion;
    setNote(wantAuto && reduceMotion ? "Reduced motion is on, so this run advances one step at a time. Use Next step to continue." : null);
    const l: Live = { plan, input, shown: 1, auto, paused: false, snapshot: JSON.parse(JSON.stringify(layout)) as BuilderLayout, startedAt: nowStamp() };
    if (plan.steps.length <= 1) record(l, plan.steps.length, false);
    else {
      const fromControls = !document.activeElement || document.activeElement === document.body || !!sectionRef.current?.contains(document.activeElement);
      if (fromControls) setFocusRunTick((n) => n + 1);
      setLive(l);
      setAnnounce(`Simulation started. ${plan.steps.length} steps planned. ${auto ? "Pause is available." : "Use Next step to continue."}`);
    }
  };

  const shownSteps = live ? live.plan.steps.slice(0, live.shown) : selected ? selected.steps : [];
  const pending = live ? live.plan.steps.length - live.shown : 0;

  return (
    <section id="simulation" ref={sectionRef} aria-labelledby="sim-title" className="scroll-mt-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 id="sim-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            Simulate a run
            <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-brand-blue"><FlaskConical className="size-3.5" aria-hidden /> Simulation only</span>
          </h2>
          <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">
            Walk this workflow&apos;s saved graph with sample data. Nothing is executed, sent or changed. Approvals are assumed granted and waits are skipped. The workflow stays <span className="font-semibold text-navy">{status.label}</span>, and its metrics and last run are untouched.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="pb-5">
          <CardHeader title="Sample input" description="Example values for the Conditions in this workflow. Change them to try other paths." />
          <div className="space-y-4 px-5 pt-4">
            {fields.length === 0 ? (
              <p className="rounded-xl bg-soft px-3.5 py-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
                This workflow has no Condition, so there is nothing to evaluate and no sample input is needed. The run walks every step in order. Add a Condition in the builder to try branching.
              </p>
            ) : (
              <>
                {examples.length > 0 && (
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Example inputs">
                    {examples.map((e) => (
                      <button key={e.label} type="button" disabled={!!live} onClick={() => setEdited({ ...e.values })} className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-navy transition-colors hover:bg-soft focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-50">
                        {e.label} <span className="font-normal text-muted-foreground">· {e.note}</span>
                      </button>
                    ))}
                  </div>
                )}
                {fields.map((f) => {
                  const meta = conditionFields.find((x) => x.id === f);
                  const empty = !valueOf(f).trim();
                  return (
                    <div key={f}>
                      <label htmlFor={`sim-${f}`} className="mb-1.5 block text-[0.8125rem] font-semibold text-navy">{meta?.label ?? f}</label>
                      <Input id={`sim-${f}`} value={valueOf(f)} disabled={!!live} inputMode={f === "value" ? "decimal" : undefined} onChange={(e) => setEdited((p) => ({ ...p, [f]: e.target.value }))} className="h-10 rounded-xl bg-white" aria-describedby={`sim-${f}-hint`} />
                      <p id={`sim-${f}-hint`} className={cn("mt-1 text-xs", empty ? "font-medium text-warning" : "text-muted-foreground")}>
                        {empty ? "Empty. The run will block at the Condition instead of guessing a path." : `Example: ${meta?.example ?? "any value"}`}
                      </p>
                    </div>
                  );
                })}
                <div className="rounded-xl bg-soft px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
                  <p className="font-semibold text-navy">Rules being checked</p>
                  <ul className="mt-1 space-y-0.5">
                    {conditions.map((c, i) => (
                      <li key={i} className="[overflow-wrap:anywhere]">
                        {c.name}: {conditionFields.find((f) => f.id === c.config.field)?.label ?? c.config.field} {conditionOperators.find((o) => o.id === c.config.operator)?.label ?? c.config.operator} <span className="font-semibold text-navy">{c.config.value || "(no value)"}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5">
                    These come from the Condition steps, which hold illustrative values rather than company policy. Change them in the{" "}
                    <Link href={`/workflows/${workflowId}/builder`} className="font-semibold text-brand-blue underline-offset-2 hover:underline">builder</Link>.
                  </p>
                </div>
              </>
            )}

            {blocked && (
              <div id="sim-blocked" tabIndex={-1} role="group" aria-label="Setup problems" className="rounded-xl bg-danger-soft px-3.5 py-3 text-[0.8125rem] text-danger outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
                <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="size-4 shrink-0" aria-hidden /> Fix {readiness.errors.length === 1 ? "this" : "these"} before simulating</p>
                <ul className="mt-1.5 space-y-1.5">
                  {readiness.errors.map((i) => (
                    <li key={i.id} className="[overflow-wrap:anywhere]">
                      {i.message}{" "}
                      <Link href={`/workflows/${workflowId}/builder${i.nodeId ? `?focus=${encodeURIComponent(i.nodeId)}` : ""}`} aria-label={i.nodeId ? `Open ${layout.nodes[i.nodeId]?.name ?? "the step"} in the builder to fix: ${i.short}` : "Open the builder to fix this"} className="font-semibold whitespace-nowrap underline underline-offset-2 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
                        {i.nodeId ? "Open the step" : "Open the builder"}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!blocked && readiness.warnings.length > 0 && (
              <div role="group" aria-label="Setup warnings" className="rounded-xl bg-warning-soft/70 px-3.5 py-3 text-[0.8125rem] text-warning">
                <p className="flex items-center gap-1.5 font-semibold"><TriangleAlert className="size-4 shrink-0" aria-hidden /> Worth checking (won&apos;t stop a simulation)</p>
                <ul className="mt-1.5 space-y-1">{readiness.warnings.map((i) => <li key={i.id} className="[overflow-wrap:anywhere]">{i.message}</li>)}</ul>
              </div>
            )}

            {rejected && (
              <div role="alert" className="rounded-xl bg-danger-soft px-3.5 py-3 text-[0.8125rem] text-danger">
                <p className="font-semibold">This workflow can&apos;t be simulated yet.</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">{rejected.map((p) => <li key={p}>{p}</li>)}</ul>
                <Link href={`/workflows/${workflowId}/builder`} className="mt-2 inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline"><Workflow className="size-3.5" /> Fix it in the builder</Link>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {live ? (
                <>
                  {live.auto && (
                    <button type="button" ref={pauseRef} onClick={() => {
                      setLive({ ...live, paused: !live.paused });
                      setAnnounce(live.paused ? "Simulation resumed." : `Simulation paused at step ${live.shown} of ${live.plan.steps.length}.`);
                    }} className={primary}>
                      {live.paused ? <Play className="size-4" /> : <Pause className="size-4" />} {live.paused ? "Resume" : "Pause"}
                    </button>
                  )}
                  <button type="button" ref={nextRef} disabled={live.auto && !live.paused} onClick={() => advance()} className={live.auto ? btn : primary}>
                    <SkipForward className="size-4" /> Next step
                  </button>
                  <button type="button" onClick={() => record(live, live.shown, true)} className={btn}>
                    <Square className="size-4" /> Stop
                  </button>
                </>
              ) : (
                <>
                  <button type="button" data-sim-start disabled={blocked} aria-describedby={blocked ? "sim-blocked" : undefined} onClick={() => start(true)} className={primary}>
                    <Play className="size-4" /> Start simulation
                  </button>
                  <button type="button" disabled={blocked} aria-describedby={blocked ? "sim-blocked" : undefined} onClick={() => start(false)} className={btn}>
                    <SkipForward className="size-4" /> Step through
                  </button>
                </>
              )}
            </div>
            {reduceMotion && !live && <p className="text-xs text-muted-foreground">Reduced motion is on. Simulations advance one step at a time with Next step.</p>}
          </div>
        </Card>

        <Card className="pb-5">
          <CardHeader
            title={live ? "Simulation in progress" : selected ? `Run ${selected.id}` : "Timeline"}
            description={live ? `Step ${live.shown} of ${live.plan.steps.length} planned. Sample data only.` : selected ? undefined : "Each step appears here as the simulation reaches it."}
            action={selected && !live ? <button type="button" onClick={() => { const id = selected.id; setSelectedId(null); setNote(null); setTimeout(() => document.getElementById(`hist-${id}`)?.focus(), 0); }} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-soft hover:text-navy focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"><X className="size-3.5" aria-hidden /> Close run</button> : undefined}
          />
          <div className="px-5 pt-4">
            <p role="status" className="sr-only">{announce}</p>
            {note && <p className="mb-3 text-xs font-medium text-muted-foreground">{note}</p>}
            {selected && !live && <RunSummary run={selected} currentName={workflow.name} focusRef={resultRef} />}
            {shownSteps.length > 0 ? (
              <RunTimeline steps={shownSteps} activeIndex={live ? live.shown - 1 : undefined} />
            ) : (
              <p className="rounded-xl bg-soft px-3.5 py-6 text-center text-[0.8125rem] text-muted-foreground">Start a simulation to see its steps here, or open a run from the history below.</p>
            )}
            {live && pending > 0 && <p className="mt-3 text-xs text-muted-foreground">{pending} more {pending === 1 ? "step" : "steps"} to go. {live.paused ? "Paused." : live.auto ? "" : "Use Next step to continue."}</p>}
          </div>
        </Card>
      </div>

      <Card className="mt-6 pb-3">
        <CardHeader title="Run history" description={`Simulated runs of ${workflow.name}. Kept for this session only: a refresh clears them.`} />
        {runs.length === 0 ? (
          <p className="px-5 py-5 text-[0.8125rem] text-muted-foreground">No simulated runs yet. Nothing here has been run.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {runs.map((r) => {
              const decision = r.steps.find((s) => s.decision?.branch)?.decision;
              return (
                <li key={r.id}>
                  <button type="button" id={`hist-${r.id}`} onClick={() => { setSelectedId(r.id); setNote(null); setFocusTick((n) => n + 1); }} aria-pressed={selectedId === r.id} className={cn("flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-soft focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none focus-visible:ring-inset", selectedId === r.id && "bg-soft")}>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-navy [overflow-wrap:anywhere]">{r.id}</span>
                        <RunStatusChip status={r.status} />
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        {r.startedAt} · {r.steps.length}{r.steps.length < r.plannedSteps ? ` of ${r.plannedSteps}` : ""} steps{decision?.branch ? ` · ${decision.branch === "yes" ? "Yes" : "No"} path` : ""} · {Object.entries(r.input).map(([k, v]) => `${k}: ${v || "(empty)"}`).join(", ") || "no input"}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {runs.length > 0 && (
          <p className="flex items-center gap-1.5 px-5 pt-3 pb-2 text-xs text-muted-foreground"><RotateCcw className="size-3.5" aria-hidden /> Runs keep the workflow as it was when they ran, so later edits don&apos;t change them. <Link href="/insights" className="font-semibold text-brand-blue hover:underline">See what simulated runs show</Link></p>
        )}
      </Card>
    </section>
  );
}

/** Header for a reopened run: when, with what input, against which graph, and how it ended. */
function RunSummary({ run, currentName, focusRef }: { run: SimRun; currentName: string; focusRef: React.RefObject<HTMLDivElement | null> }) {
  const s = statusInfo[run.status];
  const inputs = Object.entries(run.input);
  const stepsInSnapshot = run.snapshot.order.length;
  return (
    <div className="mb-4 space-y-3">
      <div ref={focusRef} tabIndex={-1} className={cn("rounded-xl px-3.5 py-3 text-[0.8125rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/40", s.soft)}>
        <p className={cn("flex items-center gap-1.5 font-semibold", s.tone)}><s.Icon className="size-4" aria-hidden /> {s.label}</p>
        <p className="mt-0.5 text-muted-foreground">{run.status === "stopped" ? `Stopped after ${run.steps.length} of ${run.plannedSteps} planned steps.` : s.summary}</p>
        {run.error && <p className={cn("mt-1 font-medium [overflow-wrap:anywhere]", s.tone)}>{run.error}</p>}
      </div>
      <dl className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Started (demo clock)</dt><dd className="font-semibold text-navy">{run.startedAt}</dd></div>
        <div><dt className="text-muted-foreground">Workflow at the time</dt><dd className="font-semibold text-navy [overflow-wrap:anywhere]">{run.workflowName}{run.workflowName !== currentName ? ` (now ${currentName})` : ""} · {stepsInSnapshot} steps</dd></div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Sample input used</dt>
          <dd className="font-semibold text-navy [overflow-wrap:anywhere]">
            {inputs.length === 0 ? "None (no Condition to evaluate)" : inputs.map(([k, v]) => `${conditionFields.find((f) => f.id === k)?.label ?? k}: ${v || "(empty)"}`).join(" · ")}
          </dd>
        </div>
      </dl>
    </div>
  );
}
