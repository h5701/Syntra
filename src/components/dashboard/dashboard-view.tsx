"use client";

import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Hourglass, Layers, Pause, Zap } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";
import { Card, CardHeader } from "@/components/common/section";
import { MemberAvatar } from "@/components/common/member-avatar";
import { Reveal } from "@/components/common/reveal";
import { Ring } from "@/components/common/ring";
import { StatusMark, processTone } from "@/components/common/status";
import { PageHeader } from "@/components/shell/page-header";
import { LiveWorkflowSection } from "@/components/workflow/live-workflow-section";
import { FormattedDate } from "@/components/common/formatted-date";
import { kpis, processes, recentActivity } from "@/lib/data/operations";
import { useSettings } from "@/lib/settings-state";
import { useTeam } from "@/lib/team-state";
import { useWorkflows } from "@/lib/workflow-state";
import { cn } from "@/lib/utils";

const tone = {
  good: { dot: "bg-success", icon: CheckCircle2, text: "text-success", tint: "bg-success-soft" },
  warn: { dot: "bg-warning", icon: Hourglass, text: "text-warning", tint: "bg-warning-soft" },
  bad: { dot: "bg-danger", icon: AlertTriangle, text: "text-danger", tint: "bg-danger-soft" },
  neutral: { dot: "bg-slate-400", icon: Pause, text: "text-muted-foreground", tint: "bg-muted" },
};

function Delta({ children, good = true, down }: { children: React.ReactNode; good?: boolean; down?: boolean }) {
  const Arrow = down ? ArrowDownRight : ArrowUpRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold", good ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
      <Arrow className="size-3.5" />
      {children}
    </span>
  );
}

