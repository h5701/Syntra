"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Trash2, X } from "lucide-react";
import { branchColor } from "@/components/builder/builder-edge";
import { CollapseButton, InspectorBar } from "@/components/builder/builder-inspector-bar";
import { Input } from "@/components/ui/input";
import { branches, type BuilderEdge, type BuilderNodeData } from "@/lib/builder-nodes";
import { cn } from "@/lib/utils";

/**
 * Inspector for a selected connection: where it leaves from, where it goes, and its label.
 * Changing the destination, editing the label and deleting are each one undoable change.
 */
export function BuilderEdgeInspector({
  edge,
  from,
  to,
  targets,
  locked,
  collapsed,
  ghost,
  onToggleCollapse,
  onRetarget,
  onLabel,
  onDelete,
  onClose,
}: {
  edge: BuilderEdge;
  from: BuilderNodeData;
  to: BuilderNodeData;
  targets: { id: string; name: string }[];
  /** True while an unapplied step edit is pending. */
  locked: boolean;
  collapsed: boolean;
  ghost: boolean;
  onToggleCollapse: () => void;
  onRetarget: (to: string) => void;
  onLabel: (label: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const branch = branches.find((b) => b.id === edge.branch);
  const accent = branch ? branchColor[branch.id] : "#2563ff";
  const [label, setLabel] = useState(edge.label ?? "");
  const [syncKey, setSyncKey] = useState(`${edge.id}:${edge.label ?? ""}`);
  if (syncKey !== `${edge.id}:${edge.label ?? ""}`) {
    setSyncKey(`${edge.id}:${edge.label ?? ""}`);
    setLabel(edge.label ?? "");
  }
  const commitLabel = () => {
    if (label.trim() !== (edge.label ?? "")) onLabel(label);
  };

  if (collapsed) {
    return <InspectorBar title={`${from.name} → ${to.name}`} kind={branch ? `${branch.label} path` : "Connection"} accent={accent} onExpand={onToggleCollapse} onClose={onClose} />;
  }

  return (
    <motion.aside
      key={edge.id}
      aria-label="Connection inspector"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "absolute z-20 flex flex-col overflow-hidden border border-border bg-white shadow-lift transition-opacity",
        ghost && "pointer-events-none opacity-25",
        "inset-x-0 bottom-0 max-h-[68%] rounded-t-3xl md:inset-x-auto md:top-4 md:right-4 md:bottom-auto md:max-h-[calc(100%-2rem)] md:w-[340px] md:rounded-2xl lg:w-[372px]",
      )}
    >
      <div className="relative shrink-0 px-5 pt-5 pb-4" style={{ backgroundImage: `radial-gradient(360px 150px at 0% 0%, ${accent}1f, transparent 70%)` }}>
        <CollapseButton onClick={onToggleCollapse} />
        <button type="button" onClick={onClose} aria-label="Close inspector" className="absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-navy">
          <X className="size-4" />
        </button>
        <p className="text-xs font-medium text-muted-foreground">Connection</p>
        <h2 className="mt-2 pr-8 text-lg leading-snug font-bold tracking-tight text-navy">
          {from.name} <span className="text-slate-400">→</span> {to.name}
        </h2>
        <div className="mt-2">
          {branch ? (
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase" style={{ color: accent, backgroundColor: `${accent}14` }}>
              {branch.label} path
            </span>
          ) : (
            <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-brand-blue uppercase">Next step</span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-1 pb-5">
        <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
          {branch
            ? `Followed ${branch.meaning}. This is how the branch is drawn: Syntra doesn't evaluate the condition yet.`
            : `After "${from.name}" finishes, the workflow continues to "${to.name}".`}
        </p>

        <div>
          <label htmlFor="edge-target" className="mb-1.5 block text-[0.8125rem] font-semibold text-navy">Goes to</label>
          <select
            id="edge-target"
            value={edge.to}
            disabled={locked}
            onChange={(e) => onRetarget(e.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50"
          >
            {targets.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted-foreground">{locked ? "Apply or discard your step edit first." : "Only steps that wouldn't create a loop are listed."}</p>
        </div>

        {!branch && (
          <div>
            <label htmlFor="edge-label" className="mb-1.5 block text-[0.8125rem] font-semibold text-navy">Label (optional)</label>
            <Input
              id="edge-label"
              value={label}
              maxLength={24}
              disabled={locked}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitLabel();
                  e.currentTarget.blur();
                }
              }}
              placeholder="e.g. Standard"
              className="h-10 rounded-xl bg-white"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">Shown on the connection. Press Enter to apply.</p>
          </div>
        )}

        <div className="border-t border-border pt-4">
          <button type="button" onClick={onDelete} disabled={locked} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-danger/30 bg-white px-3 text-[0.8125rem] font-semibold text-danger transition-colors hover:bg-danger-soft disabled:pointer-events-none disabled:opacity-50">
            <Trash2 className="size-4" /> Delete connection
          </button>
          <p className="mt-2 text-xs text-muted-foreground">The step it leaves will need a new way forward. Saving is blocked until it has one.</p>
        </div>
      </div>
    </motion.aside>
  );
}
