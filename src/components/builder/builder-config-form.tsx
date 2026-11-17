"use client";

import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  actionKinds,
  conditionFields,
  conditionOperators,
  delayUnits,
  recipientTypes,
  triggerEvents,
  type NodeConfig,
  type NodeType,
} from "@/lib/builder-nodes";
import type { TeamMember } from "@/lib/types";

const selectClass =
  "h-10 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";
const textareaClass =
  "w-full resize-none rounded-xl border border-input bg-white px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[0.8125rem] font-semibold text-navy">{label}</label>
      {children}
      {error ? <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{error}</p> : hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function MemberSelect({ id, value, onChange, members, placeholder }: { id: string; value: string; onChange: (v: string) => void; members: TeamMember[]; placeholder: string }) {
  if (members.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
        There are no team members yet. <Link href="/team" className="font-semibold text-brand-blue hover:underline">Add people on the Team page</Link>, then come back to choose one.
      </p>
    );
  }
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      <option value="">{placeholder}</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>{m.name} · {m.role}</option>
      ))}
    </select>
  );
}

/** Settings for one step type. All of it is demo configuration: nothing here connects to a live system. */
export function ConfigForm({
  type,
  config,
  errors,
  members,
  onChange,
}: {
  type: NodeType;
  config: NodeConfig;
  errors: Record<string, string>;
  members: TeamMember[];
  onChange: (patch: NodeConfig) => void;
}) {
  const c = config;
  switch (type) {
    case "trigger": {
      const ev = triggerEvents.find((e) => e.id === c.event) ?? triggerEvents[0];
      return (
        <div className="space-y-4">
          <Field id="cfg-event" label="When this happens" hint="Examples only. Triggers aren't connected to live systems.">
            <select id="cfg-event" value={c.event} onChange={(e) => onChange({ event: e.target.value })} className={selectClass}>
              {triggerEvents.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </Field>
          <Field id="cfg-detail" label={ev.detailLabel}>
            <Input id="cfg-detail" value={c.detail ?? ""} onChange={(e) => onChange({ detail: e.target.value })} placeholder={ev.placeholder} className="h-10 rounded-xl bg-white" />
          </Field>
        </div>
      );
    }
    case "action":
      return (
        <div className="space-y-4">
          <Field id="cfg-action" label="Action" hint="A simulated action. Nothing runs outside this demo.">
            <select id="cfg-action" value={c.action} onChange={(e) => onChange({ action: e.target.value })} className={selectClass}>
              {actionKinds.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </Field>
          {c.action === "create-task" && (
            <Field id="cfg-title" label="Task title">
              <Input id="cfg-title" value={c.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} placeholder="Prepare the request" className="h-10 rounded-xl bg-white" />
            </Field>
          )}
          {c.action === "update-record" && (
            <div className="grid grid-cols-2 gap-3">
              <Field id="cfg-field" label="Field">
                <select id="cfg-field" value={c.field} onChange={(e) => onChange({ field: e.target.value })} className={selectClass}>
                  {["Priority", "Status", "Owner", "Due date"].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field id="cfg-value" label="New value">
                <Input id="cfg-value" value={c.value ?? ""} onChange={(e) => onChange({ value: e.target.value })} placeholder="High" className="h-10 rounded-xl bg-white" />
              </Field>
            </div>
          )}
          {c.action === "assign-owner" && (
            <Field id="cfg-owner" label="Assign to">
              <MemberSelect id="cfg-owner" value={c.ownerId ?? ""} onChange={(v) => onChange({ ownerId: v })} members={members} placeholder="Choose an owner" />
            </Field>
          )}
          {c.action === "send-message" && (
            <Field id="cfg-message" label="Message">
              <textarea id="cfg-message" rows={3} value={c.message ?? ""} onChange={(e) => onChange({ message: e.target.value })} placeholder="A new request needs your attention." className={textareaClass} />
            </Field>
          )}
        </div>
      );
    case "condition": {
      const field = conditionFields.find((f) => f.id === c.field) ?? conditionFields[0];
      return (
        <div className="space-y-4">
          <Field id="cfg-cfield" label="Field">
            <select id="cfg-cfield" value={c.field} onChange={(e) => onChange({ field: e.target.value })} className={selectClass}>
              {conditionFields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="cfg-op" label="Operator">
              <select id="cfg-op" value={c.operator} onChange={(e) => onChange({ operator: e.target.value })} className={selectClass}>
                {conditionOperators.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </Field>
            <Field id="cfg-cvalue" label="Value">
              <Input id="cfg-cvalue" value={c.value ?? ""} onChange={(e) => onChange({ value: e.target.value })} placeholder={field.example} className="h-10 rounded-xl bg-white" />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">The rule is stored and shown here. Its Yes and No paths are drawn on the canvas, but Syntra doesn&apos;t evaluate the rule yet.</p>
        </div>
      );
    }
    case "approval":
      return (
        <div className="space-y-4">
          <Field id="cfg-approver" label="Approver">
            <MemberSelect id="cfg-approver" value={c.approverId ?? ""} onChange={(v) => onChange({ approverId: v })} members={members} placeholder="Choose an approver" />
          </Field>
          <Field id="cfg-instructions" label="Instructions">
            <textarea id="cfg-instructions" rows={3} value={c.instructions ?? ""} onChange={(e) => onChange({ instructions: e.target.value })} placeholder="What should the approver check?" className={textareaClass} />
          </Field>
          <Field id="cfg-deadline" label="Deadline (hours, optional)" error={errors.deadlineHours}>
            <Input id="cfg-deadline" inputMode="decimal" value={c.deadlineHours ?? ""} onChange={(e) => onChange({ deadlineHours: e.target.value })} placeholder="e.g. 24" className="h-10 rounded-xl bg-white" aria-invalid={!!errors.deadlineHours} />
          </Field>
        </div>
      );
    case "delay":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field id="cfg-duration" label="Duration" error={errors.duration}>
            <Input id="cfg-duration" inputMode="decimal" value={c.duration ?? ""} onChange={(e) => onChange({ duration: e.target.value })} className="h-10 rounded-xl bg-white" aria-invalid={!!errors.duration} />
          </Field>
          <Field id="cfg-unit" label="Unit">
            <select id="cfg-unit" value={c.unit} onChange={(e) => onChange({ unit: e.target.value })} className={selectClass}>
              {delayUnits.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </Field>
        </div>
      );
    case "notification":
      return (
        <div className="space-y-4">
          <Field id="cfg-rtype" label="Send to" hint="Simulated. No message is ever sent.">
            <select id="cfg-rtype" value={c.recipientType} onChange={(e) => onChange({ recipientType: e.target.value })} className={selectClass}>
              {recipientTypes.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
          {c.recipientType === "member" && (
            <Field id="cfg-member" label="Team member">
              <MemberSelect id="cfg-member" value={c.memberId ?? ""} onChange={(v) => onChange({ memberId: v })} members={members} placeholder="Choose a recipient" />
            </Field>
          )}
          <Field id="cfg-nmessage" label="Message">
            <textarea id="cfg-nmessage" rows={3} value={c.message ?? ""} onChange={(e) => onChange({ message: e.target.value })} placeholder="Your request has moved to the next step." className={textareaClass} />
          </Field>
        </div>
      );
    case "end":
      return (
        <div className="space-y-4">
          <p className="rounded-xl bg-soft px-3 py-2.5 text-xs text-muted-foreground">This marks where a path of the workflow finishes. Nothing continues after it.</p>
          <Field id="cfg-outcome" label="Outcome name">
            <Input id="cfg-outcome" value={c.outcome ?? ""} onChange={(e) => onChange({ outcome: e.target.value })} placeholder="Completed" className="h-10 rounded-xl bg-white" />
          </Field>
          <Field id="cfg-note" label="Completion description (optional)">
            <textarea id="cfg-note" rows={2} value={c.note ?? ""} onChange={(e) => onChange({ note: e.target.value })} className={textareaClass} />
          </Field>
        </div>
      );
  }
}
