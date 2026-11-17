"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Reveal } from "@/components/common/reveal";
import { Card, CardHeader } from "@/components/common/section";
import { InsightCard } from "@/components/insights/insight-card";
import { ScenarioCompare } from "@/components/insights/scenario-compare";
import { SourceChip, sourceInfo } from "@/components/insights/source-label";
import { PageHeader } from "@/components/shell/page-header";
import { processes } from "@/lib/data/operations";
import { buildInsights, type InsightSource } from "@/lib/insights";
import { useTeam } from "@/lib/team-state";
import { useInsightInputs } from "@/lib/workflow-state";
import { cn } from "@/lib/utils";

const sources: InsightSource[] = ["demo-operational", "simulation", "definition"];

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl leading-none font-bold tracking-tight text-navy tabular-nums">{value}</dd>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Process insights: evidence-based observations, each saying where its evidence comes from. Fictional
 * operational figures, simulation runs and workflow definitions are shown separately and never added together.
 */
export function InsightsView() {
  const { workflows, layouts, runs } = useInsightInputs();
  const { members } = useTeam();
  const [filter, setFilter] = useState<"all" | InsightSource>("all");

  const result = useMemo(() => buildInsights({ workflows, layouts, runs, processes, members }), [workflows, layouts, runs, members]);
  const counts = Object.fromEntries(sources.map((s) => [s, result.insights.filter((i) => i.source === s).length])) as Record<InsightSource, number>;
  const shown = result.insights.filter((i) => filter === "all" || i.source === filter);
  const { operational: op, simulation: sim } = result;
  const comparable = useMemo(() => workflows.map((w) => ({ id: w.id, name: w.name, layout: layouts[w.id] })), [workflows, layouts]);

  return (
    <>
      <PageHeader
        title="Process insights"
        description="Observations about how work flows, each with the evidence behind it and where that evidence comes from."
      />

      <div className="space-y-10 lg:space-y-12">
        <Reveal>
          <section aria-labelledby="sources-title">
            <h2 id="sources-title" className="text-lg font-semibold tracking-tight">Where the evidence comes from</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Every insight and every piece of evidence is labelled with one of these. They are never added together.</p>
            <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
              {sources.map((s) => (
                <li key={s} className="surface rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <SourceChip source={s} />
                    <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground tabular-nums">{counts[s]} {counts[s] === 1 ? "insight" : "insights"}</span>
                  </div>
                  <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-muted-foreground">{sourceInfo[s].blurb}</p>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
            <Card className="pb-5">
              <CardHeader title="Operational picture" description="From the fictional demo data. Seeded workflows only." action={<SourceChip source="demo-operational" short />} />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-5 px-5 pt-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                <Stat label="Workflows reviewed" value={op.workflowsReviewed} hint={`${op.activeWorkflows} active`} />
                <Stat label="Stages behind" value={op.stagesNeedingAttention} hint="needs attention or at risk" />
                <Stat label="Items past expected time" value={op.overdueItems} hint={`of ${op.itemsInFlight} in flight`} />
                <Stat label="Processes at risk" value={op.processesAtRisk} hint={`of ${op.processesTotal}`} />
              </dl>
            </Card>
            <Card className="pb-5">
              <CardHeader title="Simulation picture" description="From runs in this session. Not operational activity." action={<SourceChip source="simulation" short />} />
              {sim ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-5 px-5 pt-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                  <Stat label="Simulated runs" value={sim.runs} hint={`${sim.workflowsWithRuns} ${sim.workflowsWithRuns === 1 ? "workflow" : "workflows"}`} />
                  <Stat label="Reached the End" value={sim.completed} hint={`${sim.blocked} blocked · ${sim.failed} failed · ${sim.stopped} stopped`} />
                  <Stat label="Took the Yes path" value={sim.yes} hint="Condition decisions" />
                  <Stat label="Took the No path" value={sim.no} hint="Condition decisions" />
                </dl>
              ) : (
                <p className="px-5 pt-4 text-[0.8125rem] leading-relaxed text-muted-foreground">
                  No simulated runs yet, so there is nothing to summarise. Open a workflow and use <span className="font-semibold text-navy">Simulate run</span>; runs are kept for this session only.{" "}
                  <Link href="/workflows" className="font-semibold text-brand-blue hover:underline">Go to workflows</Link>
                </p>
              )}
            </Card>
          </div>
        </Reveal>

        <section aria-labelledby="insights-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="insights-title" className="text-lg font-semibold tracking-tight">Insights</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{shown.length} shown, most important first.</p>
            </div>
            <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-white p-1 shadow-card" role="group" aria-label="Filter by evidence source">
              {(["all", ...sources] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none motion-reduce:transition-none",
                    filter === f ? "bg-brand-gradient text-white shadow-sm" : "text-muted-foreground hover:bg-soft hover:text-navy",
                  )}
                >
                  {f === "all" ? "All" : sourceInfo[f].label}
                  <span className={cn("ml-1 text-xs tabular-nums", filter === f ? "text-white/80" : "text-slate-400")}>{f === "all" ? result.insights.length : counts[f]}</span>
                </button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="surface rounded-2xl px-5 py-8 text-center text-[0.8125rem] text-muted-foreground">
              {filter === "simulation" ? "No simulation insights yet. They appear once simulated runs show a pattern, such as one Condition path never being tried." : "Nothing to show for this source."}
            </p>
          ) : (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
              {shown.map((i) => (
                <li key={i.id} className="min-w-0"><InsightCard insight={i} /></li>
              ))}
            </ul>
          )}
        </section>

        <ScenarioCompare workflows={comparable} />

        <section aria-labelledby="limits-title" className="rounded-2xl bg-soft px-5 py-4">
          <h2 id="limits-title" className="text-sm font-semibold text-navy">What this data can and can&apos;t show</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.8125rem] leading-relaxed text-muted-foreground">
            {result.limitations.map((l) => <li key={l}>{l}</li>)}
            <li>Insights come from fixed rules over the data above. Nothing is predicted, learned or generated, and a simulated result is never evidence of a real outcome.</li>
          </ul>
        </section>
      </div>
    </>
  );
}
