import type { MemberStatus, WorkloadLevel } from "@/lib/types";

export const departments = ["Operations", "Finance", "Customer Support", "Fulfilment"] as const;

export const roleSuggestions = [
  "Operations Manager",
  "Workflow Specialist",
  "Customer Success",
  "Finance",
  "Administrator",
];

export const workloadLevels: { id: WorkloadLevel; label: string; capacity: number }[] = [
  { id: "light", label: "Light", capacity: 35 },
  { id: "moderate", label: "Moderate", capacity: 62 },
  { id: "high", label: "High", capacity: 82 },
  { id: "at-capacity", label: "At capacity", capacity: 96 },
];

export const statuses: { id: MemberStatus; label: string; tone: "success" | "warning" | "neutral" }[] = [
  { id: "active", label: "Active", tone: "success" },
  { id: "away", label: "Away", tone: "warning" },
  { id: "inactive", label: "Inactive", tone: "neutral" },
];

export function workloadLevel(capacity: number): WorkloadLevel {
  if (capacity >= 90) return "at-capacity";
  if (capacity >= 75) return "high";
  if (capacity >= 50) return "moderate";
  return "light";
}

export const workloadTone: Record<WorkloadLevel, "success" | "info" | "warning" | "danger"> = {
  light: "success",
  moderate: "info",
  high: "warning",
  "at-capacity": "danger",
};

export const levelLabel = (l: WorkloadLevel) => workloadLevels.find((w) => w.id === l)!.label;
export const capacityFor = (l: WorkloadLevel) => workloadLevels.find((w) => w.id === l)!.capacity;

/** Stable colour for a person, derived from their name. */
export function hueFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
