"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import { MemberAvatar } from "@/components/common/member-avatar";
import { Meter } from "@/components/common/meter";
import { StatusMark, healthTone, toneText } from "@/components/common/status";
import { healthColor, progressionColor } from "@/components/workflow/flow-colors";
import { stageIcon } from "@/components/workflow/stage-meta";
import { stageStatusLabel } from "@/lib/workflow-health";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useTeam } from "@/lib/team-state";
import { cn } from "@/lib/utils";
import type { WorkflowStage } from "@/lib/types";

const priorityDot = { high: "bg-danger", medium: "bg-warning", low: "bg-slate-300" };

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

/** Inspector for a single stage of the workflow. */
export function NodeDetailPanel({
  stage,
  stageNumber,
  stageCount,
  workflowName,
  workflowHref,
}: {
  stage: WorkflowStage;
  stageNumber: number;
  stageCount: number;
  workflowName: string;
  workflowHref?: string;
}) {
  const { byId } = useTeam();
  const owner = byId(stage.ownerId);
  const Icon = stageIcon[stage.kind];
  const flagged = stage.health === "attention" || stage.health === "critical";
  const accent = flagged || stage.health === "idle" ? healthColor[stage.health] : progressionColor((stageNumber - 1) / Math.max(1, stageCount - 1));
  const scroller = useRef<HTMLDivElement>(null);

  // Opening the sheet moves focus to its close button (last in the DOM); keep the inspector at the top.
  useEffect(() => {
    const reset = () => scroller.current?.scrollTo({ top: 0 });
    reset();
    const id = requestAnimationFrame(reset);
    const t = setTimeout(reset, 120);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
    };
  }, [stage.id]);

  return (
    <div ref={scroller} className="flex h-full flex-col overflow-y-auto">
      <div
        className="relative px-6 pt-7 pb-6"
        style={{ backgroundImage: `radial-gradient(420px 180px at 0% 0%, ${accent}1f, transparent 70%)` }}
      >
        <p className="text-xs font-medium text-muted-foreground">
          {workflowName} · Stage {stageNumber} of {stageCount}
        </p>
        <div className="mt-4 flex items-center gap-3.5">
          <span className="flex size-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${accent}1f`, color: accent }}>
            <Icon className="size-6" strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <SheetTitle className="text-2xl leading-tight font-bold tracking-tight text-navy">{stage.name}</SheetTitle>
            <div className="mt-1.5">
              <StatusMark tone={healthTone[stage.health]} soft>
                {stageStatusLabel[stage.health]}
              </StatusMark>
            </div>
          </div>
        </div>
        <SheetDescription className="mt-4 max-w-sm text-sm leading-relaxed">{stage.description}</SheetDescription>
      </div>

      <div className="mx-6 mb-7 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-soft p-3">
          <p className="text-[11px] font-medium text-muted-foreground">Status</p>
          <p className={cn("mt-1.5 text-[0.9375rem] font-semibold", toneText[stage.health === "healthy" ? "good" : stage.health === "attention" ? "warn" : stage.health === "critical" ? "bad" : "neutral"])}>
            {stageStatusLabel[stage.health]}
          </p>
        </div>
        <div className="rounded-xl bg-soft p-3">
          <p className="text-[11px] font-medium text-muted-foreground">Owner</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <MemberAvatar id={owner.id} size="xs" />
            <span className="truncate text-[0.9375rem] font-semibold">{owner.name}</span>
          </div>
        </div>
        <div className="rounded-xl bg-soft p-3">
          <p className="text-[11px] font-medium text-muted-foreground">Items</p>
          <p className="mt-1 text-xl leading-none font-bold tracking-tight tabular-nums">{stage.count}</p>
          {!!stage.overdue && <p className="mt-1 text-xs font-semibold text-warning">{stage.overdue} past expected time</p>}
        </div>
        <div className="rounded-xl bg-soft p-3">
          <p className="text-[11px] font-medium text-muted-foreground">Average processing time</p>
          <p className="mt-1 text-xl leading-none font-bold tracking-tight tabular-nums">{stage.time}</p>
        </div>
      </div>

      <Block title="Current items" meta={`Showing ${stage.items.length} of ${stage.count}`}>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {stage.items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-soft">
              <span className={cn("size-2 shrink-0 rounded-full", priorityDot[it.priority])} title={`${it.priority} priority`}><span className="sr-only">{it.priority} priority</span></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8125rem] font-medium">
                  {it.id.startsWith("#") ? `Request ${it.id}` : it.id}
                  {it.state && <span className="font-normal text-muted-foreground"> — {it.state}</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {it.title} · {it.age}
                </p>
              </div>
              <MemberAvatar id={it.assigneeId} size="sm" />
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Recent movement">
        <ol className="relative space-y-4 pl-5">
          <span className="absolute top-1.5 bottom-1.5 left-[5px] w-px bg-border" />
          {stage.activity.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute top-1.5 -left-5 size-[11px] rounded-full border-2 border-white bg-brand-gradient ring-1 ring-border" />
              <p className="text-[0.8125rem] leading-snug">{a.text}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{a.time}</p>
            </li>
          ))}
        </ol>
      </Block>

      <Block title="Performance">
        <div className="rounded-xl bg-soft p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[0.8125rem] text-muted-foreground">SLA compliance</span>
            <span className="text-lg font-bold tabular-nums">{stage.sla}%</span>
          </div>
          <Meter value={stage.sla} className="bg-white" />
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" /> Processing time <span className="font-semibold text-navy">{stage.time}</span> · {stage.timeNote}
          </div>
        </div>
        <dl className="mt-3 divide-y divide-border">
          {stage.metrics.map((m) => (
            <div key={m.label} className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="text-[0.8125rem] text-muted-foreground">{m.label}</dt>
              <dd className="text-right text-[0.8125rem]">
                <span className="font-semibold">{m.value}</span>
                {m.hint && <span className={cn("ml-2 text-xs", toneText[m.tone ?? "neutral"])}>{m.hint}</span>}
              </dd>
            </div>
          ))}
        </dl>
        {workflowHref && (
          <Link href={workflowHref} className="mt-5 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-brand-blue hover:underline">
            Open full workflow <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </Block>
    </div>
  );
}
