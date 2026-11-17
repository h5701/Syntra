"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { nowStamp } from "@/lib/data/workflow-events";
import { seedAutomations } from "@/lib/data/automations";
import type { Automation, AutomationRun, AutomationStatus } from "@/lib/types";

/**
 * Session-only demo state for automations. Starts from the seed data, survives
 * navigation inside the app, and resets on a full refresh. Nothing is persisted
 * and nothing really executes: "runs" are simulated.
 */

export interface AutomationDraft {
  name: string;
  workflowId: string;
  trigger: string;
  action: string;
  status: AutomationStatus;
}

interface Store {
  automations: Automation[];
  add: (draft: AutomationDraft) => Automation;
  update: (id: string, draft: AutomationDraft) => void;
  remove: (id: string) => void;
  setStatus: (id: string, status: AutomationStatus) => void;
  /** Starts a simulated run. Returns false if the automation can't run right now. */
  runNow: (id: string) => boolean;
}

const AutomationStateContext = createContext<Store | null>(null);

let idSeq = 0;
let targetSeq = 1048;

export function AutomationStateProvider({ children }: { children: React.ReactNode }) {
  const [automations, setAutomations] = useState<Automation[]>(seedAutomations);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Mirrors state so event handlers can check it without waiting for a re-render.
  const latest = useRef(automations);
  useEffect(() => {
    latest.current = automations;
  }, [automations]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const change = useCallback((id: string, fn: (a: Automation) => Automation) => {
    setAutomations((prev) => prev.map((a) => (a.id === id ? fn(a) : a)));
  }, []);

  const add = useCallback((draft: AutomationDraft) => {
    const created: Automation = {
      id: `auto-new-${idSeq++}`,
      name: draft.name,
      workflowId: draft.workflowId,
      trigger: draft.trigger,
      conditions: [],
      actions: [draft.action],
      status: draft.status,
      lastRun: "Never run",
      successRate: 0,
      runsToday: 0,
      runs: [],
    };
    setAutomations((prev) => [created, ...prev]);
    return created;
  }, []);

  const update = useCallback(
    (id: string, draft: AutomationDraft) =>
      change(id, (a) => ({
        ...a,
        name: draft.name,
        workflowId: draft.workflowId,
        trigger: draft.trigger,
        status: draft.status,
        actions: [draft.action, ...a.actions.slice(1)],
      })),
    [change],
  );

  const remove = useCallback((id: string) => setAutomations((prev) => prev.filter((a) => a.id !== id)), []);
  const setStatus = useCallback((id: string, status: AutomationStatus) => change(id, (a) => ({ ...a, status })), [change]);

  const runNow = useCallback(
    (id: string) => {
      const current = latest.current.find((a) => a.id === id);
      if (!current || current.status !== "active" || current.runs.some((r) => r.result === "running")) return false;
      const started: AutomationRun = {
        id: `run-${idSeq++}`,
        target: `Request #${targetSeq++}`,
        result: "running",
        time: nowStamp(),
        detail: "Simulated run in progress",
      };
      change(id, (a) => ({ ...a, lastRun: started.time, runsToday: a.runsToday + 1, runs: [started, ...a.runs] }));
      timers.current.push(
        setTimeout(() => {
          change(id, (a) => ({
            ...a,
            // A first successful run gives a new automation its initial success rate.
            successRate: a.successRate || 100,
            runs: a.runs.map((r) => (r.id === started.id ? { ...r, result: "successful", detail: "Completed (simulated)" } : r)),
          }));
        }, 1600),
      );
      return true;
    },
    [change],
  );

  const value = useMemo(() => ({ automations, add, update, remove, setStatus, runNow }), [automations, add, update, remove, setStatus, runNow]);
  return <AutomationStateContext.Provider value={value}>{children}</AutomationStateContext.Provider>;
}

export function useAutomations() {
  const store = useContext(AutomationStateContext);
  if (!store) throw new Error("useAutomations must be used inside <AutomationStateProvider>.");
  return store;
}
