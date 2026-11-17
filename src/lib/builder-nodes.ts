import { Bell, Flag, Split, ShieldCheck, Timer, Wrench, Zap, type LucideIcon } from "lucide-react";
import type { StageKind, WorkflowStage } from "@/lib/types";

/** The kinds of step an operator can place on the canvas. */
export type NodeType = "trigger" | "action" | "condition" | "approval" | "delay" | "notification" | "end";

/** Type-specific settings. One flat shape keeps history and saving simple; each type uses its own keys. */
export interface NodeConfig {
  event?: string;
  detail?: string;
  action?: string;
  title?: string;
  field?: string;
  value?: string;
  ownerId?: string;
  message?: string;
  operator?: string;
  approverId?: string;
  instructions?: string;
  deadlineHours?: string;
  duration?: string;
  unit?: string;
  recipientType?: string;
  memberId?: string;
  outcome?: string;
  note?: string;
}

export interface BuilderNodeData {
  type: NodeType;
  name: string;
  description: string;
  config: NodeConfig;
  /** True for steps the operator added. Original stages carry live operational data and can't be deleted. */
  custom: boolean;
}

/** Which outgoing path of a Condition a connection belongs to. */
export type Branch = "yes" | "no";

export const branches: { id: Branch; label: string; meaning: string }[] = [
  { id: "yes", label: "Yes", meaning: "when the condition matches" },
  { id: "no", label: "No", meaning: "when it doesn't match" },
];

/** A connection between two steps. Its identity is independent of where the steps sit on the canvas. */
export interface BuilderEdge {
  id: string;
  from: string;
  to: string;
  /** Set only on connections leaving a Condition. */
  branch?: Branch;
  /** Optional text shown on the connection. Branches are always labelled Yes or No. */
  label?: string;
}

/** What the inspector edits: the parts of a step an operator can change. */
export interface NodeEdit {
  name: string;
  description: string;
  config: NodeConfig;
}

/** A node as drawn: its builder data plus, for original stages, the operational stage behind it. */
export interface CanvasNode {
  id: string;
  data: BuilderNodeData;
  stage?: WorkflowStage;
  /** Things that stop this step being ready, e.g. "No approver chosen". */
  issues: string[];
  /** Valid, but worth a look. They don't stop a simulation. */
  warnings?: string[];
}

export interface NodeTypeMeta {
  type: NodeType;
  label: string;
  /** Plain-English description shown in the catalogue. */
  blurb: string;
  defaultName: string;
  defaultDescription: string;
  icon: LucideIcon;
  /** Accent for added steps. Original stages keep their status colours. */
  accent: string;
}

export const nodeTypes: NodeTypeMeta[] = [
  { type: "trigger", label: "Trigger", blurb: "Starts the workflow when something happens.", defaultName: "New trigger", defaultDescription: "Starts the workflow when an event occurs.", icon: Zap, accent: "#2563ff" },
  { type: "action", label: "Action", blurb: "Does something in your operation, like creating a task.", defaultName: "New action", defaultDescription: "Performs an operational action.", icon: Wrench, accent: "#0891b2" },
  { type: "condition", label: "Condition", blurb: "Checks a rule and splits the path into Yes and No.", defaultName: "Check condition", defaultDescription: "Checks a rule and branches into Yes and No paths. Illustrative: not evaluated yet.", icon: Split, accent: "#7c3aed" },
  { type: "approval", label: "Approval", blurb: "Asks a person to approve before work continues.", defaultName: "Request approval", defaultDescription: "Requests a person's approval.", icon: ShieldCheck, accent: "#4f46e5" },
  { type: "delay", label: "Delay", blurb: "Waits for a set amount of time.", defaultName: "Wait", defaultDescription: "Waits for a specified duration.", icon: Timer, accent: "#64748b" },
  { type: "notification", label: "Notification", blurb: "Sends a message to someone (simulated).", defaultName: "Send notification", defaultDescription: "Sends a simulated notification.", icon: Bell, accent: "#0ea5e9" },
  { type: "end", label: "End", blurb: "Marks where a path of the workflow finishes.", defaultName: "End workflow", defaultDescription: "Marks the end of a workflow path.", icon: Flag, accent: "#1e2a5a" },
];

export const nodeMeta = (type: NodeType) => nodeTypes.find((t) => t.type === type)!;

/** Original stages map onto the same vocabulary as added steps. */
export const typeForKind: Record<StageKind, NodeType> = {
  intake: "trigger",
  review: "action",
  approval: "approval",
  fulfilment: "action",
  complete: "end",
};

/* ---- Option lists (configuration examples; nothing here connects to a real system) ---- */

export const triggerEvents = [
  { id: "new-request", label: "New request received", detailLabel: "Request type", placeholder: "Customer request" },
  { id: "form-submitted", label: "Form submitted", detailLabel: "Form name", placeholder: "Service request form" },
  { id: "schedule", label: "Schedule reached", detailLabel: "Schedule", placeholder: "Every weekday at 09:00" },
  { id: "record-updated", label: "Record updated", detailLabel: "Field watched", placeholder: "Priority" },
];

