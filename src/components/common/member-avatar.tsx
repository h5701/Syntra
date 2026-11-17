"use client";

import { cn } from "@/lib/utils";
import { initials } from "@/lib/data/team";
import { useTeam } from "@/lib/team-state";
import type { TeamMember } from "@/lib/types";

export function MemberAvatar({
  id,
  member,
  size = "md",
  className,
}: {
  id?: string;
  /** Pass a member directly for people who aren't in the seed data. */
  member?: Pick<TeamMember, "name" | "hue">;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const { byId } = useTeam();
  const m = member ?? byId(id ?? "");
  const sizes = {
    xs: "size-5 text-[9px]",
    sm: "size-7 text-[10px]",
    md: "size-8 text-xs",
    lg: "size-10 text-sm",
    xl: "size-14 text-lg",
  };
  return (
    <span
      title={m.name}
      aria-label={m.name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white select-none", sizes[size], className)}
      style={{ backgroundImage: `linear-gradient(140deg, hsl(${m.hue} 78% 58%), hsl(${(m.hue + 35) % 360} 72% 46%))` }}
    >
      {initials(m.name)}
    </span>
  );
}