/** The operations briefing. Reads shared session state so names, counts and owners stay current. */
export function DashboardView() {
  const { members, byId } = useTeam();
  const workflows = useWorkflows();
  const operatorFirstName = useSettings().settings.profile.name.split(" ")[0];
  const activeCount = workflows.filter((w) => w.status === "active").length;
  const wellRunning = workflows.filter((w) => w.status === "active" && ["employee-onboarding", "vendor-onboarding"].includes(w.id));
  const attention = processes.filter((p) => p.health !== "on-track").slice(0, 3);
  const workload = [...members].sort((a, b) => b.capacity - a.capacity).slice(0, 5);

  // Awaiting action = approvals waiting on someone, taken from the live Customer Request Processing workflow.
  const approval = workflows.find((w) => w.id === "request-fulfilment")?.stages.find((st) => st.kind === "approval");
  const awaitingTotal = approval?.count ?? kpis.awaitingAction.value;
  const overdue = Math.min(approval?.overdue ?? 0, awaitingTotal);
  const awaiting = [
    { label: "Past expected time", n: overdue, color: "bg-warning" },
    { label: "Within expected time", n: awaitingTotal - overdue, color: "bg-brand-blue" },
  ].filter((a) => a.n > 0);

  return (
    <>
      <PageHeader title={`Good morning, ${operatorFirstName}.`} description="Here's what's happening across your operation." />

      {/* Overview: four KPIs, deliberately different compositions */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1.1fr]">
        <Reveal delay={0}>
          <Card className="relative flex h-full flex-col overflow-hidden bg-gradient-to-br from-info-soft/80 via-white to-violet-50 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <span className="bg-brand-gradient flex size-8 items-center justify-center rounded-lg text-white">
                <Layers className="size-4" />
              </span>
              Active workflows
            </div>
            <div className="mt-4 flex items-end gap-3">
              <span className="text-5xl leading-none font-bold tracking-tight text-navy tabular-nums">{activeCount}</span>
              <Delta>{kpis.activeWorkflows.delta}</Delta>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">of {workflows.length} workflows are running</p>
            <Sparkline data={[...kpis.activeWorkflows.trend.slice(0, -1), activeCount]} color="#2563ff" className="mt-4 -mb-5 -ml-5 h-16 w-[calc(100%+2.5rem)]" />
          </Card>
        </Reveal>

        <Reveal delay={0.06}>
          <Card className="flex h-full flex-col p-5">
            <div className="flex items-start justify-between">
              <span className="flex size-9 items-center justify-center rounded-xl bg-danger-soft text-danger">
                <AlertTriangle className="size-[18px]" />
              </span>
              <Sparkline data={kpis.atRisk.trend} color="#e5484d" fill={false} className="h-8 w-20" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-600">At risk</p>
            <p className="mt-1 text-4xl leading-none font-bold tracking-tight text-navy tabular-nums">{kpis.atRisk.value}</p>
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-success">
              <ArrowDownRight className="size-3.5" /> 1 from yesterday
            </p>
          </Card>
        </Reveal>

        <Reveal delay={0.12}>
          <Card className="flex h-full flex-col p-5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-warning-soft text-warning">
              <Hourglass className="size-[18px]" />
            </span>
            <p className="mt-4 text-sm font-medium text-slate-600">Awaiting action</p>
            <p className="mt-1 text-4xl leading-none font-bold tracking-tight text-navy tabular-nums">{awaitingTotal}</p>
            <div className="mt-4 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
              {awaiting.map((a) => (
                <span key={a.label} className={a.color} style={{ flex: a.n }} />
              ))}
            </div>
            <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {awaiting.map((a) => (
                <li key={a.label} className="flex items-center gap-1">
                  <span className={cn("size-1.5 rounded-full", a.color)} />
                  {a.label} {a.n}
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>

        <Reveal delay={0.18}>
          <Card className="flex h-full items-center gap-5 p-5">
            <Ring value={kpis.onTrack.value} size={92} stroke={9}>
              <Zap className="size-5 text-brand-blue" />
            </Ring>
            <div>
              <p className="text-sm font-medium text-slate-600">On track</p>
              <p className="mt-1 text-4xl leading-none font-bold tracking-tight text-navy tabular-nums">
                {kpis.onTrack.value}
                <span className="text-xl text-muted-foreground">%</span>
              </p>
              <div className="mt-2.5">
                <Delta>{kpis.onTrack.delta}</Delta>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      <LiveWorkflowSection />

      <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Reveal delay={0.05}>
          <Card className="h-full pb-5">
            <CardHeader title="Recent activity" description="What changed in the last day" />
            <ol className="relative mt-5 space-y-5 px-5">
              <span className="absolute top-2 bottom-2 left-[33px] w-px bg-border" />
              {recentActivity.map((a) => {
                const t = tone[a.tone];
                const Icon = t.icon;
                return (
                  <li key={a.id} className="relative flex gap-3.5">
                    <span className={cn("relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-white", t.tint, t.text)}>
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.8125rem] leading-snug">
                        <span className="font-semibold">{byId(a.actorId).name.split(" ")[0]}</span>{" "}
                        <span className="text-muted-foreground">{a.text}</span> {a.target}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.time}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </Reveal>

        <Reveal delay={0.1}>
          <Card className="h-full pb-5">
            <CardHeader title="Needs attention" description="Processes that could miss their SLA" />
            <ul className="mt-4 space-y-3 px-5">
              {attention.map((p) => {
                const t = processTone[p.health];
                const hot = t.tone === "danger";
                return (
                  <li key={p.id} className={cn("rounded-xl border-l-[3px] p-3.5", hot ? "border-danger bg-danger-soft/60" : "border-warning bg-warning-soft/60")}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[0.8125rem] leading-snug font-semibold">{p.name}</p>
                      <StatusMark tone={t.tone} className="text-xs">{t.label}</StatusMark>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {p.currentStage} · due <FormattedDate iso={p.dueDate} /> · {p.note}
                    </p>
                  </li>
                );
              })}
            </ul>
            {wellRunning.length > 0 && (
              <p className="mx-5 mt-4 flex items-start gap-2 rounded-xl bg-success-soft px-3 py-2.5 text-xs text-success">
                <CheckCircle2 className="mt-px size-3.5 shrink-0" />
                Running well: {wellRunning.map((w) => `${w.name} (${w.successRate}%)`).join(" and ")} {wellRunning.length > 1 ? "are" : "is"} above SLA.
              </p>
            )}
          </Card>
        </Reveal>

        <Reveal delay={0.15} className="lg:col-span-2 xl:col-span-1">
          <Card className="h-full pb-3">
            <CardHeader
              title="Team workload"
              description="Highest utilisation first"
              action={<Link href="/team" className="text-sm font-semibold text-brand-blue hover:underline">View all</Link>}
            />
            <ul className="mt-3 px-3">
              {workload.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-soft">
                  <MemberAvatar id={m.id} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-semibold">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.openItems} open items</p>
                  </div>
                  <Ring value={m.capacity} size={40} stroke={5} tone={m.capacity > 90 ? "bad" : m.capacity > 80 ? "warn" : "brand"}>
                    <span className="text-[10px] font-bold tabular-nums">{m.capacity}</span>
                  </Ring>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>
    </>
  );
}
