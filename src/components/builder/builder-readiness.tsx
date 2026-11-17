"use client";

import { AlertTriangle, ArrowRight, CircleCheck, TriangleAlert, X } from "lucide-react";
import type { Readiness, ReadinessIssue } from "@/lib/readiness";
import { cn } from "@/lib/utils";

/** The chip in the toolbar: whether the workflow is ready to simulate, at a glance. */
export function ReadinessChip({ readiness, open, onToggle }: { readiness: Readiness; open: boolean; onToggle: () => void }) {
  const errors = readiness.errors.length;
  const warnings = readiness.warnings.length;
  const tone = errors ? "border-danger/30 bg-danger-soft text-danger" : warnings ? "border-warning/30 bg-warning-soft text-warning" : "border-success/25 bg-success-soft text-success";
  const label = errors ? `${errors} ${errors === 1 ? "issue" : "issues"}` : warnings ? `${warnings} ${warnings === 1 ? "warning" : "warnings"}` : "Ready";
  const Icon = errors ? AlertTriangle : warnings ? TriangleAlert : CircleCheck;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="builder-readiness"
      aria-label={errors ? `Readiness: ${errors} ${errors === 1 ? "issue" : "issues"} to fix before simulating` : warnings ? `Readiness: ready, with ${warnings} ${warnings === 1 ? "warning" : "warnings"}` : "Readiness: ready to simulate"}
      className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[0.8125rem] font-semibold whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none sm:px-3", tone)}
    >
      <Icon className="size-4" aria-hidden />
      {/* Below desktop width the chip shows just the count, so the workflow name keeps room in the toolbar. */}
      {errors || warnings ? <span className="lg:hidden">{errors || warnings}</span> : null}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

/** Lists what stands between the workflow and a simulation. Choosing an issue goes to its step. */
export function BuilderReadiness({
  readiness,
  nameOf,
  onGo,
  onClose,
}: {
  readiness: Readiness;
  nameOf: (id: string) => string;
  onGo: (nodeId: string) => void;
  onClose: () => void;
}) {
  const { errors, warnings, ready } = readiness;
  return (
    <section
      id="builder-readiness"
      aria-label="Workflow readiness"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className="absolute inset-x-3 top-3 z-20 flex max-h-[min(70%,32rem)] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-lift md:inset-x-auto md:left-3 md:w-[22.5rem]"
    >
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-navy">{ready ? (warnings.length ? "Ready, with warnings" : "Ready to simulate") : "Fix before simulating"}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {ready
              ? warnings.length ? "Nothing blocks a simulation. These are worth a look." : "Every step is set up and connected."
              : `${errors.length} ${errors.length === 1 ? "problem stops" : "problems stop"} a simulation from starting.`}
          </p>
        </div>
        <button type="button" autoFocus onClick={onClose} aria-label="Close readiness" className="rounded-lg p-1.5 text-muted-foreground hover:bg-soft hover:text-navy focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
          <X className="size-4" />
        </button>
      </div>
      <div className="overflow-y-auto">
        {errors.length > 0 && <IssueGroup title="Must fix" issues={errors} nameOf={nameOf} onGo={onGo} tone="error" />}
        {warnings.length > 0 && <IssueGroup title="Worth checking" issues={warnings} nameOf={nameOf} onGo={onGo} tone="warning" />}
        {ready && warnings.length === 0 && (
          <p className="flex items-center gap-2 px-4 py-4 text-[0.8125rem] text-muted-foreground"><CircleCheck className="size-4 text-success" aria-hidden /> No setup problems found.</p>
        )}
      </div>
      <p className="border-t border-border bg-soft/60 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        Saving needs a sound graph. Simulating also needs every step set up. A ready workflow can be simulated with sample data; nothing is run for real.
      </p>
    </section>
  );
}

function IssueGroup({ title, issues, nameOf, onGo, tone }: { title: string; issues: ReadinessIssue[]; nameOf: (id: string) => string; onGo: (id: string) => void; tone: "error" | "warning" }) {
  const Icon = tone === "error" ? AlertTriangle : TriangleAlert;
  return (
    <div>
      <h3 className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title} · {issues.length}</h3>
      <ul>
        {issues.map((i) => {
          const body = (
            <>
              <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "error" ? "text-danger" : "text-warning")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[0.8125rem] leading-snug font-medium text-navy [overflow-wrap:anywhere]">{i.nodeId ? i.short.replace(/\.$/, "") : i.message}</span>
                <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{i.nodeId ? nameOf(i.nodeId) : "Affects the whole workflow"}</span>
              </span>
              {i.nodeId && <ArrowRight className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />}
            </>
          );
          return (
            <li key={i.id}>
              {i.nodeId ? (
                <button type="button" onClick={() => onGo(i.nodeId!)} aria-label={`${i.short}. Go to ${nameOf(i.nodeId)}`} className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-soft focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none focus-visible:ring-inset">
                  {body}
                </button>
              ) : (
                <div className="flex items-start gap-2.5 px-4 py-2.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
