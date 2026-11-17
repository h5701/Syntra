"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { actionCatalog, triggerCatalog } from "@/lib/data/automations";
import type { AutomationDraft } from "@/lib/automation-state";
import type { Automation, AutomationStatus } from "@/lib/types";

const selectClass =
  "h-10 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor?: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[0.8125rem] font-semibold text-navy">{label}</label>
      {children}
      {error && <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
      {!error && hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Create or edit an automation. A rule builder comes later; this covers the basics. */
export function AutomationForm({
  mode,
  initial,
  workflows,
  onSave,
  onCancel,
}: {
  mode: "add" | "edit";
  initial?: Automation;
  workflows: { id: string; name: string }[];
  onSave: (draft: AutomationDraft) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [workflowId, setWorkflowId] = useState(initial?.workflowId ?? workflows[0]?.id ?? "");
  const [trigger, setTrigger] = useState(initial?.trigger ?? triggerCatalog[0].label);
  const [action, setAction] = useState(initial?.actions[0] ?? actionCatalog[0]);
  const [status, setStatus] = useState<AutomationStatus>(initial?.status ?? "active");
  const [error, setError] = useState<string | null>(null);

  const triggers = triggerCatalog.some((t) => t.label === trigger) ? triggerCatalog.map((t) => t.label) : [trigger, ...triggerCatalog.map((t) => t.label)];
  const actionsList = actionCatalog.includes(action) ? actionCatalog : [action, ...actionCatalog];
  const extra = initial?.actions.slice(1) ?? [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter an automation name.");
      return;
    }
    onSave({ name: name.trim(), workflowId, trigger, action, status });
  };

  return (
    <form onSubmit={submit} noValidate className="flex h-full flex-col">
      <div
        className="px-6 pt-7 pb-5"
        style={{ backgroundImage: "radial-gradient(420px 180px at 0% 0%, rgb(37 99 255 / 0.12), transparent 70%), radial-gradient(300px 160px at 100% 0%, rgb(124 58 237 / 0.08), transparent 70%)" }}
      >
        <p className="text-xs font-medium text-muted-foreground">Automation</p>
        <SheetTitle className="mt-2 text-2xl leading-tight font-bold tracking-tight text-navy">
          {mode === "add" ? "Add automation" : "Edit automation"}
        </SheetTitle>
        <SheetDescription className="mt-1.5 text-sm">
          {mode === "add" ? "Choose when it runs and what it does. Runs are simulated in this demo." : "Changes apply to this demo session only."}
        </SheetDescription>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 pt-2 pb-6">
        <Field label="Automation name" htmlFor="auto-name" error={error ?? undefined}>
          <Input id="auto-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priority request alert" className="h-10 rounded-xl bg-white" aria-invalid={!!error} />
        </Field>
        <Field label="Workflow" htmlFor="auto-workflow">
          <select id="auto-workflow" value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} className={selectClass}>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Trigger" htmlFor="auto-trigger" hint="When this happens…">
          <select id="auto-trigger" value={trigger} onChange={(e) => setTrigger(e.target.value)} className={selectClass}>
            {triggers.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Action" htmlFor="auto-action" hint={extra.length ? `…do this first. Also runs: ${extra.join(", ")}.` : "…do this."}>
          <select id="auto-action" value={action} onChange={(e) => setAction(e.target.value)} className={selectClass}>
            {actionsList.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <Segmented label="Status" value={status} onChange={setStatus} options={[{ id: "active", label: "Active" }, { id: "paused", label: "Paused" }]} />
        </Field>
      </div>

      <div className="flex gap-2 border-t border-border bg-white px-6 py-4">
        <button type="button" onClick={onCancel} className="h-10 flex-1 rounded-xl border border-border bg-white text-sm font-semibold transition-colors hover:bg-soft sm:flex-none sm:px-5">
          Cancel
        </button>
        <button type="submit" className="bg-brand-gradient h-10 flex-1 rounded-xl text-sm font-semibold text-white shadow-card transition-opacity hover:opacity-90">
          {mode === "add" ? "Add automation" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
