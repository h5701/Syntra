"use client";

import { useTeam } from "@/lib/team-state";

/** A team member's current name. Follows edits made on the Team and Settings pages. */
export function MemberName({ id, first }: { id: string; first?: boolean }) {
  const { byId } = useTeam();
  const name = byId(id).name;
  return <>{first ? name.split(" ")[0] : name}</>;
}
