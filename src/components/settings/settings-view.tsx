"use client";

import { useState } from "react";
import { Bell, Building2, Info, Palette, Sliders, UserRound, type LucideIcon } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Card } from "@/components/common/section";
import { Toast } from "@/components/common/toast";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { useTeam } from "@/lib/team-state";
import { dateFormats, formatDate, type DateFormat } from "@/lib/format";
import { useSettings, type Settings } from "@/lib/settings-state";
import { roleSuggestions } from "@/lib/team-utils";
import { cn } from "@/lib/utils";

const sections: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "profile", label: "Operator profile", icon: UserRound },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "defaults", label: "Workflow defaults", icon: Sliders },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "about", label: "About", icon: Info },
];

const timezones = ["Europe/London", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Dubai", "Asia/Singapore"];

const selectClass =
  "h-10 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50";

function Group({ id, title, description, icon: Icon, children }: { id: string; title: string; description: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <Card as="section" className="scroll-mt-24 p-5 sm:p-6">
      <div id={id} className="scroll-mt-24" />
      <div className="flex items-start gap-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-brand-blue">
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-4 divide-y divide-border border-t border-border">{children}</div>
    </Card>
  );
}

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor?: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 py-4 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-start sm:gap-6">
      <label htmlFor={htmlFor} className="pt-2 text-[0.875rem] font-medium">{label}</label>
      <div className="min-w-0 max-w-md">
        {children}
        {error && <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
        {!error && hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function ToggleRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <p className="text-[0.875rem] font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}

function SaveBar({ dirty, onDiscard }: { dirty: boolean; onDiscard: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-4">
      <button
        type="submit"
        disabled={!dirty}
        className="bg-brand-gradient h-10 rounded-xl px-5 text-sm font-semibold text-white shadow-card transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
      >
        Save changes
      </button>
      <button type="button" onClick={onDiscard} disabled={!dirty} className="h-10 rounded-xl border border-border bg-white px-4 text-sm font-semibold transition-colors hover:bg-soft disabled:pointer-events-none disabled:opacity-40">
        Discard
      </button>
      <span className={cn("text-xs text-muted-foreground transition-opacity", dirty ? "opacity-100" : "opacity-0")} aria-live="polite">Unsaved changes</span>
    </div>
  );
}

function WorkspaceSection({ onSaved }: { onSaved: (m: string) => void }) {
  const { settings, update } = useSettings();
  const saved = settings.workspace;
  const [draft, setDraft] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    if (!draft.name.trim()) {
      setError("Enter a workspace name.");
      return;
    }
    const next = { ...draft, name: draft.name.trim(), description: draft.description.trim() };
    update("workspace", next);
    setDraft(next);
    setError(null);
    onSaved("Workspace settings saved");
  };

  return (
    <Group id="workspace" title="Workspace" description="Basic details about your Syntra workspace." icon={Building2}>
      <form onSubmit={save} noValidate>
        <Field label="Workspace name" htmlFor="ws-name" error={error ?? undefined}>
          <Input id="ws-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-10 rounded-xl bg-white" aria-invalid={!!error} />
        </Field>
        <Field label="Description" htmlFor="ws-desc">
          <textarea
            id="ws-desc"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={2}
            className="w-full resize-none rounded-xl border border-input bg-white px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          />
        </Field>
        <Field label="Timezone" htmlFor="ws-tz">
          <select id="ws-tz" value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })} className={selectClass}>
            {timezones.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Date format" htmlFor="ws-date" hint={`Example: ${formatDate("2026-10-06", draft.dateFormat)}. Used for due dates across Syntra.`}>
          <select id="ws-date" value={draft.dateFormat} onChange={(e) => setDraft({ ...draft, dateFormat: e.target.value as DateFormat })} className={selectClass}>
            {dateFormats.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </Field>
        <div className="border-t border-border"><SaveBar dirty={dirty} onDiscard={() => { setDraft(saved); setError(null); }} /></div>
      </form>
    </Group>
  );
}

function ProfileSection({ onSaved }: { onSaved: (m: string) => void }) {
  const { settings, update } = useSettings();
  const saved = settings.profile;
  const [draft, setDraft] = useState(saved);
  const [errors, setErrors] = useState<Partial<Record<"name" | "email" | "role", string>>>({});
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    const next: typeof errors = {};
    if (!draft.name.trim()) next.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) next.email = "Enter a valid email address.";
    if (!draft.role.trim()) next.role = "Enter a role.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const clean = { name: draft.name.trim(), email: draft.email.trim(), role: draft.role.trim() };
    update("profile", clean);
    setDraft(clean);
    onSaved("Operator profile saved");
  };

  return (
    <Group id="profile" title="Operator profile" description="The person managing this workspace. Demo values only: there are no accounts or sign-in." icon={UserRound}>
      <form onSubmit={save} noValidate>
        <Field label="Name" htmlFor="op-name" error={errors.name}>
          <Input id="op-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-10 rounded-xl bg-white" aria-invalid={!!errors.name} />
        </Field>
        <Field label="Email" htmlFor="op-email" error={errors.email}>
          <Input id="op-email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="h-10 rounded-xl bg-white" aria-invalid={!!errors.email} />
        </Field>
        <Field label="Role" htmlFor="op-role" error={errors.role}>
          <Input id="op-role" list="operator-roles" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} className="h-10 rounded-xl bg-white" aria-invalid={!!errors.role} />
          <datalist id="operator-roles">
            {["Operator", ...roleSuggestions].map((r) => <option key={r} value={r} />)}
          </datalist>
        </Field>
        <div className="border-t border-border"><SaveBar dirty={dirty} onDiscard={() => { setDraft(saved); setErrors({}); }} /></div>
      </form>
    </Group>
  );
}

