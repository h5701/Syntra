"use client";

import Link from "next/link";
import { ArrowUpRight, Loader2, Pause, Pencil, Play, Power, Trash2, Zap } from "lucide-react";
import { Meter } from "@/components/common/meter";
import { StatusMark } from "@/components/common/status";
import { RunMark } from "@/components/automations/run-mark";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { triggerSentence } from "@/lib/data/automations";
import { cn } from "@/lib/utils";
import type { Automation } from "@/lib/types";

function Block({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="px-6 pb-7">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

const btn =
  "inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-[0.8125rem] font-semibold shadow-card transition-colors hover:bg-soft disabled:pointer-events-none disabled:opacity-50";

/** Detail view of one automation: how it fires, what it does, and what it has done. */
export function AutomationInspector({
  automation: a,
  workflowName,
  onRun,
  onToggle,
  onEdit,
  onRemove,
}: {
  automation: Automation;
  workflowName: string;
  onRun: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const active = a.status === "active";
  const running = a.runs.some((r) => r.result === "running");

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div
        className="px-6 pt-7 pb-6"
        style={{ backgroundImage: "radial-gradient(420px 180px at 0% 0%, rgb(37 99 255 / 0.12), transparent 70%), radial-gradient(300px 160px at 100% 0%, rgb(124 58 237 / 0.08), transparent 70%)" }}
      >
        <p className="text-xs font-medium text-muted-foreground">Automation</p>
        <div className="mt-4 flex items-center gap-3.5">
          <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", active ? "bg-brand-gradient text-white" : "bg-muted text-muted-foreground")}>
            <Zap className="size-6" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <SheetTitle className="text-2xl leading-tight font-bold tracking-tight text-navy">{a.name}</SheetTitle>
            <div className="mt-1.5">
              <StatusMark tone={active ? "success" : "warning"} soft>{active ? "Active" : "Paused"}</StatusMark>
            </div>
          </div>
        </div>
        <SheetDescription className="mt-4 text-sm">
          Part of{" "}
          <Link href={`/workflows/${a.workflowId}`} className="font-semibold text-brand-blue hover:underline">
            {workflowName}
          </Link>
          . Executions are simulated in this demo.
        </SheetDescription>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={onRun} disabled={!active || running} title={!active ? "Enable the automation to run it" : undefined} className="bg-brand-gradient inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[0.8125rem] font-semibold text-white shadow-card transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50">
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {running ? "Running…" : "Run now"}
          </button>
          <button type="button" onClick={onToggle} className={btn}>
            {active ? <Pause className="size-4" /> : <Power className="size-4" />}
            {active ? "Disable automation" : "Enable automation"}
          </button>
          <button type="button" onClick={onEdit} className={btn}>
            <Pencil className="size-4" /> Edit
          </button>
        </div>
      </div>

      <dl className="mx-6 mb-7 grid grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-soft p-3">
          <dt className="text-[11px] font-medium text-muted-foreground">Last run</dt>
          <dd className="mt-1.5 text-[0.8125rem] leading-tight font-semibold">{a.lastRun}</dd>
        </div>
        <div className="rounded-xl bg-soft p-3">
          <dt className="text-[11px] font-medium text-muted-foreground">Runs today</dt>
          <dd className="mt-1 text-xl leading-none font-bold tracking-tight tabular-nums">{a.runsToday}</dd>
        </div>
        <div className="rounded-xl bg-soft p-3">
          <dt className="text-[11px] font-medium text-muted-foreground">Success rate</dt>
          <dd className="mt-1 text-xl leading-none font-bold tracking-tight tabular-nums">{a.successRate ? `${a.successRate}%` : "—"}</dd>
          {a.successRate > 0 && <Meter value={a.successRate} className="mt-2 bg-white" />}
        </div>
      </dl>

      <Block title="Trigger">
        <p className="rounded-xl border-l-[3px] border-brand-purple bg-violet-50/70 px-3.5 py-3 text-[0.875rem] font-medium">{triggerSentence(a.trigger)}</p>
      </Block>

      <Block title="Conditions">
        {a.conditions.length === 0 ? (
          <p className="text-[0.8125rem] text-muted-foreground">No conditions. It runs every time the trigger fires.</p>
        ) : (
          <ul className="space-y-1.5">
            {a.conditions.map((c) => (
              <li key={c} className="rounded-lg bg-soft px-3 py-2 text-[0.8125rem] font-medium">{c}</li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Actions" meta="Run in order">
        <ol className="space-y-2">
          {a.actions.map((act, i) => (
            <li key={act} className="flex items-center gap-3 rounded-xl border-l-[3px] border-brand-blue bg-info-soft/70 px-3.5 py-3 text-[0.875rem] font-medium">
              <span className="flex size-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-brand-blue">{i + 1}</span>
              {act}
            </li>
          ))}
        </ol>
      </Block>

      <Block title="Workflow">
        <Link href={`/workflows/${a.workflowId}`} className="flex items-center justify-between rounded-xl border border-border px-3.5 py-3 text-[0.875rem] font-semibold transition-colors hover:bg-soft">
          {workflowName}
          <ArrowUpRight className="size-4 text-brand-blue" />
        </Link>
      </Block>

      <Block title="Recent runs" meta={a.runs.length ? `Latest ${Math.min(a.runs.length, 6)}` : undefined}>
        {a.runs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[0.8125rem] text-muted-foreground">
            No runs yet. {active ? "Use Run now to simulate one." : "Enable the automation to run it."}
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {a.runs.slice(0, 6).map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-[0.8125rem] font-semibold">{r.target}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.detail ? `${r.detail} · ` : ""}{r.time}</p>
                </div>
                <RunMark result={r.result} />
              </li>
            ))}
          </ul>
        )}
      </Block>

      <div className="mt-auto border-t border-border px-6 py-4">
        <button type="button" onClick={onRemove} className="inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-danger hover:underline">
          <Trash2 className="size-4" /> Remove automation
        </button>
      </div>
    </div>
  );
}
