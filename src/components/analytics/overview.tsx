"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Gauge, ShieldAlert } from "lucide-react";
import { AreaChart } from "@/components/charts/area-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { Card, CardHeader } from "@/components/common/section";
import { Reveal } from "@/components/common/reveal";
import { Ring } from "@/components/common/ring";
import { bottleneckedItems, formatDuration, ranges, type RangeData, type Range } from "@/lib/data/analytics";

function Delta({ children, down }: { children: React.ReactNode; down?: boolean }) {
  const Arrow = down ? ArrowDownRight : ArrowUpRight;
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
      <Arrow className="size-3.5" />
      {children}
    </span>
  );
}

/** Headline: one dominant trend with its two key numbers, and three compact supporting metrics. */
export function Overview({ range, data }: { range: Range; data: RangeData }) {
  const long = ranges.find((r) => r.id === range)!.long;
  const total = data.workflows.reduce((n, w) => n + w.executions, 0);
  const success = data.workflows.reduce((n, w) => n + w.success * w.executions, 0) / total;
  const avgMin = data.workflows.reduce((n, w) => n + w.cycleMin * w.executions, 0) / total;
  const peak = data.trend.reduce((a, b) => (b.value > a.value ? b : a));
  const quiet = data.trend.reduce((a, b) => (b.value < a.value ? b : a));
  const unit = range === "90d" ? "week" : "day";
  const perUnit = Math.round(total / data.trend.length);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
      <Reveal>
        <Card className="h-full bg-gradient-to-br from-info-soft/50 via-white to-violet-50/60 pb-5">
          <CardHeader className="sm:px-6" title="Workflow executions" description={`All workflows · ${long}`} />
          <div className="mt-5 flex flex-wrap items-end gap-x-10 gap-y-4 px-5 sm:px-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total executions</p>
              <div className="mt-1 flex items-center gap-2.5">
                <span className="text-4xl leading-none font-bold tracking-tight text-navy tabular-nums sm:text-5xl">{total.toLocaleString()}</span>
                <Delta>{data.deltas.executions}</Delta>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Ring value={success} size={56} stroke={6} />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Success rate</p>
                <p className="mt-0.5 flex items-center gap-2 text-2xl leading-none font-bold tracking-tight tabular-nums">
                  {success.toFixed(1)}%<Delta>{data.deltas.success}</Delta>
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6 px-5 sm:px-6">
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="bg-brand-gradient h-1 w-4 rounded-full" />Executions</span>
              <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-slate-300" />Successful</span>
              <span className="ml-auto hidden sm:inline">Hover the chart for daily detail</span>
            </div>
            <AreaChart key={range} data={data.trend} primaryLabel="executions" secondaryLabel="successful" height={240} />
          </div>
          <dl className="mx-5 mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 sm:mx-6">
            <div>
              <dt className="text-[11px] font-medium text-muted-foreground">Busiest {unit}</dt>
              <dd className="mt-1 text-[0.8125rem] font-semibold">{peak.label} <span className="font-normal text-muted-foreground">· {peak.value.toLocaleString()}</span></dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-muted-foreground">Quietest {unit}</dt>
              <dd className="mt-1 text-[0.8125rem] font-semibold">{quiet.label} <span className="font-normal text-muted-foreground">· {quiet.value.toLocaleString()}</span></dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-muted-foreground">Average per {unit}</dt>
              <dd className="mt-1 text-[0.8125rem] font-semibold tabular-nums">{perUnit.toLocaleString()}</dd>
            </div>
          </dl>
        </Card>
      </Reveal>

      <Reveal delay={0.08}>
        <Card className="flex h-full flex-col overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <span className="flex size-8 items-center justify-center rounded-lg bg-info-soft text-brand-blue"><Gauge className="size-4" /></span>
              Average processing time
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl leading-none font-bold tracking-tight tabular-nums">{formatDuration(avgMin)}</p>
                <div className="mt-2"><Delta down>{data.deltas.time}</Delta></div>
              </div>
              <Sparkline data={data.cycleTrend.map((v) => -v)} color="#06b6d4" className="h-12 w-28" />
            </div>
          </div>
          <div className="border-t border-border p-5">
            <p className="text-sm font-medium text-slate-600">Items completed</p>
            <p className="mt-2 flex items-center gap-2.5 text-3xl leading-none font-bold tracking-tight tabular-nums">
              {data.completed.toLocaleString()}
              <Delta>{data.deltas.completed}</Delta>
            </p>
          </div>
          <Link href="#bottlenecks" className="mt-auto flex items-center gap-3.5 border-t border-warning/25 bg-warning-soft/70 p-5 transition-colors hover:bg-warning-soft">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-warning"><ShieldAlert className="size-5" /></span>
            <span>
              <span className="block text-sm font-medium text-slate-600">Bottlenecked items</span>
              <span className="flex items-baseline gap-2">
                <span className="text-3xl leading-none font-bold tracking-tight text-warning tabular-nums">{bottleneckedItems}</span>
                <span className="text-xs font-semibold text-warning">right now · see where ↓</span>
              </span>
            </span>
          </Link>
        </Card>
      </Reveal>
    </div>
  );
}
