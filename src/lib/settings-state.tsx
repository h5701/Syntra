"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { DateFormat } from "@/lib/format";

/**
 * Session-only demo settings. They survive navigation inside the app and reset on a
 * full refresh. Nothing is persisted and there is no account behind any of this.
 */

export interface Settings {
  workspace: { name: string; description: string; timezone: string; dateFormat: DateFormat };
  profile: { name: string; email: string; role: string };
  notifications: { workflowAlerts: boolean; automationFailures: boolean; bottleneckAlerts: boolean; teamUpdates: boolean };
  defaults: { ownerId: string; status: "active" | "draft"; alertsEnabled: boolean; thresholdHours: 4 | 8 | 24 };
  appearance: { theme: "light" };
}

export const initialSettings: Settings = {
  workspace: {
    name: "Syntra Operations",
    description: "Visual operations and workflow automation.",
    timezone: "Europe/London",
    dateFormat: "dd-mmm-yyyy",
  },
  profile: { name: "Hina Ahmad", email: "hina@example.test", role: "Operator" },
  notifications: { workflowAlerts: true, automationFailures: true, bottleneckAlerts: true, teamUpdates: false },
  defaults: { ownerId: "hina", status: "active", alertsEnabled: true, thresholdHours: 8 },
  appearance: { theme: "light" },
};

interface Store {
  settings: Settings;
  update: <K extends keyof Settings>(section: K, patch: Partial<Settings[K]>) => void;
}

const SettingsContext = createContext<Store | null>(null);

export function SettingsStateProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState(initialSettings);
  const update = useCallback<Store["update"]>((section, patch) => {
    setSettings((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
  }, []);
  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const store = useContext(SettingsContext);
  if (!store) throw new Error("useSettings must be used inside <SettingsStateProvider>.");
  return store;
}
