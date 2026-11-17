"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Centered confirmation for destructive actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  tone = "danger",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  tone?: "danger" | "warning";
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-[60] bg-foreground/20 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-white p-6 shadow-lift transition duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <span className={tone === "danger" ? "flex size-11 items-center justify-center rounded-xl bg-danger-soft text-danger" : "flex size-11 items-center justify-center rounded-xl bg-warning-soft text-warning"}>
            <TriangleAlert className="size-5" />
          </span>
          <AlertDialog.Title className="mt-4 text-lg font-semibold tracking-tight text-navy">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</AlertDialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Close render={<Button variant="outline" className="h-10 rounded-xl px-4" />}>Cancel</AlertDialog.Close>
            <Button
              className={tone === "danger" ? "h-10 rounded-xl bg-danger px-4 text-white hover:bg-danger/90" : "h-10 rounded-xl bg-warning px-4 text-white hover:bg-warning/90"}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