export const actionKinds = [
  { id: "create-task", label: "Create task" },
  { id: "update-record", label: "Update record" },
  { id: "assign-owner", label: "Assign owner" },
  { id: "send-message", label: "Send internal message" },
];

export const conditionFields = [
  { id: "priority", label: "Request priority", example: "High" },
  { id: "status", label: "Request status", example: "Approved" },
  { id: "type", label: "Request type", example: "Customer request" },
  { id: "value", label: "Request value", example: "10000" },
];

export const conditionOperators = [
  { id: "equals", label: "equals" },
  { id: "not-equals", label: "does not equal" },
  { id: "greater-than", label: "is greater than" },
  { id: "less-than", label: "is less than" },
  { id: "contains", label: "contains" },
];

export const delayUnits = [
  { id: "minutes", label: "Minutes" },
  { id: "hours", label: "Hours" },
  { id: "days", label: "Days" },
];

export const recipientTypes = [
  { id: "owner", label: "Workflow owner" },
  { id: "member", label: "A team member" },
  { id: "team", label: "Whole team" },
  { id: "requester", label: "The requester" },
];

const labelOf = (list: { id: string; label: string }[], id?: string) => list.find((x) => x.id === id)?.label ?? id ?? "";

export function defaultConfig(type: NodeType): NodeConfig {
  switch (type) {
    case "trigger": return { event: "new-request", detail: "" };
    case "action": return { action: "create-task", title: "", field: "Priority", value: "", ownerId: "", message: "" };
    case "condition": return { field: "priority", operator: "equals", value: "" };
    case "approval": return { approverId: "", instructions: "", deadlineHours: "" };
    case "delay": return { duration: "1", unit: "hours" };
    case "notification": return { recipientType: "owner", memberId: "", message: "" };
    case "end": return { outcome: "Completed", note: "" };
  }
}

export function newNodeData(type: NodeType): BuilderNodeData {
  const meta = nodeMeta(type);
  return { type, name: meta.defaultName, description: meta.defaultDescription, config: defaultConfig(type), custom: true };
}

/** Builder data for an original stage, so every node can be inspected the same way. */
export function seedNodeData(stage: WorkflowStage): BuilderNodeData {
  const type = typeForKind[stage.kind];
  const config = defaultConfig(type);
  if (type === "trigger") config.detail = "Customer request";
  if (type === "approval") config.approverId = stage.ownerId;
  if (stage.kind === "review") Object.assign(config, { action: "assign-owner", ownerId: stage.ownerId });
  if (stage.kind === "fulfilment") Object.assign(config, { action: "create-task", title: "Prepare and deliver the request" });
  return { type, name: stage.name, description: stage.description, config, custom: false };
}

/** Blocking problems. These stop a change being applied. */
export function validate(data: Pick<BuilderNodeData, "type" | "name" | "config">): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.name.trim()) errors.name = "A step needs a name.";
  const c = data.config;
  if (data.type === "delay") {
    const n = Number(c.duration);
    if (!c.duration?.trim() || !Number.isFinite(n) || n <= 0) errors.duration = "Enter a duration greater than zero.";
  }
  if (data.type === "approval" && c.deadlineHours?.trim()) {
    const n = Number(c.deadlineHours);
    if (!Number.isFinite(n) || n <= 0) errors.deadlineHours = "Enter a number of hours greater than zero, or leave it blank.";
  }
  return errors;
}

/** One line describing what the step is set to do. */
export function summarise(data: Pick<BuilderNodeData, "type" | "config">, nameOf: (id: string) => string | undefined): string {
  const c = data.config;
  switch (data.type) {
    case "trigger": return `${labelOf(triggerEvents, c.event)}${c.detail?.trim() ? `: ${c.detail.trim()}` : ""}`;
    case "action": {
      const base = labelOf(actionKinds, c.action);
      if (c.action === "create-task") return c.title?.trim() ? `${base}: ${c.title.trim()}` : base;
      if (c.action === "update-record") return c.value?.trim() ? `${base}: ${c.field} = ${c.value.trim()}` : base;
      if (c.action === "assign-owner") return c.ownerId ? `${base}: ${nameOf(c.ownerId) ?? "unknown"}` : base;
      return c.message?.trim() ? `${base}: ${c.message.trim()}` : base;
    }
    case "condition": return `${labelOf(conditionFields, c.field)} ${labelOf(conditionOperators, c.operator)} ${c.value?.trim() || "…"}`;
    case "approval": return c.approverId && nameOf(c.approverId) ? `Approver: ${nameOf(c.approverId)}` : "No approver chosen";
    case "delay": {
      const unit = (c.unit ?? "hours").toLowerCase();
      return `Wait ${c.duration || "?"} ${Number(c.duration) === 1 ? unit.replace(/s$/, "") : unit}`;
    }
    case "notification": {
      const who = c.recipientType === "member" ? nameOf(c.memberId ?? "") ?? "a team member" : labelOf(recipientTypes, c.recipientType);
      return `To ${who}`;
    }
    case "end": return c.outcome?.trim() || "No outcome named";
  }
}
