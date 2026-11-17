"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Eye, Pencil, Play, Plus, Power, Pause, Search, Trash2, Zap } from "lucide-react";
import { AutomationForm } from "@/components/automations/automation-form";
import { AutomationInspector } from "@/components/automations/automation-inspector";
import { Card } from "@/components/common/section";
import { Meter } from "@/components/common/meter";
import { Reveal } from "@/components/common/reveal";
import { StatusMark } from "@/components/common/status";
import { Toast } from "@/components/common/toast";
import { PageHeader } from "@/components/shell/page-header";
import { ActionMenu } from "@/components/ui/action-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAutomations, type AutomationDraft } from "@/lib/automation-state";
import { useWorkflows } from "@/lib/workflow-state";
import { cn } from "@/lib/utils";
import type { Automation, AutomationStatus } from "@/lib/types";

const cols = "xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_0.75fr_0.95fr_0.85fr_36px]";

const filters: { id: "all" | AutomationStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "paused", label: "Paused" },
];

type Panel = { type: "add" } | { type: "view" | "edit"; id: string } | null;

export function AutomationCenter() {
  const { automations, add, update, remove, setStatus, runNow } = useAutomations();
  const workflows = useWorkflows();
  const openParam = useSearchParams().get("open");
  // Deep link from Analytics: /automations?open=<id> opens that automation's inspector.
  const [panel, setPanel] = useState<Panel>(() => (openParam && automations.some((a) => a.id === openParam) ? { type: "view", id: openParam } : null));
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [disableId, setDisableId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | AutomationStatus>("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const workflowName = (id: string) => workflows.find((w) => w.id === id)?.name ?? "Unknown workflow";
  const byId = (id?: string | null) => automations.find((a) => a.id === id);

  // Keep the last automation mounted while the sheet closes (e.g. after a removal).
  const [lastId, setLastId] = useState<string | null>(null);
  const panelId = panel && panel.type !== "add" ? panel.id : null;
  if (panelId && panelId !== lastId) setLastId(panelId);
  const current = byId(panelId ?? lastId);

  const rows = useMemo(
    () =>
      automations.filter(
        (a) =>
          (filter === "all" || a.status === filter) &&
          `${a.name} ${a.trigger} ${a.actions.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [automations, filter, query],
  );

  // Summary
  const active = automations.filter((a) => a.status === "active");
  const runsToday = automations.reduce((n, a) => n + a.runsToday, 0);
  const weighted = active.reduce((n, a) => n + a.runsToday, 0);
  const successRate = weighted ? Math.round(active.reduce((n, a) => n + a.successRate * a.runsToday, 0) / weighted) : 0;
  const attention = automations.filter((a) => a.runs.some((r) => r.result === "failed"));

  const openRun = (a: Automation) => {
    if (runNow(a.id)) setNotice(`Automation run started (simulated): ${a.name}`);
  };

  const requestToggle = (a: Automation) => {
    if (a.status === "active") setDisableId(a.id);
    else {
      setStatus(a.id, "active");
      setNotice(`${a.name} enabled`);
    }
  };

  const save = (draft: AutomationDraft) => {
    if (panel?.type === "add") {
      const created = add(draft);
      setPanel({ type: "view", id: created.id });
      setNotice(`${draft.name} was added`);
    } else if (panel?.type === "edit") {
      update(panel.id, draft);
      setPanel({ type: "view", id: panel.id });
      setNotice(`Saved changes to ${draft.name}`);
    }
  };

  const menuItems = (a: Automation) => [
    { label: "View details", icon: Eye, onSelect: () => setPanel({ type: "view", id: a.id }) },
    { label: "Run now", icon: Play, onSelect: () => openRun(a), disabled: a.status !== "active" },
    { label: "Edit", icon: Pencil, onSelect: () => setPanel({ type: "edit", id: a.id }) },
    { label: a.status === "active" ? "Disable" : "Enable", icon: a.status === "active" ? Pause : Power, onSelect: () => requestToggle(a) },
    { label: "Remove", icon: Trash2, onSelect: () => setRemoveId(a.id), destructive: true },
  ];

  const removing = byId(removeId);
  const disabling = byId(disableId);

  const summary = [
    { label: "Active automations", value: `${active.length} of ${automations.length}`, sub: `${automations.length - active.length} paused`, icon: Zap, tint: "bg-info-soft text-brand-blue" },
    { label: "Runs today", value: String(runsToday), sub: "across all workflows", icon: Activity, tint: "bg-violet-50 text-brand-purple" },
    { label: "Success rate", value: weighted ? `${successRate}%` : "—", sub: "weighted by runs", icon: CheckCircle2, tint: "bg-success-soft text-success" },
    { label: "Needs attention", value: String(attention.length), sub: attention.length ? "have a recent failed run" : "no failed runs", icon: AlertTriangle, tint: attention.length ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground" },
  ];

  return (
    <>
      <PageHeader
        title="Automations"
        description="Workflows organise your operation. Automations make it move: when a trigger fires, Syntra runs the actions for you."
        actions={
          <button
            type="button"
            onClick={() => setPanel({ type: "add" })}
            className="bg-brand-gradient inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white shadow-lift transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" /> Add automation
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.05}>
            <Card className="flex h-full items-center gap-4 p-4">
              <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", s.tint)}>
                <s.icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <p className="mt-0.5 text-2xl leading-none font-bold tracking-tight tabular-nums">{s.value}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{s.sub}</p>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search automations" aria-label="Search automations" className="h-10 rounded-xl bg-white pl-9 shadow-card" />
        </div>
        <div className="flex gap-1 self-start rounded-xl border border-border bg-white p-1 shadow-card" role="tablist" aria-label="Filter by status">
          {filters.map((f) => {
            const count = f.id === "all" ? automations.length : automations.filter((a) => a.status === f.id).length;
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(f.id)}
                className={cn("rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors", on ? "bg-brand-gradient text-white shadow-sm" : "text-muted-foreground hover:bg-soft hover:text-navy")}
              >
                {f.label} <span className={cn("ml-0.5 text-xs tabular-nums", on ? "text-white/80" : "text-slate-400")}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className={cn("hidden gap-4 border-b border-border bg-soft/70 px-5 py-3 text-xs font-semibold text-muted-foreground xl:grid", cols)}>
          <span>Automation</span>
          <span>Trigger</span>
          <span>Action</span>
          <span>Workflow</span>
          <span>Status</span>
          <span>Last run</span>
          <span>Success rate</span>
          <span />
        </div>

        {automations.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-base font-semibold">No automations yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Add one to have Syntra move work forward when something happens in a workflow.</p>
            <button type="button" onClick={() => setPanel({ type: "add" })} className="bg-brand-gradient mt-5 inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white shadow-card">
              <Plus className="size-4" /> Add automation
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">No automations match your search.</p>
        ) : null}

        <ul className="divide-y divide-border">
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((a) => {
              const open = () => setPanel({ type: "view", id: a.id });
              const isActive = a.status === "active";
              const running = a.runs.some((r) => r.result === "running");
              return (
                <motion.li key={a.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.25 }}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        open();
                      }
                    }}
                    aria-label={`Open ${a.name}`}
                    className={cn("group grid cursor-pointer grid-cols-2 items-center gap-x-4 gap-y-3 px-5 py-4 outline-none transition-colors hover:bg-info-soft/50 focus-visible:bg-info-soft/50", cols)}
                  >
                    <div className="col-span-2 flex min-w-0 items-center justify-between gap-3 xl:col-span-1">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", isActive ? "bg-info-soft text-brand-blue" : "bg-muted text-muted-foreground")}>
                          <Zap className="size-4" />
                        </span>
                        <p className="min-w-0 text-[0.9375rem] leading-snug font-semibold tracking-tight text-navy">{a.name}</p>
                      </div>
                      <div className="xl:hidden">
                        <ActionMenu label={`Actions for ${a.name}`} items={menuItems(a)} />
                      </div>
                    </div>

                    <p className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem] xl:col-span-1 xl:block">
                      <span className="text-muted-foreground">{a.trigger}</span>
                      <ArrowRight className="size-3.5 text-slate-300 xl:hidden" />
                      <span className="font-medium xl:hidden">{a.actions[0]}</span>
                    </p>
                    <p className="hidden min-w-0 text-[0.8125rem] font-medium xl:block">
                      {a.actions[0]}
                      {a.actions.length > 1 && <span className="ml-1.5 rounded-md bg-soft px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">+{a.actions.length - 1}</span>}
                    </p>
                    <p className="col-span-2 min-w-0 text-[0.8125rem] xl:col-span-1">
                      <Link
                        href={`/workflows/${a.workflowId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-brand-blue hover:underline"
                      >
                        {workflowName(a.workflowId)}
                      </Link>
                    </p>

                    <div>
                      {running ? (
                        <StatusMark tone="info">Running</StatusMark>
                      ) : (
                        <StatusMark tone={isActive ? "success" : "warning"}>{isActive ? "Active" : "Paused"}</StatusMark>
                      )}
                    </div>
                    <p className="text-[0.8125rem] text-muted-foreground">{a.lastRun}</p>
                    <div className="col-span-2 xl:col-span-1">
                      {a.successRate > 0 ? (
                        <div className="flex items-center gap-2.5">
                          <span className="w-9 text-[0.8125rem] font-semibold tabular-nums">{a.successRate}%</span>
                          <Meter value={a.successRate} className="max-w-20" />
                        </div>
                      ) : (
                        <span className="text-[0.8125rem] text-muted-foreground">No runs yet</span>
                      )}
                    </div>
                    <div className="hidden xl:block">
                      <ActionMenu label={`Actions for ${a.name}`} items={menuItems(a)} />
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </Card>

      <Sheet open={panel !== null} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent side="right" className="gap-0 border-l border-border bg-white p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[500px]">
          {panel?.type === "add" && (
            <AutomationForm key="add" mode="add" workflows={workflows} onSave={save} onCancel={() => setPanel(null)} />
          )}
          {panel?.type === "edit" && current && (
            <AutomationForm key={`edit-${current.id}`} mode="edit" initial={current} workflows={workflows} onSave={save} onCancel={() => setPanel({ type: "view", id: current.id })} />
          )}
          {panel?.type !== "add" && panel?.type !== "edit" && current && (
            <AutomationInspector
              automation={current}
              workflowName={workflowName(current.workflowId)}
              onRun={() => openRun(current)}
              onToggle={() => requestToggle(current)}
              onEdit={() => setPanel({ type: "edit", id: current.id })}
              onRemove={() => setRemoveId(current.id)}
            />
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={disableId !== null}
        onOpenChange={(o) => !o && setDisableId(null)}
        tone="warning"
        title={`Disable ${disabling?.name ?? "this automation"}?`}
        description="It will stop running when its trigger fires until you enable it again. Work already in progress isn't affected. This is a demo action."
        confirmLabel="Disable automation"
        onConfirm={() => {
          if (!disabling) return;
          setStatus(disabling.id, "paused");
          setNotice(`${disabling.name} disabled`);
        }}
      />

      <ConfirmDialog
        open={removeId !== null}
        onOpenChange={(o) => !o && setRemoveId(null)}
        title={`Remove ${removing?.name ?? "this automation"}?`}
        description="Its trigger will stop firing and its run history will be deleted. This only affects the demo workspace and can't be undone."
        confirmLabel="Remove automation"
        onConfirm={() => {
          if (!removing) return;
          remove(removing.id);
          setPanel(null);
          setNotice(`${removing.name} was removed`);
        }}
      />

      <Toast message={notice} onDone={() => setNotice(null)} />
    </>
  );
}
