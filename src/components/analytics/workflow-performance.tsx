"use client";

import Link from "next/link";
import { TrendingDown } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";
import { Card, CardHeader } from "@/components/common/section";
import { Meter } from "@/components/common/meter";
import { Reveal } from "@/components/common/reveal";
import { StatusMark } from "@/components/common/status";
import { formatDuration, ranges, type Range, type RangeData } from "@/lib/data/analytics";
import { useWorkflows } from "@/lib/workflow-state";
import { cn } from "@/lib/utils";

const cols = "xl:grid-cols-[minmax(0,2fr)_0.9fr_1.5fr_1fr_1.2fr]";

/** Per-workflow results, plus the cycle-time insight: who is fastest, who is slowest, and which way it's heading. */
export function WorkflowPerformance({ range, data }: { range: Range; data: RangeData }) {
  const workflows = useWorkflows();
  const long = ranges.find((r) => r.id === range)!.long;
  const rows = data.workflows.map((p) => ({ perf: p, wf: workflows.find((w) => w.id === p.workflowId)! })).filter((r) => r.wf);
  const timed = rows.filter((r) => r.perf.cycleMin > 0).sort((a, b) => a.perf.cycleMin - b.perf.cycleMin);
  const maxCycle = timed[timed.length - 1]?.perf.cycleMin ?? 1;
  const crp = workflows.find((w) => w.id === "request-fulfilment");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
      <Reveal>
        <Card className="h-full overflow-hidden">
          <CardHeader title="Workflow performance" description={`Executions, results and speed · ${long}`} />
          <div className={cn("mt-4 hidden gap-4 border-y border-border bg-soft/70 px-5 py-2.5 text-xs font-semibold text-muted-foreground xl:grid", cols)}>
            <span>Workflow</span>
            <span className="text-right">Executions</span>
            <span>Success rate</span>
            <span>Avg. cycle time</span>
            <span>Health</span>
          </div>
          <ul className="divide-y divide-border max-xl:mt-4 max-xl:border-t max-xl:border-border">
            {rows.map(({ perf, wf }) => {
              const inactive = wf.status !== "active";
              const health = wf.status === "paused" ? { tone: "warning" as const, label: "Paused" } : wf.status === "draft" ? { tone: "neutral" as const, label: "Draft" } : perf.health === "attention" ? { tone: "warning" as const, label: "Needs attention" } : { tone: "success" as const, label: "Healthy" };
              return (
                <li key={perf.workflowId} className={cn("grid grid-cols-2 items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-info-soft/50", cols)}>
                  <p className="col-span-2 min-w-0 xl:col-span-1">
                    <Link href={`/workflows/${wf.id}`} className="text-[0.9375rem] font-semibold tracking-tight text-navy hover:text-brand-blue hover:underline">{wf.name}</Link>
                  </p>
                  <p className="text-[0.9375rem] font-semibold tabular-nums xl:text-right">
                    <span className="mr-1.5 text-xs font-normal text-muted-foreground xl:hidden">Executions</span>
                    {perf.executions ? perf.executions.toLocaleString() : "—"}
                  </p>
                  <div className="col-start-1 xl:col-start-auto">
                    {perf.success ? (
                      <div className="flex items-center gap-2.5">
                        <span className="w-12 text-[0.8125rem] font-semibold tabular-nums">{perf.success.toFixed(1)}%</span>
                        <Meter value={perf.success} tone="brand" className="max-w-24" />
                      </div>
                    ) : (
                      <span className="text-[0.8125rem] text-muted-foreground">No runs</span>
                    )}
                  </div>
                  <p className="text-[0.8125rem] font-medium tabular-nums">
                    <span className="mr-1.5 text-xs font-normal text-muted-foreground xl:hidden">Cycle</span>
                    {perf.cycleMin ? formatDuration(perf.cycleMin) : "—"}
                  </p>
                  <div className={cn(inactive && "opacity-90")}><StatusMark tone={health.tone} soft>{health.label}</StatusMark></div>
                </li>
              );
            })}
          </ul>
        </Card>
      </Reveal>

      <Reveal delay={0.08}>
        <Card className="h-full pb-5">
          <CardHeader title="Cycle time" description="Fastest to slowest, and where it's heading" />
          <ul className="mt-5 space-y-4 px-5">
            {timed.map(({ perf, wf }, i) => (
              <li key={wf.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[0.8125rem]">
                  <span className="min-w-0 truncate font-medium">
                    {wf.name}
                    {i === 0 && <span className="ml-2 text-[10px] font-bold text-success uppercase">Fastest</span>}
                    {i === timed.length - 1 && timed.length > 1 && <span className="ml-2 text-[10px] font-bold text-warning uppercase">Slowest</span>}
                  </span>
                  <span className="font-semibold tabular-nums">{formatDuration(perf.cycleMin)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200/70">
                  <div className="bg-brand-gradient h-full rounded-full" style={{ width: `${(perf.cycleMin / maxCycle) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <div className="mx-5 mt-6 rounded-xl bg-success-soft/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-success">
                  <TrendingDown className="size-4" /> Improving: {data.cycleChange}% faster
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{crp?.name ?? "Customer Request Processing"} is closing work sooner than in the previous period.</p>
              </div>
              <Sparkline data={data.cycleTrend.map((v) => -v)} color="#12a150" className="h-10 w-20 shrink-0" />
            </div>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
