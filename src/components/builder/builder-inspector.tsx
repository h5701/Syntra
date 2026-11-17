"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Clock, Trash2, X } from "lucide-react";
import { ConfigForm } from "@/components/builder/builder-config-form";
import { CollapseButton, InspectorBar } from "@/components/builder/builder-inspector-bar";
import { MemberAvatar } from "@/components/common/member-avatar";
import { StatusMark, healthTone } from "@/components/common/status";
import { healthColor, progressionColor } from "@/components/workflow/flow-colors";
import { stageIcon } from "@/components/workflow/stage-meta";
import { Input } from "@/components/ui/input";
import { branchColor } from "@/components/builder/builder-edge";
import { branches, nodeMeta, type Branch, type CanvasNode, type NodeEdit } from "@/lib/builder-nodes";
import { useTeam } from "@/lib/team-state";
import { stageStatusLabel } from "@/lib/workflow-health";
import { cn } from "@/lib/utils";

function Collapsible({ title, defaultOpen, children }: { title: string; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-border">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3 text-left text-[0.875rem] font-semibold">
        {title}
        <ChevronDown className={cn("size-4 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-border px-4 pt-4 pb-4">{children}</div>}
    </section>
  );
}

/**
 * Docked inspector for the selected step: name, description and settings for its type. Edits are
 * held as a draft owned by the builder and applied together, which gives undo one clean step per change. Floats beside
 * the canvas on larger screens and rises from the bottom on phones.
 */
export function BuilderInspector({
  node,
  index,
  total,
  paused,
  edit,
  dirty,
  errors,
  onEdit,
  onApply,
  onDiscard,
  connections,
  connectionsLocked,
  collapsed,
  ghost,
  focusConnections,
  onToggleCollapse,
  onConnect,
  onDelete,
  onClose,
}: {
  node: CanvasNode;
  index: number;
  total: number;
  paused: boolean;
  /** The values in the form: the draft if there is one, otherwise the step's applied values. */
  edit: NodeEdit;
  /** True when the form differs from what's applied to the graph. */
  dirty: boolean;
  errors: Record<string, string>;
  onEdit: (edit: NodeEdit) => void;
  onApply: () => void;
  onDiscard: () => void;
  /** Where this step's connections lead now, and where they could lead. Empty for the End. */
  connections: { branch?: Branch; to: string; targets: { id: string; name: string }[] }[];
  /** Set while an unapplied edit is pending, since connections are history changes of their own. */
  connectionsLocked: boolean;
  /** Compact title bar only, so the canvas is clear. */
  collapsed: boolean;
  /** While a connection is being dragged the panel fades and lets pointers through to the canvas. */
  ghost: boolean;
  /** Increases when the operator asks to edit this step's connections from the keyboard. */
  focusConnections: number;
  onToggleCollapse: () => void;
  /** Point a path at a step, or pass an empty string to remove it. */
  onConnect: (branch: Branch | undefined, to: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { members, byId } = useTeam();
  const { data, stage } = node;
  const meta = nodeMeta(data.type);
  const Icon = stage ? stageIcon[stage.kind] : meta.icon;
  const idle = !!stage && paused && stage.kind !== "complete";
  const flagged = !!stage && !idle && (stage.health === "attention" || stage.health === "critical");
  const accent = stage
    ? idle ? healthColor.idle : flagged ? healthColor[stage.health] : progressionColor(index / Math.max(1, total - 1))
    : meta.accent;
  const status = stage
    ? idle ? { tone: "neutral" as const, label: "Paused" } : { tone: healthTone[stage.health], label: stageStatusLabel[stage.health] }
    : node.issues.length ? { tone: "warning" as const, label: "Needs setup" } : { tone: "success" as const, label: "Ready" };

  useEffect(() => {
    if (!focusConnections || collapsed) return;
    const raf = requestAnimationFrame(() => document.querySelector<HTMLElement>('select[id^="conn-"]')?.focus());
    return () => cancelAnimationFrame(raf);
  }, [focusConnections, collapsed]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply();
  };

  if (collapsed) {
    return <InspectorBar title={data.name} kind={`${meta.label} · ${status.label}`} accent={accent} warning={dirty ? "Unapplied changes" : undefined} onExpand={onToggleCollapse} onClose={onClose} />;
  }

  return (
    <motion.aside
      key={node.id}
      aria-label={`${data.name} inspector`}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "absolute z-20 flex flex-col overflow-hidden border border-border bg-white shadow-lift transition-opacity",
        ghost && "pointer-events-none opacity-25",
        "inset-x-0 bottom-0 max-h-[68%] rounded-t-3xl md:inset-x-auto md:top-4 md:right-4 md:bottom-4 md:max-h-none md:w-[340px] md:rounded-2xl lg:w-[372px]",
      )}
    >
      <div className="relative shrink-0 px-5 pt-5 pb-4" style={{ backgroundImage: `radial-gradient(360px 150px at 0% 0%, ${accent}1f, transparent 70%)` }}>
        <CollapseButton onClick={onToggleCollapse} />
        <button type="button" onClick={onClose} aria-label="Close inspector" className="absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-navy">
          <X className="size-4" />
        </button>
        <p className="text-xs font-medium text-muted-foreground">Step {String(index + 1).padStart(2, "0")} of {String(total).padStart(2, "0")}</p>
        <div className="mt-3 flex items-center gap-3 pr-8">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}1f`, color: accent }}>
            <Icon className="size-5" strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xl leading-tight font-bold tracking-tight text-navy">{data.name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase" style={{ backgroundColor: `${accent}14`, color: accent }}>{meta.label}</span>
              <StatusMark tone={status.tone} soft>{status.label}</StatusMark>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col" onFocusCapture={(e) => (e.target as HTMLElement).scrollIntoView?.({ block: "center", behavior: "smooth" })}>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 pt-1 pb-4">
          {stage && (
            <Collapsible title="Operational data" defaultOpen>
              <dl className="grid grid-cols-2 gap-2.5">
                <div className="col-span-2 flex items-center gap-2.5 rounded-xl bg-soft p-3">
                  <MemberAvatar id={stage.ownerId} size="md" />
                  <div className="min-w-0">
                    <dt className="text-[11px] font-medium text-muted-foreground">Owner</dt>
                    <dd className="truncate text-[0.875rem] font-semibold">{byId(stage.ownerId).name}</dd>
                  </div>
                </div>
                <div className="rounded-xl bg-soft p-3">
                  <dt className="text-[11px] font-medium text-muted-foreground">Current items</dt>
                  <dd className="mt-1 text-xl leading-none font-bold tracking-tight tabular-nums">{stage.count}</dd>
                </div>
                <div className="rounded-xl bg-soft p-3">
                  <dt className="text-[11px] font-medium text-muted-foreground">Overdue items</dt>
                  <dd className={cn("mt-1 text-xl leading-none font-bold tracking-tight tabular-nums", stage.overdue ? "text-warning" : "")}>{stage.overdue ?? 0}</dd>
                </div>
                <div className="col-span-2 rounded-xl bg-soft p-3">
                  <dt className="text-[11px] font-medium text-muted-foreground">Average processing time</dt>
                  <dd className="mt-1 flex items-baseline gap-2">
                    <Clock className="size-4 self-center text-slate-400" />
                    <span className="text-xl leading-none font-bold tracking-tight tabular-nums">{stage.time}</span>
                    <span className="text-xs text-muted-foreground">{stage.timeNote}</span>
                  </dd>
                </div>
              </dl>
            </Collapsible>
          )}

          <div>
            <label htmlFor="step-name" className="mb-1.5 block text-[0.8125rem] font-semibold text-navy">Name</label>
            <Input id="step-name" value={edit.name} onChange={(e) => onEdit({ ...edit, name: e.target.value })} className="h-10 rounded-xl bg-white" aria-invalid={!!errors.name} />
            {errors.name && <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="step-desc" className="mb-1.5 block text-[0.8125rem] font-semibold text-navy">Description</label>
            <textarea
              id="step-desc"
              rows={2}
              value={edit.description}
              onChange={(e) => onEdit({ ...edit, description: e.target.value })}
              className="w-full resize-none rounded-xl border border-input bg-white px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </div>

          {connections.length > 0 && (
            <Collapsible title="Connections" defaultOpen>
              <ul className="space-y-3">
                {connections.map((c) => {
                  const b = branches.find((x) => x.id === c.branch);
                  const id = `conn-${c.branch ?? "next"}`;
                  return (
                    <li key={id}>
                      <label htmlFor={id} className="mb-1.5 flex items-center gap-2 text-[0.8125rem] font-semibold text-navy">
                        {b ? (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase" style={{ color: branchColor[b.id], backgroundColor: `${branchColor[b.id]}14` }}>{b.label}</span>
                        ) : (
                          "Next step"
                        )}
                        {b && <span className="text-xs font-normal text-muted-foreground">{b.meaning}</span>}
                      </label>
                      <select
                        id={id}
                        value={c.to}
                        disabled={connectionsLocked}
                        onChange={(e) => onConnect(c.branch, e.target.value)}
                        className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50"
                      >
                        <option value="">Not connected</option>
                        {c.targets.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                {connectionsLocked
                  ? "Apply or discard your edit before changing connections."
                  : data.type === "condition"
                    ? "Or drag from the Yes or No handle on the canvas. Branches are drawn here, not evaluated by the live workflow."
                    : "Or drag from this step's handle on the canvas. Only steps that wouldn't create a loop are listed."}
              </p>
            </Collapsible>
          )}

          <Collapsible title={`${meta.label} settings`} defaultOpen={!stage}>
            <ConfigForm type={data.type} config={edit.config} errors={errors} members={members} onChange={(patch) => onEdit({ ...edit, config: { ...edit.config, ...patch } })} />
          </Collapsible>

          {node.issues.length > 0 && (
            <div role="group" aria-label="Problems with this step" className="rounded-xl bg-warning-soft/70 px-3.5 py-3 text-xs text-warning">
              <p className="mb-1 font-semibold">Fix before simulating</p>
              <ul className="space-y-1">{node.issues.map((i) => <li key={i} className="[overflow-wrap:anywhere]">{i}</li>)}</ul>
            </div>
          )}
          {(node.warnings?.length ?? 0) > 0 && (
            <div role="group" aria-label="Warnings for this step" className="rounded-xl bg-soft px-3.5 py-3 text-xs text-muted-foreground">
              <p className="mb-1 font-semibold text-navy">Worth checking</p>
              <ul className="space-y-1">{node.warnings!.map((i) => <li key={i} className="[overflow-wrap:anywhere]">{i}</li>)}</ul>
            </div>
          )}

          <div className="border-t border-border pt-4">
            {data.custom ? (
              <button type="button" onClick={onDelete} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-danger/30 bg-white px-3 text-[0.8125rem] font-semibold text-danger transition-colors hover:bg-danger-soft">
                <Trash2 className="size-4" /> Delete step
              </button>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-navy">Original stage.</span> It carries this workflow&apos;s live items and metrics, so it can&apos;t be deleted. You can still rename and configure it.
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-white px-5 py-3.5">
          {dirty && <p className="mb-2 text-xs font-medium text-warning">You have changes that aren&apos;t applied yet.</p>}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={!dirty} className="bg-brand-gradient h-10 flex-1 rounded-xl text-sm font-semibold text-white shadow-card transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40">
              Apply changes
            </button>
            {dirty && (
              <button type="button" onClick={onDiscard} className="h-10 rounded-xl border border-border bg-white px-4 text-sm font-semibold transition-colors hover:bg-soft">
                Discard
              </button>
            )}
          </div>
        </div>
      </form>
    </motion.aside>
  );
}
