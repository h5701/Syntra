"use client";

import { useState } from "react";
import { Bottlenecks } from "@/components/analytics/bottlenecks";
import { AutomationPerformance } from "@/components/analytics/automation-performance";
import { Overview } from "@/components/analytics/overview";
import { RangeControl } from "@/components/analytics/range-control";
import { TeamCapacity } from "@/components/analytics/team-capacity";
import { WorkflowPerformance } from "@/components/analytics/workflow-performance";
import { PageHeader } from "@/components/shell/page-header";
import { rangeData, type Range } from "@/lib/data/analytics";

/** Operational performance: how work is moving, where it's stuck, and who has capacity. */
export function AnalyticsView() {
  const [range, setRange] = useState<Range>("7d");
  const data = rangeData[range];

  return (
    <>
      <PageHeader
        title="Operational performance"
        description="Understand how work is moving across your workflows, people and automations."
        actions={<RangeControl value={range} onChange={setRange} />}
      />

      <div className="space-y-10 lg:space-y-12">
        <Overview range={range} data={data} />
        <Bottlenecks />
        <WorkflowPerformance range={range} data={data} />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
          <TeamCapacity />
          <AutomationPerformance range={range} data={data} />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          All figures are fictional demo data for the Syntra concept. They don&apos;t describe real customers, systems or operational performance.
        </p>
      </div>
    </>
  );
}
