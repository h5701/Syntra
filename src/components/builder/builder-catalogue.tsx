"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { nodeTypes, type NodeType } from "@/lib/builder-nodes";

/**
 * The step catalogue. A popover under the toolbar on larger screens, a bottom sheet on phones.
 * It says where the new step will go before you choose.
 */
export function BuilderCatalogue({
  note,
  unavailable,
  onPick,
  onClose,
}: {
  /** Where the new step will go. */
  note: string;
  /** Step types that can't be added right now, with the reason. */
  unavailable: Partial<Record<NodeType, string>>;
  onPick: (type: NodeType) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="absolute inset-0 z-20 bg-navy/5" onPointerDown={onClose} aria-hidden />
      <motion.div
        role="dialog"
        aria-label="Add a step"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 z-30 flex max-h-[78%] flex-col overflow-hidden rounded-t-3xl border border-border bg-white shadow-lift md:inset-x-auto md:top-3 md:right-4 md:bottom-auto md:max-h-[calc(100%-1.5rem)] md:w-[360px] md:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h2 className="text-base font-bold tracking-tight text-navy">Add a step</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {note}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close catalogue" className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-navy">
            <X className="size-4" />
          </button>
        </div>
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
          {nodeTypes.map((t) => {
            const reason = unavailable[t.type];
            return (
              <li key={t.type}>
                <button
                  type="button"
                  onClick={() => !reason && onPick(t.type)}
                  aria-disabled={!!reason}
                  className={`group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${reason ? "cursor-not-allowed opacity-60" : "hover:bg-soft"}`}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${t.accent}1a`, color: t.accent }}>
                    <t.icon className="size-5" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.875rem] font-semibold text-navy">{t.label}</span>
                    <span className="block text-xs leading-snug text-muted-foreground">{reason ?? t.blurb}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">Steps are simulated. Nothing connects to a live system.</p>
      </motion.div>
    </>
  );
}
