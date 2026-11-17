"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronLeft, FlaskConical, Loader2, Pause, PauseCircle, Pencil, Play, Workflow, Zap } from "lucide-react";
import { Card, CardHeader } from "@/components/common/section";
import { MemberAvatar } from "@/components/common/member-avatar";
import { Reveal } from "@/components/common/reveal";
import { StatusMark, healthTone, workflowStatusTone } from "@/components/common/status";
import { Toast } from "@/components/common/toast";
import { PageHeader } from "@/components/shell/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SimulationPanel } from "@/components/workflow/simulation-panel";
import { WorkflowCanvas } from "@/components/workflow/workflow-canvas";
import { WorkflowEditPanel } from "@/components/workflow/workflow-edit-panel";
import { healthColor, progressionColor } from "@/components/workflow/flow-colors";
import { currentUserId } from "@/lib/data/team";
import { useSettings } from "@/lib/settings-state";
import { useTeam } from "@/lib/team-state";
import { analyseWorkflow, inFlightCount, stageStatusLabel } from "@/lib/workflow-health";
import { useWorkflow, type WorkflowMeta } from "@/lib/workflow-state";
import { cn } from "@/lib/utils";
import type { WorkflowStage } from "@/lib/types";

const toneDot = { good: "bg-success", warn: "bg-warning", bad: "bg-danger", neutral: "bg-slate-300" };
const healthIcon = { success: CheckCircle2, warning: AlertTriangle, danger: AlertTriangle, neutral: PauseCircle };
const healthTint = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-muted text-muted-foreground",
};
const healthText = { success: "text-success", warning: "text-warning", danger: "text-danger", neutral: "text-muted-foreground" };

const actionBtn =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-3.5 text-sm font-semibold whitespace-nowrap shadow-card transition-colors hover:bg-soft focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";

