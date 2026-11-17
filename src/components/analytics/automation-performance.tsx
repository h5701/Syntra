"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardHeader } from "@/components/common/section";
import { Meter } from "@/components/common/meter";
import { Reveal } from "@/components/common/reveal";
import { StatusMark } from "@/components/common/status";
import { useAutomations } from "@/lib/automation-state";
import { ranges, type Range, type RangeData } from "@/lib/data/analytics";
import { cn } from "@/lib/utils";

/** How automations are doing. Names and status come from the live session; run counts are demo data. */
export function AutomationPerformance({ range, data }: { range: Range; data: RangeData }) {
  const { automations } = useAutomations();
  const long = ranges.find((r) => r.id === range)!.long;
  const rows = automations
    .filter((a) => data.automations[a.id])
    .map((a) => {
      const stats = data.automations[a.id];
      return { a, runs: stats.runs, success: stats.success, failed: Math.round((stats.runs * (100 - stats.success)) / 100) };
    })
    .sort((x, y) => y.runs - x.runs);
  const runs = rows.reduce((n, r) => n + r.runs, 0);
  const failed = rows.reduce((n, r) => n + r.failed, 0);
  const rate = runs ? ((runs - failed) / runs) * 100 : 0;
  const top = rows.slice(0, 5);

  return (
    <Reveal delay={0.08}>
      <Card className="h-full pb-3">
        <CardHeader
          title="Automation performance"
          description={`Runs and results · ${long}`}
          action={
            <Link href="/automations" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline">
              All <ArrowRight className="size-3.5" />
            </Link>
          }
        />
        <dl className="mx-5 mt-5 grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-soft p-3">
            <dt className="text-[11px] font-medium text-muted-foreground">Runs</dt>
            <dd className="mt-1 text-xl leading-none font-bold tracking-tight tabular-nums">{runs.toLocaleString()}</dd>
          </div>
          <div className="rounded-xl bg-soft p-3">
            <dt className="text-[11px] font-medium text-muted-foreground">Success rate</dt>
            <dd className="mt-1 text-xl leading-none font-bold tracking-tight tabular-nums">{runs ? `${rate.toFixed(1)}%` : "—"}</dd>
          </div>
          <div className={cn("rounded-xl p-3", failed ? "bg-warning-soft/70" : "bg-soft")}>
            <dt className="text-[11px] font-medium text-muted-foreground">Failed runs</dt>
            <dd className={cn("mt-1 text-xl leading-none font-bold tracking-tight tabular-nums", failed && "text-warning")}>{failed}</dd>
          </div>
        </dl>
        {top.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No automation history for this range.</p>
        ) : (
          <>
            <p className="mx-5 mt-5 mb-1 text-xs font-semibold text-muted-foreground">Most active</p>
            <ul className="px-3">
              {top.map((r, i) => (
                <li key={r.a.id} className="rounded-xl px-2 py-3 transition-colors hover:bg-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/automations?open=${r.a.id}`} className="text-[0.8125rem] font-semibold text-navy hover:text-brand-blue hover:underline">
                        {r.a.name}
                      </Link>
                      {i === 0 && <span className="ml-2 rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-bold text-brand-blue uppercase">Most active</span>}
                      {r.a.status === "paused" && <span className="ml-2 inline-block align-middle"><StatusMark tone="warning" className="text-[11px]">Paused</StatusMark></span>}
                    </div>
                    <span className="shrink-0 text-[0.8125rem] font-bold tabular-nums">{r.runs.toLocaleString()} <span className="font-normal text-muted-foreground">runs</span></span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Meter value={r.success} tone={r.success >= 98 ? "good" : r.success >= 94 ? "brand" : "warn"} />
                    <span className="w-28 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                      <span className="font-semibold text-navy">{r.success.toFixed(1)}%</span> · {r.failed} failed
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </Reveal>
  );
}
