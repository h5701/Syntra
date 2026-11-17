"use client";

import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The inspector in its compact form: just a title bar. It keeps the canvas clear for
 * connecting steps while remembering what is selected. Nothing is lost by collapsing.
 */
export function InspectorBar({
  title,
  kind,
  accent,
  warning,
  onExpand,
  onClose,
}: {
  title: string;
  kind: string;
  accent: string;
  /** Shown when there is an unapplied edit, so collapsing never hides it. */
  warning?: string;
  onExpand: () => void;
  onClose: () => void;
}) {
  return (
    <motion.aside
      aria-label={`${title} inspector (collapsed)`}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn("absolute z-20 flex items-center gap-2 border border-border bg-white py-2 pr-2 pl-3.5 shadow-lift", "inset-x-3 bottom-3 rounded-2xl md:inset-x-auto md:top-4 md:right-4 md:bottom-auto md:w-[300px]")}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[0.875rem] font-bold tracking-tight text-navy">{title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{warning ?? kind}</span>
      </span>
      <button type="button" onClick={onExpand} aria-label="Expand inspector" title="Expand" className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-navy">
        <ChevronDown className="size-4" />
      </button>
      <button type="button" onClick={onClose} aria-label="Close inspector" className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-navy">
        <X className="size-4" />
      </button>
    </motion.aside>
  );
}

/** The matching button for the expanded inspector's header. */
export function CollapseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Collapse inspector" title="Collapse to reach the canvas" className="absolute top-3 right-12 inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-navy">
      <ChevronUp className="size-4" />
    </button>
  );
}