export function SettingsView() {
  const { settings, update } = useSettings();
  const { members: team } = useTeam();
  const [notice, setNotice] = useState<string | null>(null);
  const n = settings.notifications;
  const d = settings.defaults;

  const toggle = (key: keyof Settings["notifications"], label: string) => (v: boolean) => {
    update("notifications", { [key]: v });
    setNotice(`${label} ${v ? "on" : "off"}`);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-8 lg:flex-col lg:self-start">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap text-slate-600 transition-colors hover:bg-white hover:text-navy hover:shadow-card">
            <s.icon className="size-4 text-slate-400" />
            {s.label}
          </a>
        ))}
      </nav>

      <div className="min-w-0 space-y-6">
        <WorkspaceSection onSaved={setNotice} />
        <ProfileSection onSaved={setNotice} />

        <Group id="notifications" title="Notifications" description="Choose what Syntra tells you about. Changes apply immediately." icon={Bell}>
          <ToggleRow title="Workflow alerts" description="Receive notifications when workflows require attention." checked={n.workflowAlerts} onChange={toggle("workflowAlerts", "Workflow alerts")} />
          <ToggleRow title="Automation failures" description="Notify when an automation fails." checked={n.automationFailures} onChange={toggle("automationFailures", "Automation failure alerts")} />
          <ToggleRow title="Bottleneck alerts" description="Notify when work exceeds expected processing time." checked={n.bottleneckAlerts} onChange={toggle("bottleneckAlerts", "Bottleneck alerts")} />
          <ToggleRow title="Team updates" description="Notify when team responsibilities or workload assignments change." checked={n.teamUpdates} onChange={toggle("teamUpdates", "Team updates")} />
        </Group>

        <Group id="defaults" title="Workflow defaults" description="How new workflows start out. Demo preferences only." icon={Sliders}>
          <Field label="Default workflow owner" htmlFor="df-owner">
            <select
              id="df-owner"
              value={d.ownerId}
              onChange={(e) => {
                update("defaults", { ownerId: e.target.value });
                setNotice("Default owner updated");
              }}
              className={selectClass}
            >
              {team.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
            </select>
          </Field>
          <Field label="Default workflow status">
            <Segmented
              label="Default workflow status"
              value={d.status}
              onChange={(v) => {
                update("defaults", { status: v });
                setNotice(`New workflows will start as ${v === "active" ? "Active" : "Draft"}`);
              }}
              options={[{ id: "active", label: "Active" }, { id: "draft", label: "Draft" }]}
            />
          </Field>
          <ToggleRow
            title="Processing-time alerts"
            description="Alert the owner when an item stays in a stage longer than the threshold."
            checked={d.alertsEnabled}
            onChange={(v) => {
              update("defaults", { alertsEnabled: v });
              setNotice(`Processing-time alerts ${v ? "on" : "off"}`);
            }}
          />
          <Field label="Alert threshold" hint={d.alertsEnabled ? undefined : "Turn on processing-time alerts to set a threshold."}>
            <div className={cn(!d.alertsEnabled && "pointer-events-none opacity-50")} aria-disabled={!d.alertsEnabled}>
              <Segmented
                label="Alert threshold"
                value={String(d.thresholdHours) as "4" | "8" | "24"}
                onChange={(v) => {
                  update("defaults", { thresholdHours: Number(v) as 4 | 8 | 24 });
                  setNotice(`Alert threshold set to ${v} hours`);
                }}
                options={[{ id: "4", label: "4 hours" }, { id: "8", label: "8 hours" }, { id: "24", label: "24 hours" }]}
              />
            </div>
          </Field>
        </Group>

        <Group id="appearance" title="Appearance" description="Syntra's light interface is part of its identity." icon={Palette}>
          <Field label="Theme" hint="Dark mode isn't part of this concept.">
            <Segmented label="Theme" value="light" onChange={() => undefined} options={[{ id: "light", label: "Light" }]} />
          </Field>
        </Group>

        <Group id="about" title="About Syntra" description="Product information." icon={Info}>
          <div className="flex items-center gap-4 py-5">
            <LogoMark className="size-12" />
            <div>
              <p className="text-lg font-bold tracking-tight text-navy">Syntra</p>
              <p className="text-sm text-muted-foreground">Connect the work. Automate the process.</p>
            </div>
          </div>
          <dl className="grid gap-x-6 gap-y-4 py-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Version</dt>
              <dd className="mt-1 text-[0.875rem] font-semibold">Version 1.0 Concept</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Product concept by</dt>
              <dd className="mt-1 text-[0.875rem] font-semibold">NexOra Digital Studio</dd>
            </div>
          </dl>
          <div className="py-5">
            <p className="rounded-xl bg-info-soft/70 px-4 py-3 text-[0.8125rem] leading-relaxed">
              <span className="font-semibold text-brand-blue">Demo environment.</span> All data shown in this environment is fictional and used for demonstration purposes. Syntra is a product concept, not a live service.
            </p>
          </div>
        </Group>
      </div>

      <Toast message={notice} onDone={() => setNotice(null)} />
    </div>
  );
}