/** The working view of a single workflow, with simulated run / pause / edit state held locally. */
export function WorkflowDetail({ workflowId }: { workflowId: string }) {
  const { workflow: live, events, actions, builder } = useWorkflow(workflowId);
  const addedSteps = builder ? builder.order.filter((id) => builder.nodes[id].custom).length : 0;
  const branched = !!builder && builder.order.some((id) => builder.nodes[id].type === "condition");
  const { byId } = useTeam();
  const operator = useSettings().settings.profile.name;
  const meta: WorkflowMeta = { name: live.name, description: live.description, ownerId: live.ownerId, status: live.status };
  const lastRun = live.lastRun;
  const [running, setRunning] = useState(false);
  const [confirmPause, setConfirmPause] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const health = analyseWorkflow(live);
  const first = live.stages[0];
  const stageName = (id?: string) => live.stages.find((s) => s.id === id)?.name;
  const owner = byId(meta.ownerId);
  const status = workflowStatusTone[meta.status];
  const paused = meta.status !== "active";
  const HealthIcon = healthIcon[health.tone];

  const run = () => {
    if (running || paused) return;
    setRunning(true);
    setNotice("Workflow run started (simulated)");
    actions.startRun(currentUserId, operator);
    timer.current = setTimeout(() => {
      actions.completeRun();
      setRunning(false);
      setNotice("Run completed: 2 new requests entered " + first.name);
    }, 1800);
  };

  const pause = () => {
    actions.setMeta({ ...meta, status: "paused" });
    actions.addEvent({ text: `Workflow paused by ${operator}`, actorId: currentUserId, tone: "warn" });
    setNotice("Workflow paused (simulated)");
  };

  const resume = () => {
    actions.setMeta({ ...meta, status: "active" });
    actions.addEvent({ text: `Workflow resumed by ${operator}`, actorId: currentUserId, tone: "good" });
    setNotice("Workflow resumed (simulated)");
  };

  const saveMeta = (next: WorkflowMeta) => {
    if (next.status !== meta.status) {
      actions.addEvent({ text: `Status changed to ${workflowStatusTone[next.status].label} by ${operator}`, actorId: currentUserId, tone: "neutral" });
    }
    actions.addEvent({ text: `Workflow details updated by ${operator}`, actorId: currentUserId, tone: "neutral" });
    actions.setMeta(next);
    setEditing(false);
    setNotice("Workflow details saved (demo)");
  };

  const accent = (s: WorkflowStage, i: number) =>
    paused ? healthColor.idle : s.health === "attention" || s.health === "critical" ? healthColor[s.health] : progressionColor(i / Math.max(1, live.stages.length - 1));

  const openStages = live.stages.filter((s) => s.kind !== "complete");
  const attention = live.stages
    .filter((s) => s.health === "attention" || s.health === "critical")
    .flatMap((s) => s.items.filter((it) => it.priority === "high" || it.state?.includes("overdue")).map((it) => ({ it, stage: s })))
    .slice(0, 4);

  const shownEvents = events.filter((e) => stageFilter === "all" || e.stageId === stageFilter);
  const visibleEvents = showAll ? shownEvents : shownEvents.slice(0, 6);

  const facts = [
    { label: "Owner", value: <span className="flex items-center gap-2 text-[0.9375rem] font-semibold"><MemberAvatar id={owner.id} size="sm" />{owner.name}</span> },
    { label: "Last run", value: <span className="text-[0.9375rem] font-semibold">{lastRun}</span> },
    { label: "Active items", value: <span className="text-2xl leading-none font-bold tracking-tight tabular-nums">{inFlightCount(live)}</span> },
    { label: "Success rate", value: <span className="text-2xl leading-none font-bold tracking-tight tabular-nums">{live.successRate ? `${live.successRate}%` : "—"}</span> },
    { label: "Avg. cycle time", value: <span className="text-2xl leading-none font-bold tracking-tight">{live.avgCycle}</span> },
    { label: "Overall health", value: <span className={cn("text-[0.9375rem] font-bold", healthText[health.tone])}>{health.title}</span> },
  ];

  return (
    <>
      <Link href="/workflows" className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-navy">
        <ChevronLeft className="size-4" /> All workflows
      </Link>

      <PageHeader
        title={meta.name}
        badge={<StatusMark tone={status.tone} soft className="h-7 px-3">{status.label}</StatusMark>}
        description={meta.description}
        className="mb-6 lg:mb-6"
        // Phones: Run on its own row, everything else two to a row. From sm up they sit in one wrapping row.
        actionsClassName="grid w-full grid-cols-2 sm:flex sm:w-auto [&>span:last-child]:col-span-2 [&>span:last-child]:justify-self-start sm:[&>span:last-child]:col-span-1"
        actions={
          <>
            <button
              type="button"
              onClick={run}
              disabled={paused || running}
              title={paused ? "Resume the workflow before running it" : undefined}
              className="bg-brand-gradient col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold whitespace-nowrap text-white shadow-lift transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 sm:col-span-1"
            >
              {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {running ? "Running…" : "Run workflow"}
            </button>
            {meta.status === "active" && (
              <button type="button" onClick={() => setConfirmPause(true)} className={actionBtn}>
                <Pause className="size-4" /> Pause workflow
              </button>
            )}
            {meta.status === "paused" && (
              <button type="button" onClick={resume} className={actionBtn}>
                <Play className="size-4" /> Resume workflow
              </button>
            )}
            <a
              href="#simulation"
              onClick={(e) => {
                // Scroll to the simulation and put focus on its Start button, so the next Tab or Enter starts a run.
                e.preventDefault();
                const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                document.getElementById("simulation")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
                // Start is disabled while setup problems exist; then focus goes to the list explaining them.
                (document.querySelector<HTMLElement>("[data-sim-start]:not(:disabled)") ?? document.getElementById("sim-blocked"))?.focus({ preventScroll: true });
              }}
              className={actionBtn}
            >
              <FlaskConical className="size-4" /> Simulate run
            </a>
            <button type="button" onClick={() => setEditing(true)} className={actionBtn}>
              <Pencil className="size-4" /> Edit workflow
            </button>
            {/* Created workflows get one primary route in, in the banner below, so it isn't repeated here. */}
            {!live.origin && (
              <Link href={`/workflows/${workflowId}/builder`} className={actionBtn}>
                <Workflow className="size-4" /> Open builder
              </Link>
            )}
          </>
        }
      />

      {live.origin && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-soft/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between" style={{ backgroundImage: "radial-gradient(500px 140px at 0% 0%, rgb(37 99 255 / 0.08), transparent 70%)" }}>
          <div>
            <p className="text-sm font-semibold text-navy">
              {live.origin.templateId ? `Created from the ${live.origin.templateName} template` : "Created from scratch"}
            </p>
            <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
              It&apos;s a draft starting point and hasn&apos;t run. Open the builder to review the steps and connections and make them yours.
            </p>
          </div>
          <Link href={`/workflows/${workflowId}/builder`} className="bg-brand-gradient inline-flex h-10 shrink-0 items-center gap-1.5 self-start rounded-xl px-4 text-sm font-semibold text-white shadow-card transition-opacity hover:opacity-90 sm:self-auto">
            <Workflow className="size-4" /> Open builder
          </Link>
        </div>
      )}

      <Reveal>
        <Card className="overflow-hidden">
          <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 xl:grid-cols-6">
            {facts.map((f) => (
              <div key={f.label} className="bg-white px-4 py-4">
                <dt className="text-xs font-medium text-muted-foreground">{f.label}</dt>
                <dd className="mt-2">{f.value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-5 border-t border-border p-5 lg:flex-row lg:items-center lg:gap-10">
            <div className="flex items-start gap-3.5 lg:w-[44%]">
              <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", healthTint[health.tone])}>
                <HealthIcon className="size-5" />
              </span>
              <div>
                <p className={cn("text-base font-semibold", healthText[health.tone])}>{health.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{health.sentence}</p>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Where work is sitting</p>
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
                {openStages.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    aria-label={`${s.name}: ${s.count} items. Inspect`}
                    className="min-w-1 transition-opacity hover:opacity-80"
                    style={{ flex: Math.max(s.count, 0.0001), backgroundColor: accent(s, live.stages.indexOf(s)) }}
                  />
                ))}
              </div>
              <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {openStages.map((s) => (
                  <li key={s.id} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: accent(s, live.stages.indexOf(s)) }} />
                    {s.name} <span className="font-semibold text-navy tabular-nums">{s.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1} className="mt-6">
        <section
          className="surface rounded-3xl p-4 sm:p-6"
          style={{ backgroundImage: "radial-gradient(700px 240px at 0% 0%, rgb(37 99 255 / 0.05), transparent 70%), radial-gradient(600px 240px at 100% 0%, rgb(124 58 237 / 0.05), transparent 70%)" }}
        >
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Process map</h2>
              <p className="text-sm text-muted-foreground">
                {paused ? "Paused. No new items are being picked up." : "Live view of every stage. Select a stage to inspect it."}
              </p>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {live.origin
                ? `Created from the ${live.origin.templateName} template · ${live.stages.length} ${live.stages.length === 1 ? "stage" : "stages"}${branched ? " and a Yes/No branch" : ""} · not run yet`
                : addedSteps > 0 || branched ? `${addedSteps} builder ${addedSteps === 1 ? "step" : "steps"}${branched ? " and a Yes/No branch" : ""} drawn in the builder (not run by the live workflow)` : "Simulated demo workflow"}
            </span>
          </div>
          <WorkflowCanvas
            workflow={live}
            selectedId={selectedId}
            onSelectStage={setSelectedId}
            paused={paused}
            currentStageId={health.currentStageId}
            currentReason={health.currentReason}
          />
        </section>
      </Reveal>

      <Reveal delay={0.1} className="mt-6">
        <SimulationPanel workflowId={workflowId} />
      </Reveal>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Reveal delay={0.05}>
          <Card className="h-full pb-3">
            <CardHeader
              title="Activity"
              description="Recent events across this workflow"
              action={
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  aria-label="Filter activity by stage"
                  className="h-9 w-40 max-w-full min-w-0 shrink rounded-xl border border-input bg-white px-2.5 text-[0.8125rem] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:w-48"
                >
                  <option value="all">All stages</option>
                  {live.stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              }
            />
            {visibleEvents.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">No activity for this stage yet.</p>
            ) : (
              <ol className="relative mt-5 space-y-5 px-5">
                <span className="absolute top-2 bottom-2 left-[25px] w-px bg-border" />
                {visibleEvents.map((e) => (
                  <li key={e.id} className="relative flex gap-3.5">
                    <span className="relative z-10 mt-1.5 flex size-3 shrink-0 items-center justify-center rounded-full bg-white ring-4 ring-white">
                      <span className={cn("size-2.5 rounded-full", toneDot[e.tone])} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.875rem] leading-snug font-medium">{e.text}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          {e.actorId ? <MemberAvatar id={e.actorId} size="xs" /> : <Zap className="size-3.5 text-brand-blue" />}
                          {e.actorId ? byId(e.actorId).name : "Syntra automation"}
                        </span>
                        {e.stageId && <span>· {stageName(e.stageId)}</span>}
                        <span>· {e.time}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {shownEvents.length > 6 && (
              <div className="mt-4 border-t border-border px-5 pt-3">
                <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm font-semibold text-brand-blue hover:underline">
                  {showAll ? "Show fewer" : `Show all ${shownEvents.length} events`}
                </button>
              </div>
            )}
          </Card>
        </Reveal>

        <div className="space-y-6">
          <Reveal delay={0.1}>
            <Card className="pb-5">
              <CardHeader title="Needs attention" description="Blocked or overdue items" />
              {attention.length === 0 ? (
                <p className="mx-5 mt-4 flex items-center gap-2 rounded-xl bg-success-soft px-3.5 py-3 text-sm text-success">
                  <CheckCircle2 className="size-4 shrink-0" /> Nothing is blocked right now.
                </p>
              ) : (
                <ul className="mt-4 space-y-2.5 px-5">
                  {attention.map(({ it, stage }) => (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(stage.id)}
                        className="w-full rounded-xl border-l-[3px] border-warning bg-warning-soft/60 p-3 text-left transition-colors hover:bg-warning-soft"
                      >
                        <p className="text-[0.8125rem] font-semibold">
                          {it.id.startsWith("#") ? `Request ${it.id}` : it.id}
                          {it.state && <span className="font-normal text-muted-foreground"> — {it.state}</span>}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {it.title} · {stage.name} · {it.age}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>

          <Reveal delay={0.15}>
            <Card className="pb-3">
              <CardHeader title="Stages at a glance" description="Owner and average processing time" />
              <ul className="mt-3 px-3">
                {live.stages.map((s, i) => {
                  const isCurrent = s.id === health.currentStageId;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(s.id)}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-soft"
                      >
                        <span className="w-5 text-xs font-semibold text-slate-400 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-[0.8125rem] font-semibold">
                            {s.name}
                            {isCurrent && <span className="rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-bold text-brand-blue uppercase">Active now</span>}
                          </span>
                          <span className="mt-0.5 block text-xs">
                            {paused && s.kind !== "complete" ? (
                              <StatusMark tone="neutral" className="text-xs">Paused</StatusMark>
                            ) : (
                              <StatusMark tone={healthTone[s.health]} className="text-xs">
                                {stageStatusLabel[s.health]}
                              </StatusMark>
                            )}
                          </span>
                        </span>
                        <span className="text-right text-xs text-muted-foreground">
                          <span className="block text-[0.9375rem] font-bold text-navy tabular-nums">{s.count}</span>
                          {s.time}
                        </span>
                        <MemberAvatar id={s.ownerId} size="sm" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </Reveal>
        </div>
      </div>

      <ConfirmDialog
        open={confirmPause}
        onOpenChange={setConfirmPause}
        tone="warning"
        title={`Pause ${meta.name}?`}
        description="New items will stop being picked up until you resume. Work already in progress stays where it is. This is a simulated action in the demo."
        confirmLabel="Pause workflow"
        onConfirm={pause}
      />

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent side="right" className="gap-0 border-l border-border bg-white p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[480px]">
          {editing && <WorkflowEditPanel initial={meta} onSave={saveMeta} onCancel={() => setEditing(false)} />}
        </SheetContent>
      </Sheet>

      <Toast message={notice} onDone={() => setNotice(null)} />
    </>
  );
}
