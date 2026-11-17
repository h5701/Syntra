import { cn } from "@/lib/utils";
import type { Health, ProcessHealth, WorkflowStatus } from "@/lib/types";

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const toneClasses: Record<Tone, { text: string; dot: string; soft: string }> = {
  success: { text: "text-success", dot: "bg-success", soft: "bg-success-soft" },
  warning: { text: "text-warning", dot: "bg-warning", soft: "bg-warning-soft" },
  danger: { text: "text-danger", dot: "bg-danger", soft: "bg-danger-soft" },
  neutral: { text: "text-muted-foreground", dot: "bg-slate-400", soft: "bg-muted" },
  info: { text: "text-brand-blue", dot: "bg-brand-blue", soft: "bg-info-soft" },
};

/** Status as a coloured dot and label. `soft` adds a tinted chip. */
export function StatusMark({
  tone,
  children,
  soft,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  soft?: boolean;
  className?: string;
}) {
  const t = toneClasses[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[0.8125rem] font-medium whitespace-nowrap",
        t.text,
        soft && cn("rounded-full px-2.5 py-1 text-xs", t.soft),
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", t.dot)} />
      {children}
    </span>
  );
}

export const healthTone: Record<Health, Tone> = {
  healthy: "success",
  attention: "warning",
  critical: "danger",
  idle: "neutral",
  done: "info",
};

export const processTone: Record<ProcessHealth, { tone: Tone; label: string }> = {
  "on-track": { tone: "success", label: "On track" },
  "at-risk": { tone: "warning", label: "At risk" },
  delayed: { tone: "danger", label: "Delayed" },
  blocked: { tone: "danger", label: "Blocked" },
};

export const workflowStatusTone: Record<WorkflowStatus, { tone: Tone; label: string }> = {
  active: { tone: "success", label: "Active" },
  paused: { tone: "warning", label: "Paused" },
  draft: { tone: "neutral", label: "Draft" },
};

export const toneText: Record<"good" | "warn" | "bad" | "neutral", string> = {
  good: "text-success",
  warn: "text-warning",
  bad: "text-danger",
  neutral: "text-muted-foreground",
};
