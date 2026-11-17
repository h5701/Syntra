"use client";

import { Card, CardHeader } from "@/components/common/section";
import { MemberAvatar } from "@/components/common/member-avatar";
import { Meter } from "@/components/common/meter";
import { Reveal } from "@/components/common/reveal";
import { Ring } from "@/components/common/ring";
import { StatusMark } from "@/components/common/status";
import { useTeam } from "@/lib/team-state";
import { levelLabel, workloadLevel, workloadLevels, workloadTone } from "@/lib/team-utils";
import { cn } from "@/lib/utils";

const segment = { light: "bg-success", moderate: "bg-brand-blue", high: "bg-warning", "at-capacity": "bg-danger" };

/** Is anyone overloaded? Capacity summary first, then everyone ordered by load. */
export function TeamCapacity() {
  const { members: team } = useTeam();
  const sorted = [...team].sort((a, b) => b.capacity - a.capacity);
  const avg = Math.round(team.reduce((n, m) => n + m.capacity, 0) / team.length);
  const items = team.reduce((n, m) => n + m.openItems, 0);
  const full = sorted.filter((m) => workloadLevel(m.capacity) === "at-capacity");
  const counts = workloadLevels.map((l) => ({ ...l, n: team.filter((m) => workloadLevel(m.capacity) === l.id).length }));

  return (
    <Reveal>
      <Card className="h-full pb-3">
        <CardHeader title="Team capacity" description="Workload and open items by owner" />
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4 px-5">
          <Ring value={avg} size={64} stroke={7}>
            <span className="text-[13px] font-bold tabular-nums">{avg}%</span>
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="text-[0.9375rem] font-semibold">
              {full.length === 0 ? "No one is overloaded" : full.length === 1 ? `${full[0].name} is at capacity` : `${full.length} people are at capacity`}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Average workload {avg}% · {items} open items across {team.length} people</p>
          </div>
        </div>
        <div className="mx-5 mt-4">
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
            {counts.map((c) => c.n > 0 && <span key={c.id} className={segment[c.id]} style={{ flex: c.n }} />)}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {counts.map((c) => (
              <li key={c.id} className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", segment[c.id])} />
                {c.label} <span className="font-semibold text-navy">{c.n}</span>
              </li>
            ))}
          </ul>
        </div>
        <ul className="mt-4 px-3">
          {sorted.map((m) => {
            const level = workloadLevel(m.capacity);
            return (
              <li key={m.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-soft">
                <MemberAvatar id={m.id} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[0.8125rem] font-semibold">{m.name}</p>
                    <span className="text-[0.8125rem] font-bold tabular-nums">{m.capacity}%</span>
                  </div>
                  <Meter value={m.capacity} tone={level === "at-capacity" ? "bad" : level === "high" ? "warn" : "brand"} className="mt-1.5" />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{m.openItems} open items</span>
                    <StatusMark tone={workloadTone[level]} className="text-[11px]">{levelLabel(level)}</StatusMark>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </Reveal>
  );
}
