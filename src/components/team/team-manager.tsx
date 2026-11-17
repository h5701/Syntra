"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/common/section";
import { Toast } from "@/components/common/toast";
import { MemberAvatar } from "@/components/common/member-avatar";
import { Meter } from "@/components/common/meter";
import { Reveal } from "@/components/common/reveal";
import { Ring } from "@/components/common/ring";
import { StatusMark } from "@/components/common/status";
import { PageHeader } from "@/components/shell/page-header";
import { MemberPanel, type MemberDraft } from "@/components/team/member-panel";
import { ActionMenu } from "@/components/ui/action-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { currentUserId } from "@/lib/data/team";
import { useSettings } from "@/lib/settings-state";
import { useTeam } from "@/lib/team-state";
import { capacityFor, departments, hueFor, levelLabel, statuses, workloadLevel, workloadTone } from "@/lib/team-utils";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/lib/types";

const cols = "xl:grid-cols-[minmax(0,1.8fr)_1.5fr_1.1fr_1.6fr_1.1fr_0.8fr_36px]";

type Panel = { type: "add" } | { type: "edit"; id: string } | null;

export function TeamManager() {
  const { members, add, update, remove } = useTeam();
  const { update: updateSettings } = useSettings();
  const [panel, setPanel] = useState<Panel>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [dept, setDept] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const editing = panel?.type === "edit" ? members.find((m) => m.id === panel.id) : undefined;
  const removing = members.find((m) => m.id === removeId);

  const rows = useMemo(
    () =>
      members.filter(
        (m) =>
          (dept === "All" || m.department === dept) &&
          `${m.name} ${m.role} ${m.department} ${m.responsibilities.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [members, dept, query],
  );

  const deptNames = ["All", ...departments, ...members.map((m) => m.department).filter((d) => !departments.includes(d as never))].filter((d, i, a) => a.indexOf(d) === i);

  const addMember = (d: MemberDraft) => {
    const member: TeamMember = {
      id: `member-${Date.now()}`,
      name: d.name,
      email: d.email,
      role: d.role,
      department: d.department,
      status: d.status,
      capacity: capacityFor(d.workload),
      openItems: 0,
      responsibilities: [],
      hue: hueFor(d.name),
    };
    add(member);
    setPanel(null);
    setDept("All");
    setQuery("");
    setNotice(`${d.name} was added to the team.`);
  };

  const saveMember = (id: string, d: MemberDraft) => {
    const current = members.find((m) => m.id === id);
    if (!current) return;
    // The operator's name, email and role live in Settings so they can't disagree.
    if (id === currentUserId) updateSettings("profile", { name: d.name, email: d.email, role: d.role });
    update(id, {
      name: d.name,
      email: d.email,
      role: d.role,
      department: d.department,
      status: d.status,
      // Keep the exact figure unless the operator picked a different level.
      capacity: workloadLevel(current.capacity) === d.workload ? current.capacity : capacityFor(d.workload),
      responsibilities: d.responsibilities,
    });
    setPanel(null);
    setNotice(`Saved changes to ${d.name}.`);
  };

  const confirmRemove = () => {
    if (!removing) return;
    remove(removing.id);
    setNotice(`${removing.name} was removed from the team.`);
    setRemoveId(null);
  };

  const avg = members.length ? Math.round(members.reduce((n, m) => n + m.capacity, 0) / members.length) : 0;
  const atCapacity = members.filter((m) => m.status === "active" && workloadLevel(m.capacity) === "at-capacity").length;
  const items = members.reduce((n, m) => n + m.openItems, 0);
  const activeCount = members.filter((m) => m.status === "active").length;

  return (
    <>
      <PageHeader
        title="Team"
        description="Who is responsible for what across your operation, and how much each person is carrying."
        actions={
          <button
            type="button"
            onClick={() => setPanel({ type: "add" })}
            className="bg-brand-gradient inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white shadow-lift transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" /> Add person
          </button>
        }
      />

      <Reveal>
        <Card className="mb-6 flex flex-wrap items-center gap-x-10 gap-y-5 bg-gradient-to-r from-info-soft/70 via-white to-violet-50 p-5">
          <div className="flex items-center gap-4">
            <Ring value={avg} size={72} stroke={8}>
              <span className="text-sm font-bold tabular-nums">{avg}%</span>
            </Ring>
            <div>
              <p className="text-sm font-medium text-slate-600">Average workload</p>
              <p className="mt-0.5 text-xs text-muted-foreground">across {members.length} people</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Active now</p>
            <p className="mt-1 text-2xl leading-none font-bold tabular-nums">{activeCount}<span className="text-base font-semibold text-muted-foreground"> / {members.length}</span></p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Open items</p>
            <p className="mt-1 text-2xl leading-none font-bold tabular-nums">{items}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">At capacity</p>
            <p className={cn("mt-1 text-2xl leading-none font-bold tabular-nums", atCapacity > 0 && "text-danger")}>{atCapacity}</p>
          </div>
        </Card>
      </Reveal>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people, roles or duties" aria-label="Search team" className="h-10 rounded-xl bg-white pl-9 shadow-card" />
        </div>
        <div className="flex max-w-full gap-1 self-start overflow-x-auto rounded-xl border border-border bg-white p-1 shadow-card" role="tablist" aria-label="Filter by department">
          {deptNames.map((d) => {
            const active = dept === d;
            const count = d === "All" ? members.length : members.filter((m) => m.department === d).length;
            return (
              <button
                key={d}
                role="tab"
                aria-selected={active}
                onClick={() => setDept(d)}
                className={cn("shrink-0 rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors", active ? "bg-brand-gradient text-white shadow-sm" : "text-muted-foreground hover:bg-soft hover:text-navy")}
              >
                {d} <span className={cn("ml-0.5 text-xs tabular-nums", active ? "text-white/80" : "text-slate-400")}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className={cn("hidden gap-4 border-b border-border bg-soft/70 px-5 py-3 text-xs font-semibold text-muted-foreground xl:grid", cols)}>
          <span>Name</span>
          <span>Role</span>
          <span>Department</span>
          <span>Responsible for</span>
          <span>Workload</span>
          <span>Status</span>
          <span />
        </div>
        {rows.length === 0 && <p className="px-5 py-12 text-center text-sm text-muted-foreground">No team members match your filters.</p>}
        <ul className="divide-y divide-border">
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((m) => {
              const level = workloadLevel(m.capacity);
              const status = statuses.find((s) => s.id === m.status)!;
              const self = m.id === currentUserId;
              const open = () => setPanel({ type: "edit", id: m.id });
              return (
                <motion.li
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.25 }}
                >
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
                    aria-label={`Open ${m.name}`}
                    className={cn("group grid cursor-pointer grid-cols-2 items-center gap-x-4 gap-y-3 px-5 py-4 outline-none transition-colors hover:bg-info-soft/50 focus-visible:bg-info-soft/50", cols)}
                  >
                    <div className="col-span-2 flex min-w-0 items-center justify-between gap-3 xl:col-span-1">
                      <div className="flex min-w-0 items-center gap-3">
                        <MemberAvatar member={m} size="lg" />
                        <div className="min-w-0">
                          <p className="truncate text-[0.9375rem] font-semibold tracking-tight text-navy">
                            {m.name}
                            {self && <span className="ml-2 rounded-md bg-info-soft px-1.5 py-0.5 align-middle text-[10px] font-semibold text-brand-blue">You</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                        </div>
                      </div>
                      <div className="xl:hidden">
                        <ActionMenu
                          label={`Actions for ${m.name}`}
                          items={[
                            { label: "View / Edit", icon: Pencil, onSelect: open },
                            { label: "Remove", icon: Trash2, onSelect: () => setRemoveId(m.id), destructive: true, disabled: self },
                          ]}
                        />
                      </div>
                    </div>
                    <p className="min-w-0 truncate text-[0.8125rem] font-medium">{m.role}</p>
                    <p className="text-[0.8125rem] text-muted-foreground">{m.department}</p>
                    <div className="col-span-2 min-w-0 xl:col-span-1">
                      {m.responsibilities.length > 0 ? (
                        <p className="flex items-center gap-1.5 text-[0.8125rem]">
                          <span className="min-w-0 truncate">{m.responsibilities[0]}</span>
                          {m.responsibilities.length > 1 && (
                            <span className="shrink-0 rounded-md bg-soft px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">+{m.responsibilities.length - 1}</span>
                          )}
                        </p>
                      ) : (
                        <p className="text-[0.8125rem] text-muted-foreground italic">Nothing assigned yet</p>
                      )}
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <StatusMark tone={workloadTone[level]} className="text-xs">{levelLabel(level)}</StatusMark>
                        <span className="text-xs text-muted-foreground tabular-nums">{m.capacity}%</span>
                      </div>
                      <Meter value={m.capacity} tone={level === "at-capacity" ? "bad" : level === "high" ? "warn" : "brand"} />
                    </div>
                    <div><StatusMark tone={status.tone} soft>{status.label}</StatusMark></div>
                    <div className="hidden xl:block">
                      <ActionMenu
                        label={`Actions for ${m.name}`}
                        items={[
                          { label: "View / Edit", icon: Pencil, onSelect: open },
                          { label: "Remove", icon: Trash2, onSelect: () => setRemoveId(m.id), destructive: true, disabled: self },
                        ]}
                      />
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
          {panel?.type === "add" && <MemberPanel key="add" mode="add" onSave={addMember} onCancel={() => setPanel(null)} />}
          {panel?.type === "edit" && editing && (
            <MemberPanel
              key={editing.id}
              mode="edit"
              member={editing}
              isSelf={editing.id === currentUserId}
              onSave={(d) => saveMember(editing.id, d)}
              onCancel={() => setPanel(null)}
              onRemove={() => {
                setPanel(null);
                setRemoveId(editing.id);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={removeId !== null}
        onOpenChange={(o) => !o && setRemoveId(null)}
        title={`Remove ${removing?.name ?? "this person"} from the team?`}
        description={`They will lose their responsibilities${removing && removing.openItems ? ` and their ${removing.openItems} open items will need to be reassigned` : ""}. This only affects the demo workspace and can't be undone.`}
        confirmLabel="Remove person"
        onConfirm={confirmRemove}
      />

      <Toast message={notice} onDone={() => setNotice(null)} />
    </>
  );
}

