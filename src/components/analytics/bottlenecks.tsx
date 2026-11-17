"use client";

import Link from "next/link";
import { ArrowUpRight, Ban, ClipboardCheck, PackageCheck, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/common/reveal";
import { Card } from "@/components/common/section";
import { bottlenecks, formatDuration } from "@/lib/data/analytics";
import { useWorkflows } from "@/lib/workflow-state";
import { cn } from "@/lib/utils";

function useWorkflowLookup() {
  const workflows = useWorkflows();
  return (id: string) => workflows.find((w) => w.id === id);
}

/** Where work is getting stuck, ranked by severity. Each problem gets its own visual, not a table row. */
export function Bottlenecks() {
  const find = useWorkflowLookup();
  const wf = find(bottlenecks.slow.workflowId);
  const name = wf?.name ?? "Workflow";
  const paused = wf && wf.status !== "active";
  const slow = bottlenecks.slow;
  const ratio = slow.actualMin / slow.expectedMin;
  const scale = 1.5; // the track represents 0–150% of the expected time

  return (
    <section id="bottlenecks" className="scroll-mt-24">
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Where work is getting stuck</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Current bottlenecks in {name}, most severe first.{paused && " The workflow is paused, so these items aren't moving."}
        </p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Reveal>
          <Card className="h-full overflow-hidden border-warning/30 bg-gradient-to-b from-warning-soft/60 to-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-white text-warning shadow-card"><ShieldCheck className="size-5" /></span>
                <div>
                  <p className="text-xs font-semibold tracking-wide text-warning uppercase">Slowest stage</p>
                  <h3 className="text-xl font-bold tracking-tight text-navy">{slow.stage}</h3>
                </div>
              </div>
              <Link href={`/workflows/${slow.workflowId}`} className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-brand-blue hover:underline">
                {name} · Stage {slow.stageNumber} <ArrowUpRight className="size-3.5" />
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-3">
              <p className="text-5xl leading-none font-bold tracking-tight text-navy tabular-nums">
                {slow.waiting}
                <span className="ml-2 text-base font-medium text-muted-foreground">items waiting</span>
              </p>
              <p className="text-lg font-bold text-warning">{slow.percentSlower}% slower than expected</p>
            </div>

            <div className="mt-6">
              <div className="relative h-3 rounded-full bg-slate-200/70">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-blue via-warning to-warning" style={{ width: `${(ratio / scale) * 100}%` }} />
                <span className="absolute -top-1.5 h-6 w-0.5 rounded bg-navy" style={{ left: `${(1 / scale) * 100}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-x-4 text-xs text-muted-foreground">
                <span>Expected <span className="font-semibold text-navy">{formatDuration(slow.expectedMin)}</span> (marker)</span>
                <span>Actual <span className="font-semibold text-warning">{formatDuration(slow.actualMin)}</span></span>
              </div>
            </div>

            <p className="mt-6 mb-2 text-xs font-semibold text-muted-foreground">Longest waiting</p>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
              {slow.oldest.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[0.8125rem]">
                  <span className="min-w-0 truncate"><span className="font-semibold">Request {o.id}</span> <span className="text-muted-foreground">— {o.title}</span></span>
                  <span className="shrink-0 font-semibold text-warning tabular-nums">{o.age}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
          <Reveal delay={0.06}>
            <Card className="h-full p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-info-soft text-brand-blue"><ClipboardCheck className="size-5" /></span>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-brand-blue uppercase">Approaching limit</p>
                    <h3 className="text-base font-bold tracking-tight text-navy">{bottlenecks.approaching.stage}</h3>
                  </div>
                </div>
                <Link href={`/workflows/${bottlenecks.approaching.workflowId}`} className="text-[0.8125rem] font-semibold text-brand-blue hover:underline">Inspect</Link>
              </div>
              <p className="mt-4 text-[0.9375rem] font-semibold">
                {bottlenecks.approaching.approaching} items approaching expected processing time
              </p>
              <div className="mt-3 flex gap-1" role="img" aria-label={`${bottlenecks.approaching.approaching} of ${bottlenecks.approaching.total} items approaching`}>
                {Array.from({ length: bottlenecks.approaching.total }, (_, i) => (
                  <span key={i} className={cn("h-6 flex-1 rounded-md", i < bottlenecks.approaching.approaching ? "bg-warning/80" : "bg-brand-blue/15")} />
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{bottlenecks.approaching.approaching} of {bottlenecks.approaching.total} items in the stage are past 80% of their time.</p>
            </Card>
          </Reveal>

          <Reveal delay={0.12}>
            <Card className="h-full p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-danger-soft text-danger"><PackageCheck className="size-5" /></span>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-danger uppercase">Blocked</p>
                    <h3 className="text-base font-bold tracking-tight text-navy">{bottlenecks.blocked.stage}</h3>
                  </div>
                </div>
                <Link href={`/workflows/${bottlenecks.blocked.workflowId}`} className="text-[0.8125rem] font-semibold text-brand-blue hover:underline">Inspect</Link>
              </div>
              <p className="mt-4 flex items-center gap-2 text-[0.9375rem] font-semibold">
                <Ban className="size-4 text-danger" /> {bottlenecks.blocked.blocked} items blocked
              </p>
              <ul className="mt-3 space-y-1.5">
                {bottlenecks.blocked.reasons.map((r) => (
                  <li key={r.label} className="flex items-center justify-between rounded-lg bg-danger-soft/60 px-3 py-2 text-[0.8125rem]">
                    {r.label}
                    <span className="font-bold text-danger tabular-nums">{r.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
