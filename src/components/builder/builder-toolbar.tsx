"use client";

import Link from "next/link";
import { ArrowLeft, Maximize2, Minus, Plus, Redo2, Save, Undo2 } from "lucide-react";
import { ReadinessChip } from "@/components/builder/builder-readiness";
import { StatusMark } from "@/components/common/status";
import type { Readiness } from "@/lib/readiness";
import { cn } from "@/lib/utils";

const icon =
  "inline-flex size-9 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-navy disabled:pointer-events-none disabled:opacity-35";

/** Compact toolbar: where you are, history, zoom and save. */
export function BuilderToolbar({
  backHref,
  name,
  status,
  zoom,
  canUndo,
  canRedo,
  dirty,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFit,
  onSave,
  onAdd,
  onBack,
  readiness,
  readinessOpen,
  onReadiness,
}: {
  backHref: string;
  name: string;
  status: { label: string; tone: "success" | "warning" | "neutral" };
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onSave: () => void;
  onAdd: () => void;
  readiness: Readiness;
  readinessOpen: boolean;
  onReadiness: () => void;
  /** Called on a plain click of Back, so the builder can protect unsaved work before leaving. */
  onBack: () => void;
}) {
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-white/95 px-2 backdrop-blur sm:gap-3 sm:px-4">
      <Link
        href={backHref}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          onBack();
        }}
        aria-label="Back to workflow" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2 text-[0.8125rem] font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-navy sm:px-3">
        <ArrowLeft className="size-4" />
        <span className="hidden lg:inline">Back to workflow</span>
      </Link>
      <span className="hidden h-6 w-px bg-border sm:block" />
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[0.9375rem] font-bold tracking-tight text-navy">{name}</p>
          <p className="hidden text-[11px] text-muted-foreground sm:block">Workflow builder</p>
        </div>
        <StatusMark tone={status.tone} soft className="hidden shrink-0 lg:inline-flex">{status.label}</StatusMark>
      </div>

      <div className="hidden items-center gap-0.5 rounded-xl border border-border bg-white p-0.5 shadow-card md:flex" role="group" aria-label="Zoom">
        <button type="button" onClick={onZoomOut} aria-label="Zoom out" className={icon}><Minus className="size-4" /></button>
        <span className="w-12 text-center text-[0.8125rem] font-semibold tabular-nums" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={onZoomIn} aria-label="Zoom in" className={icon}><Plus className="size-4" /></button>
        <button type="button" onClick={onFit} aria-label="Fit workflow to screen" title="Fit to screen" className={icon}><Maximize2 className="size-4" /></button>
      </div>

      <ReadinessChip readiness={readiness} open={readinessOpen} onToggle={onReadiness} />

      <button
        type="button"
        onClick={onAdd}
        aria-label="Add step"
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-brand-blue/25 bg-info-soft px-2.5 text-[0.8125rem] font-semibold text-brand-blue transition-colors hover:bg-brand-blue/15 sm:px-3.5"
      >
        <Plus className="size-4" />
        <span className="hidden lg:inline">Add step</span>
      </button>

      <div className="flex items-center gap-0.5">
        <button type="button" onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo" className={icon}><Undo2 className="size-4" /></button>
        <button type="button" onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo" className={icon}><Redo2 className="size-4" /></button>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={!dirty}
        aria-label="Save"
        className={cn("bg-brand-gradient inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[0.8125rem] font-semibold text-white shadow-card transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40 sm:px-4")}
      >
        <Save className="size-4" />
        <span className="hidden sm:inline">Save</span>
      </button>
    </header>
  );
}
