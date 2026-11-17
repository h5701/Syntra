"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { MemberAvatar } from "@/components/common/member-avatar";
import { StatusMark } from "@/components/common/status";
import { ResponsibilitiesEditor, newResponsibility, type ResponsibilityDraft } from "@/components/team/responsibilities-editor";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { capacityFor, departments, hueFor, levelLabel, roleSuggestions, statuses, workloadLevel, workloadLevels } from "@/lib/team-utils";
import type { MemberStatus, TeamMember, WorkloadLevel } from "@/lib/types";

export interface MemberDraft {
  name: string;
  email: string;
  role: string;
  department: string;
  status: MemberStatus;
  workload: WorkloadLevel;
  responsibilities: string[];
}

function Field({ label, error, children, htmlFor }: { label: string; error?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[0.8125rem] font-semibold text-navy">
        {label}
      </label>
      {children}
      {error && <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

const selectClass =
  "h-10 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

/** Side panel to add a person or view/edit an existing one. Edits are held as a draft until saved. */
export function MemberPanel({
  mode,
  member,
  isSelf,
  onSave,
  onCancel,
  onRemove,
}: {
  mode: "add" | "edit";
  member?: TeamMember;
  isSelf?: boolean;
  onSave: (draft: MemberDraft) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [role, setRole] = useState(member?.role ?? "");
  const [department, setDepartment] = useState<string>(member?.department ?? "");
  const [status, setStatus] = useState<MemberStatus>(member?.status ?? "active");
  const [workload, setWorkload] = useState<WorkloadLevel>(member ? workloadLevel(member.capacity) : "light");
  const [duties, setDuties] = useState<ResponsibilityDraft[]>(() => (member?.responsibilities ?? []).map(newResponsibility));
  const [errors, setErrors] = useState<Partial<Record<"name" | "email" | "role" | "department", string>>>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = "Enter a full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Enter a valid email address.";
    if (!role.trim()) e.role = "Enter a role or job title.";
    if (!department) e.department = "Choose a department.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    onSave({
      name: name.trim(),
      email: email.trim(),
      role: role.trim(),
      department,
      status,
      workload,
      responsibilities: duties.map((d) => d.text.trim()).filter(Boolean),
    });
  };

  const preview = { name: name.trim() || "New member", hue: member?.hue ?? hueFor(name || "New") };

  return (
    <form onSubmit={submit} noValidate className="flex h-full flex-col">
      <div
        className="px-6 pt-7 pb-5"
        style={{ backgroundImage: "radial-gradient(420px 180px at 0% 0%, rgb(37 99 255 / 0.12), transparent 70%), radial-gradient(300px 160px at 100% 0%, rgb(124 58 237 / 0.08), transparent 70%)" }}
      >
        <p className="text-xs font-medium text-muted-foreground">{mode === "add" ? "Team" : "Team member"}</p>
        <div className="mt-3 flex items-center gap-4">
          <MemberAvatar member={preview} size="xl" />
          <div className="min-w-0">
            <SheetTitle className="text-2xl leading-tight font-bold tracking-tight text-navy">
              {mode === "add" ? "Add person" : member?.name}
            </SheetTitle>
            <SheetDescription className="mt-1 text-sm">
              {mode === "add" ? "Invite someone to your Syntra workspace (demo)." : `${member?.role} · ${member?.department}`}
            </SheetDescription>
            {mode === "edit" && (
              <div className="mt-2">
                <StatusMark tone={statuses.find((s) => s.id === status)!.tone} soft>{statuses.find((s) => s.id === status)!.label}</StatusMark>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 pt-2 pb-6">
        <Field label="Full name" error={errors.name} htmlFor="member-name">
          <Input id="member-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amira Hassan" className="h-10 rounded-xl bg-white" aria-invalid={!!errors.name} />
        </Field>
        <Field label="Email" error={errors.email} htmlFor="member-email">
          <Input id="member-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="h-10 rounded-xl bg-white" aria-invalid={!!errors.email} />
        </Field>
        <div className="grid gap-5">
          <Field label="Role / job title" error={errors.role} htmlFor="member-role">
            <Input id="member-role" list="role-suggestions" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Operations Manager" className="h-10 rounded-xl bg-white" aria-invalid={!!errors.role} />
            <datalist id="role-suggestions">
              {roleSuggestions.map((r) => <option key={r} value={r} />)}
            </datalist>
          </Field>
          <Field label="Department" error={errors.department} htmlFor="member-department">
            <select id="member-department" value={department} onChange={(e) => setDepartment(e.target.value)} className={selectClass} aria-invalid={!!errors.department}>
              <option value="" disabled>Select department</option>
              {[...new Set([...departments, ...(member && !departments.includes(member.department as never) ? [member.department] : [])])].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Status">
          <Segmented label="Status" value={status} onChange={setStatus} options={statuses.map((s) => ({ id: s.id, label: s.label }))} />
        </Field>

        {mode === "edit" && (
          <>
            <Field label="Workload / capacity">
              <Segmented label="Workload" value={workload} onChange={setWorkload} options={workloadLevels.map((w) => ({ id: w.id, label: w.label }))} />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {levelLabel(workload)} · about {capacityFor(workload)}% of capacity. {member?.openItems} open items currently assigned.
              </p>
            </Field>
            <div className="border-t border-border pt-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-navy">Responsibilities</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">What this person owns across your workflows.</p>
              </div>
              <ResponsibilitiesEditor items={duties} onChange={setDuties} />
            </div>
            {onRemove && !isSelf && (
              <div className="border-t border-border pt-5">
                <button type="button" onClick={onRemove} className="inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-danger hover:underline">
                  <Trash2 className="size-4" /> Remove from team
                </button>
              </div>
            )}
            {isSelf && <p className="border-t border-border pt-5 text-xs text-muted-foreground">You&apos;re the operator of this workspace, so you can&apos;t remove yourself.</p>}
          </>
        )}
        {mode === "add" && <p className="text-xs text-muted-foreground">You can set workload and responsibilities after adding them.</p>}
      </div>

      <div className="flex gap-2 border-t border-border bg-white px-6 py-4">
        <button type="button" onClick={onCancel} className="h-10 flex-1 rounded-xl border border-border bg-white text-sm font-semibold transition-colors hover:bg-soft sm:flex-none sm:px-5">
          Cancel
        </button>
        <button type="submit" className="bg-brand-gradient h-10 flex-1 rounded-xl text-sm font-semibold text-white shadow-card transition-opacity hover:opacity-90">
          {mode === "add" ? "Add person" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
