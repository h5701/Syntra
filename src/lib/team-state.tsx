"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { currentUserId, team as seedTeam } from "@/lib/data/team";
import { useSettings } from "@/lib/settings-state";
import type { TeamMember } from "@/lib/types";

/**
 * Session-only team roster. People added, edited or removed on the Team page are
 * visible everywhere that looks people up. The operator's name, email and role
 * always come from Settings, so there is one source of truth for them.
 */

interface Store {
  members: TeamMember[];
  /** Resolves a member by id. Falls back to the seed roster for people who have since been removed. */
  byId: (id: string) => TeamMember;
  add: (member: TeamMember) => void;
  update: (id: string, patch: Partial<TeamMember>) => void;
  remove: (id: string) => void;
}

const TeamContext = createContext<Store | null>(null);

export function TeamStateProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const [members, setMembers] = useState(seedTeam);
  const { name, email, role } = settings.profile;

  const resolved = useMemo(
    () => members.map((m) => (m.id === currentUserId ? { ...m, name, email, role } : m)),
    [members, name, email, role],
  );

  const byId = useCallback(
    (id: string) => resolved.find((m) => m.id === id) ?? seedTeam.find((m) => m.id === id) ?? resolved[0],
    [resolved],
  );
  const add = useCallback((member: TeamMember) => setMembers((prev) => [...prev, member]), []);
  const update = useCallback((id: string, patch: Partial<TeamMember>) => setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m))), []);
  const remove = useCallback((id: string) => setMembers((prev) => prev.filter((m) => m.id !== id)), []);

  const value = useMemo(() => ({ members: resolved, byId, add, update, remove }), [resolved, byId, add, update, remove]);
  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  const store = useContext(TeamContext);
  if (!store) throw new Error("useTeam must be used inside <TeamStateProvider>.");
  return store;
}
