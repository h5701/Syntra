"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { cn } from "@/lib/utils";

export interface DialogAction {
  label: string;
  onClick: () => void;
  /** "primary" is the gradient action, "danger" is outlined red, "neutral" is outlined. */
  tone: "primary" | "danger" | "neutral";
}

const tones = {
  primary: "bg-brand-gradient text-white shadow-card hover:opacity-90",
  danger: "border border-danger/30 bg-white text-danger hover:bg-danger-soft",
  neutral: "border border-border bg-white text-navy hover:bg-soft",
};

/**
 * A choice that interrupts editing. Used for unsaved changes, unapplied inspector edits and
 * save problems. Actions are listed in the order they should read; the first is the safe one.
 */
export function BuilderDialog({
  open,
  title,
  description,
  items,
  issues,
  onGoToStep,
  actions,
  onDismiss,
}: {
  open: boolean;
  title: string;
  description: string;
  /** Optional list of specifics, such as the problems that block saving. */
  items?: string[];
  /** Problems that name a step. Each can take the person to it. */
  issues?: { id: string; text: string; nodeId: string | null; stepName?: string }[];
  onGoToStep?: (nodeId: string) => void;
  actions: DialogAction[];
  /** Called for Escape or an outside click. Should behave like the safe action. */
  onDismiss: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !o && onDismiss()}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-[60] bg-foreground/25 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-[60] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-white p-5 shadow-lift transition duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 sm:p-6">
          <AlertDialog.Title className="text-lg font-bold tracking-tight text-navy">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</AlertDialog.Description>
          {items && items.length > 0 && (
            <ul className="mt-4 max-h-48 space-y-1.5 overflow-y-auto rounded-xl bg-warning-soft/70 px-3.5 py-3 text-[0.8125rem] text-navy">
              {items.map((i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
                  {i}
                </li>
              ))}
            </ul>
          )}
          {issues && issues.length > 0 && (
            <ul className="mt-4 max-h-56 space-y-1.5 overflow-y-auto rounded-xl bg-warning-soft/70 px-3.5 py-3 text-[0.8125rem] text-navy">
              {issues.map((i) => (
                <li key={i.id} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {i.text}
                    {i.nodeId && onGoToStep && (
                      <>
                        {" "}
                        <button type="button" onClick={() => onGoToStep(i.nodeId!)} aria-label={`Go to ${i.stepName ?? "the step"}: ${i.text}`} className="font-semibold whitespace-nowrap text-brand-blue underline underline-offset-2 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
                          Go to step
                        </button>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            {actions.map((a) => (
              <button key={a.label} type="button" onClick={a.onClick} className={cn("h-10 rounded-xl px-4 text-sm font-semibold whitespace-nowrap transition-colors", tones[a.tone])}>
                {a.label}
              </button>
            ))}
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
