import type { Metadata } from "next";
import { Card } from "@/components/common/section";
import { MemberAvatar } from "@/components/common/member-avatar";
import { Meter } from "@/components/common/meter";
import { Reveal } from "@/components/common/reveal";
import { StatusMark, processTone } from "@/components/common/status";
import { PageHeader } from "@/components/shell/page-header";
import { processes } from "@/lib/data/operations";
import { MemberName } from "@/components/common/member-name";
import { WorkflowLink } from "@/components/workflow/workflow-link";
import { FormattedDate } from "@/components/common/formatted-date";
import { dueState } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProcessHealth } from "@/lib/types";

export const metadata: Metadata = { title: "Processes" };

const order: ProcessHealth[] = ["on-track", "at-risk", "delayed", "blocked"];
const bar: Record<ProcessHealth, string> = { "on-track": "bg-success", "at-risk": "bg-warning", delayed: "bg-danger/80", blocked: "bg-danger" };
const cols = "xl:grid-cols-[minmax(0,2.4fr)_1fr_1.4fr_1.2fr_0.9fr]";

export default function ProcessesPage() {
  const sorted = [...processes].sort((a, b) => order.indexOf(b.health) - order.indexOf(a.health));
  return (
    <>
      <PageHeader title="Processes" description="The processes in focus across your workflows, and how healthy each one is." />

      <Reveal>
        <Card className="mb-6 p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Health across {processes.length} processes in focus</p>
              <p className="mt-1 text-3xl leading-none font-bold tracking-tight tabular-nums">
                {processes.filter((p) => p.health === "on-track").length}
                <span className="ml-2 text-sm font-medium text-muted-foreground">of {processes.length} on track</span>
              </p>
            </div>
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              {order.map((h) => (
                <div key={h}>
                  <dt><StatusMark tone={processTone[h].tone} className="text-xs">{processTone[h].label}</StatusMark></dt>
                  <dd className="mt-1 text-xl leading-none font-bold tabular-nums">{processes.filter((p) => p.health === h).length}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="mt-5 flex h-2.5 gap-1 overflow-hidden rounded-full">
            {order.map((h) => (
              <span key={h} className={cn("rounded-full", bar[h])} style={{ flex: processes.filter((p) => p.health === h).length || 0.0001 }} />
            ))}
          </div>
        </Card>
      </Reveal>

      <Card className="overflow-hidden">
        <div className={cn("hidden gap-4 border-b border-border bg-soft/70 px-5 py-3 text-xs font-semibold text-muted-foreground xl:grid", cols)}>
          <span>Process</span>
          <span>Health</span>
          <span>Stage</span>
          <span>Owner</span>
          <span className="text-right">Due date</span>
        </div>
        <ul className="divide-y divide-border">
          {sorted.map((p) => {
            const t = processTone[p.health];
            const due = dueState(p.dueDate);
            return (
              <li key={p.id} className={cn("grid items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-info-soft/50", cols)}>
                <div className="min-w-0">
                  <p className="text-[0.875rem] font-semibold text-navy">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <WorkflowLink id={p.workflowId} className="hover:text-brand-blue hover:underline" /> · {p.note}
                  </p>
                </div>
                <div><StatusMark tone={t.tone} soft>{t.label}</StatusMark></div>
                <div>
                  <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                    <span>{p.currentStage}</span>
                    <span className="font-semibold tabular-nums text-navy">{p.progress}%</span>
                  </div>
                  <Meter value={p.progress} tone={p.health === "on-track" ? "brand" : p.health === "at-risk" ? "warn" : "bad"} />
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <MemberAvatar id={p.ownerId} size="sm" />
                  <span className="truncate text-[0.8125rem]"><MemberName id={p.ownerId} /></span>
                </div>
                <p
                  className={cn(
                    "text-[0.8125rem] tabular-nums xl:text-right",
                    due === "overdue" ? "font-semibold text-danger" : due === "today" ? "font-semibold text-warning" : "text-muted-foreground",
                  )}
                >
                  <span className="mr-1.5 text-xs font-normal text-muted-foreground xl:hidden">Due date</span>
                  <FormattedDate iso={p.dueDate} />
                  {due === "overdue" && <span className="block text-[11px] font-medium">Overdue</span>}
                </p>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
