"use client";

import { Activity, GitBranch, Layers } from "lucide-react";
import { Card } from "@/components/common/section";
import { Reveal } from "@/components/common/reveal";
import { inFlightCount } from "@/lib/workflow-health";
import { useWorkflows } from "@/lib/workflow-state";

export function WorkflowStats() {
  const workflows = useWorkflows();
  const active = workflows.filter((w) => w.status === "active");
  const items = workflows.reduce((n, w) => n + inFlightCount(w), 0);
  const rated = workflows.filter((w) => w.successRate > 0);
  const avg = Math.round(rated.reduce((n, w) => n + w.successRate, 0) / rated.length);
  const stats = [
    { label: "Active workflows", value: `${active.length} of ${workflows.length}`, icon: GitBranch, tint: "bg-info-soft text-brand-blue" },
    { label: "Items in flight", value: String(items), icon: Layers, tint: "bg-violet-50 text-brand-purple" },
    { label: "Average success rate", value: `${avg}%`, icon: Activity, tint: "bg-success-soft text-success" },
  ];
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      {stats.map((s, i) => (
        <Reveal key={s.label} delay={i * 0.06}>
          <Card className="flex items-center gap-4 p-4">
            <span className={`flex size-11 items-center justify-center rounded-xl ${s.tint}`}>
              <s.icon className="size-5" />
            </span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <p className="mt-0.5 text-2xl leading-none font-bold tracking-tight tabular-nums">{s.value}</p>
            </div>
          </Card>
        </Reveal>
      ))}
    </div>
  );
}
