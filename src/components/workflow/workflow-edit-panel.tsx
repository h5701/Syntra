"use client";

import { useState } from "react";
import { MemberAvatar } from "@/components/common/member-avatar";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useTeam } from "@/lib/team-state";
import type { WorkflowMeta } from "@/lib/workflow-state";
import type { WorkflowStatus } from "@/lib/types";

const selectClass =
  "h-10 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

/** Edit a workflow's basic details. The stage builder is intentionally out of scope for now. */
export function WorkflowEditPanel({
  initial,
  onSave,
  onCancel,
}: {
  initial: WorkflowMeta;
  onSave: (meta: WorkflowMeta) => void;
  onCancel: () => void;
}) {
  const { members: team } = useTeam();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [ownerId, setOwnerId] = useState(initial.ownerId);
  const [status, setStatus] = useState<WorkflowStatus>(initial.status);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter a workflow name.");
      return;
    }
    onSave({ name: name.trim(), description: description.trim(), ownerId, status });
  };

  return (
    <form onSubmit={submit} noValidate className="flex h-full flex-col">
      <div
        className="px-6 pt-7 pb-5"
        style={{ backgroundImage: "radial-gradient(420px 180px at 0% 0%, rgb(37 99 255 / 0.12), transparent 70%), radial-gradient(300px 160px at 100% 0%, rgb(124 58 237 / 0.08), transparent 70%)" }}
      >
        <p className="text-xs font-medium text-muted-foreground">Workflow</p>
        <SheetTitle className="mt-2 text-2xl leading-tight font-bold tracking-tight text-navy">Edit workflow</SheetTitle>
        <SheetDescription className="mt-1.5 text-sm">Update the basic details. Changes apply to this demo session only.</SheetDescription>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 pt-2 pb-6">
        <div>
          <label htmlFor="wf-name" className="mb-1.5 block text-[0.8125rem] font-semibold text-navy">Workflow name</label>
          <Input id="wf-name" value={name} onChange={(e) => setName(e.target.value)} className="h-10 rounded-xl bg-white" aria-invalid={!!error} />
          {error && <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
        </div>
        <div>
          <label htmlFor="wf-desc" className="mb-1.5 block text-[0.8125rem] font-semibold text-navy">Description</label>
          <textarea
            id="wf-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-input bg-white px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          />
        </div>
        <div>
          <label htmlFor="wf-owner" className="mb-1.5 block text-[0.8125rem] font-semibold text-navy">Owner</label>
          <div className="flex items-center gap-3">
            <MemberAvatar id={ownerId} size="md" />
            <select id="wf-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={selectClass}>
              {team.map((m) => (
                <option key={m.id} value={m.id}>{m.name} · {m.role}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[0.8125rem] font-semibold text-navy">Status</p>
          <Segmented
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { id: "active", label: "Active" },
              { id: "paused", label: "Paused" },
              { id: "draft", label: "Draft" },
            ]}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">Paused and draft workflows don&apos;t pick up new items.</p>
        </div>
      </div>

      <div className="flex gap-2 border-t border-border bg-white px-6 py-4">
        <button type="button" onClick={onCancel} className="h-10 flex-1 rounded-xl border border-border bg-white text-sm font-semibold transition-colors hover:bg-soft sm:flex-none sm:px-5">
          Cancel
        </button>
        <button type="submit" className="bg-brand-gradient h-10 flex-1 rounded-xl text-sm font-semibold text-white shadow-card transition-opacity hover:opacity-90">
          Save changes
        </button>
      </div>
    </form>
  );
}
