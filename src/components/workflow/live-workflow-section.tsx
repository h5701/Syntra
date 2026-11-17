"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/common/reveal";
import { buttonVariants } from "@/components/ui/button";
import { WorkflowCanvas } from "@/components/workflow/workflow-canvas";
import { primaryWorkflow } from "@/lib/data/workflows";
import { useTeam } from "@/lib/team-state";
import { analyseWorkflow } from "@/lib/workflow-health";
import { useWorkflow } from "@/lib/workflow-state";
import { cn } from "@/lib/utils";

/** The dashboard's signature section. Reads the shared session state, so it reflects pauses, edits and runs. */
export function LiveWorkflowSection() {
  const { workflow } = useWorkflow(primaryWorkflow.id);
  const { byId } = useTeam();
  const health = analyseWorkflow(workflow);
  const running = workflow.status === "active";
  const approvals = workflow.stages.find((s) => s.kind === "approval");

  return (
    <Reveal delay={0.22} className="mt-6">
      <section
        className="surface relative overflow-hidden rounded-3xl p-4 sm:p-6"
        style={{
          backgroundImage:
            "radial-gradient(700px 260px at 0% 0%, rgb(37 99 255 / 0.06), transparent 70%), radial-gradient(600px 260px at 100% 0%, rgb(124 58 237 / 0.06), transparent 70%)",
        }}
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4 sm:mb-6">
          <div>
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase",
                running ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
              )}
            >
              <span className="relative flex size-2">
                {running && <span className="live-pulse absolute inline-flex size-full rounded-full bg-success" style={{ animation: "live-pulse 2s ease-out infinite" }} />}
                <span className={cn("relative inline-flex size-2 rounded-full", running ? "bg-success" : "bg-slate-400")} />
              </span>
              Live workflow
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-navy sm:text-[1.75rem]">{workflow.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {running ? "Running now" : workflow.status === "paused" ? "Paused" : "Draft"} ·{" "}
              <span className="font-semibold text-navy tabular-nums">{health.inFlight}</span> items · owned by {byId(workflow.ownerId).name}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <dl className="hidden gap-6 text-sm sm:flex">
              <div>
                <dt className="text-xs text-muted-foreground">Avg. cycle</dt>
                <dd className="mt-0.5 font-semibold">{workflow.avgCycle}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Success rate</dt>
                <dd className="mt-0.5 font-semibold">{workflow.successRate}%</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Needs approval</dt>
                <dd className="mt-0.5 font-semibold text-warning">{approvals?.count}</dd>
              </div>
            </dl>
            <Link href={`/workflows/${workflow.id}`} className={cn(buttonVariants({ variant: "outline" }), "h-9 gap-1.5 rounded-xl bg-white px-3.5 shadow-card")}>
              Open workflow <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
        <WorkflowCanvas
          workflow={workflow}
          workflowHref={`/workflows/${workflow.id}`}
          paused={!running}
        />
      </section>
    </Reveal>
  );
}
