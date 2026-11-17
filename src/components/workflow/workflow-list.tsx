"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, GitBranch, Search } from "lucide-react";
import { Card } from "@/components/common/section";
import { MemberAvatar } from "@/components/common/member-avatar";
import { Meter } from "@/components/common/meter";
import { StatusMark, workflowStatusTone } from "@/components/common/status";
import { Input } from "@/components/ui/input";
import { useTeam } from "@/lib/team-state";
import { progressionColor } from "@/components/workflow/flow-colors";
import { useWorkflows } from "@/lib/workflow-state";
import { cn } from "@/lib/utils";
import type { Workflow, WorkflowStatus } from "@/lib/types";

const filters: { id: "all" | WorkflowStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "paused", label: "Paused" },
  { id: "draft", label: "Draft" },
];

const cols = "xl:grid-cols-[minmax(0,2.3fr)_0.9fr_1.3fr_0.9fr_0.6fr_1.3fr_1fr_20px]";

const itemsIn = (w: Workflow) => w.stages.filter((s) => s.kind !== "complete").reduce((n, s) => n + s.count, 0);

export function WorkflowList() {
  const workflows = useWorkflows();
  const { byId } = useTeam();
  const [filter, setFilter] = useState<"all" | WorkflowStatus>("all");
  const [query, setQuery] = useState("");
  const rows = workflows.filter(
    (w) =>
      (filter === "all" || w.status === filter) &&
      (w.name + " " + w.description).toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workflows"
            aria-label="Search workflows"
            className="h-10 rounded-xl bg-white pl-9 shadow-card"
          />
        </div>
        <div className="flex gap-1 self-start rounded-xl border border-border bg-white p-1 shadow-card" role="tablist" aria-label="Filter by status">
          {filters.map((f) => {
            const count = f.id === "all" ? workflows.length : workflows.filter((w) => w.status === f.id).length;
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
                  active ? "bg-brand-gradient text-white shadow-sm" : "text-muted-foreground hover:bg-soft hover:text-navy",
                )}
              >
                {f.label} <span className={cn("ml-0.5 text-xs tabular-nums", active ? "text-white/80" : "text-slate-400")}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className={cn("hidden gap-4 border-b border-border bg-soft/70 px-5 py-3 text-xs font-semibold text-muted-foreground xl:grid", cols)}>
          <span>Workflow</span>
          <span>Status</span>
          <span>Owner</span>
          <span>Last run</span>
          <span className="text-right">Items</span>
          <span>Success rate</span>
          <span>Updated</span>
          <span />
        </div>
        {rows.length === 0 && <p className="px-5 py-12 text-center text-sm text-muted-foreground">No workflows match your search.</p>}
        <ul className="divide-y divide-border">
          {rows.map((w) => {
            const s = workflowStatusTone[w.status];
            const owner = byId(w.ownerId);
            const color = progressionColor(workflows.indexOf(w) / Math.max(1, workflows.length - 1));
            return (
              <li key={w.id}>
                <Link
                  href={`/workflows/${w.id}`}
                  className={cn("group grid grid-cols-2 items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-info-soft/50", cols)}
                >
                  <div className="col-span-2 flex min-w-0 items-center gap-3 xl:col-span-1">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}1a`, color }}>
                      <GitBranch className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.9375rem] font-semibold tracking-tight text-navy">{w.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{w.description}</p>
                    </div>
                  </div>
                  <div><StatusMark tone={s.tone} soft>{s.label}</StatusMark></div>
                  <div className="flex min-w-0 items-center gap-2">
                    <MemberAvatar id={owner.id} size="sm" />
                    <span className="truncate text-[0.8125rem]">{owner.name}</span>
                  </div>
                  <p className="text-[0.8125rem] text-muted-foreground">{w.lastRun}</p>
                  <p className="text-[0.9375rem] font-semibold tabular-nums xl:text-right">
                    <span className="mr-1.5 text-xs font-normal text-muted-foreground xl:hidden">Items</span>
                    {itemsIn(w)}
                  </p>
                  <div>
                    {w.successRate > 0 ? (
                      <div className="flex items-center gap-2.5">
                        <span className="w-9 text-[0.8125rem] font-semibold tabular-nums">{w.successRate}%</span>
                        <Meter value={w.successRate} className="max-w-20" />
                      </div>
                    ) : (
                      <span className="text-[0.8125rem] text-muted-foreground">No data yet</span>
                    )}
                  </div>
                  <p className="text-[0.8125rem] text-muted-foreground">{w.updated}</p>
                  <ChevronRight className="hidden size-4 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand-blue xl:block" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
