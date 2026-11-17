import { AlertTriangle, Check, CircleSlash, Flag, OctagonX, Split } from "lucide-react";
import { branchColor } from "@/components/builder/builder-edge";
import { nodeMeta } from "@/lib/builder-nodes";
import { formatElapsed, type RunStatus, type RunStep } from "@/lib/simulation";
import { cn } from "@/lib/utils";

export const statusInfo: Record<RunStatus, { label: string; tone: string; soft: string; Icon: typeof Check; summary: string }> = {
  completed: { label: "Completed", tone: "text-success", soft: "bg-success-soft", Icon: Check, summary: "Reached the End." },
  blocked: { label: "Blocked", tone: "text-warning", soft: "bg-warning-soft", Icon: AlertTriangle, summary: "Stopped because the sample input couldn't decide a Condition." },
  failed: { label: "Failed", tone: "text-danger", soft: "bg-danger-soft", Icon: OctagonX, summary: "Stopped because of a problem with the workflow or its configuration." },
  stopped: { label: "Stopped", tone: "text-muted-foreground", soft: "bg-muted", Icon: CircleSlash, summary: "Stopped before the End." },
};

export function RunStatusChip({ status, className }: { status: RunStatus; className?: string }) {
  const s = statusInfo[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", s.soft, s.tone, className)}>
      <s.Icon className="size-3.5" aria-hidden /> {s.label}
    </span>
  );
}

/** What happened, step by step. Used for the run in progress and for runs reopened from history. */
export function RunTimeline({ steps, activeIndex }: { steps: RunStep[]; activeIndex?: number }) {
  return (
    <ol className="space-y-0" aria-label="Run timeline">
      {steps.map((step, i) => {
        const meta = nodeMeta(step.type);
        const Icon = step.type === "end" ? Flag : meta.icon;
        const bad = step.outcome === "blocked" || step.outcome === "failed";
        const current = activeIndex === i;
        const last = i === steps.length - 1;
        return (
          <li key={step.index} className="relative flex gap-3 pb-4 last:pb-0" aria-current={current ? "step" : undefined}>
            {!last && <span className="absolute top-9 bottom-0 left-[1.0625rem] w-px bg-border" aria-hidden />}
            <span
              className={cn(
                "relative z-10 flex size-[2.125rem] shrink-0 items-center justify-center rounded-xl text-white transition-shadow motion-reduce:transition-none",
                current && "ring-4 ring-brand-blue/15",
                bad && "ring-4 ring-danger/15",
              )}
              style={{ backgroundColor: bad ? (step.outcome === "blocked" ? "#ea7a0c" : "#e5484d") : meta.accent }}
            >
              {bad ? <AlertTriangle className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[0.9375rem] font-semibold text-navy [overflow-wrap:anywhere]">{step.nodeName}</span>
                <span className="text-xs font-medium text-muted-foreground">{meta.label}</span>
                <span className="text-xs text-slate-400 tabular-nums" title="Simulated time, not a real duration">{formatElapsed(step.elapsed)}</span>
                {step.viaBranch && (
                  <span className="text-xs font-semibold" style={{ color: branchColor[step.viaBranch] }}>
                    via {step.viaBranch === "yes" ? "Yes" : "No"} path
                  </span>
                )}
              </div>
              <p className={cn("mt-0.5 text-[0.8125rem] leading-relaxed [overflow-wrap:anywhere]", bad ? "font-medium text-danger" : "text-muted-foreground")}>{step.explanation}</p>
              {step.decision && <DecisionBox step={step} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The Condition's reasoning laid out: what was compared, with what, and which path was taken. */
function DecisionBox({ step }: { step: RunStep }) {
  const d = step.decision!;
  const rows: [string, string][] = [
    ["Field", d.fieldLabel],
    ["Rule", `${d.operatorLabel} ${d.expected || "(none)"}`],
    ["Sample value", d.actual ?? "(none)"],
  ];
  return (
    <div className="mt-2 rounded-xl border border-border bg-soft/60 p-3">
      <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-semibold text-navy [overflow-wrap:anywhere]">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
        <Split className="size-3.5 text-muted-foreground" aria-hidden />
        {d.branch ? (
          <>
            <span>Result: {d.result ? "true" : "false"}</span>
            <span className="rounded-full px-2 py-0.5 text-white" style={{ backgroundColor: branchColor[d.branch] }}>
              {d.branch === "yes" ? "Yes" : "No"}
            </span>
            <span className="text-muted-foreground [overflow-wrap:anywhere]">followed to {d.toName}</span>
          </>
        ) : (
          <span className={step.outcome === "blocked" ? "text-warning" : "text-danger"}>No branch chosen</span>
        )}
      </p>
    </div>
  );
}
