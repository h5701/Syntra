import type { Automation, AutomationRun, RunResult } from "@/lib/types";

/** Triggers an operator can choose from. `sentence` is how the trigger reads in the inspector. */
export const triggerCatalog = [
  { label: "New request received", sentence: "When a new request is received" },
  { label: "Request approved", sentence: "When a request is approved" },
  { label: "Approval exceeds expected processing time", sentence: "When an approval exceeds its expected processing time" },
  { label: "No activity for 24 hours", sentence: "When a request has had no activity for 24 hours" },
  { label: "Request reaches Complete", sentence: "When a request reaches Complete" },
  { label: "Reviewer above 90% capacity", sentence: "When a reviewer goes above 90% capacity" },
  { label: "Invoice captured", sentence: "When an invoice is captured" },
];

export const actionCatalog = [
  "Assign request to Review",
  "Notify workflow owner",
  "Notify fulfilment team",
  "Escalate request",
  "Send completion notification",
  "Reassign to available reviewer",
  "Match purchase order",
];

export const triggerSentence = (label: string) => triggerCatalog.find((t) => t.label === label)?.sentence ?? `When ${label.toLowerCase()}`;

const run = (id: string, target: string, result: RunResult, time: string, detail?: string): AutomationRun => ({ id, target, result, time, detail });

export const seedAutomations: Automation[] = [
  {
    id: "auto-routing",
    name: "New request routing",
    workflowId: "request-fulfilment",
    trigger: "New request received",
    conditions: ["Request type = Customer request", "Priority ≠ Low"],
    actions: ["Assign request to Review", "Notify workflow owner"],
    status: "active",
    lastRun: "Today, 09:41",
    successRate: 96,
    runsToday: 26,
    runs: [
      run("r1", "Request #1047", "successful", "Today, 09:41", "Assigned to Priya Raman"),
      run("r2", "Request #1042", "successful", "Today, 09:12", "Assigned to Priya Raman"),
      run("r3", "Request #1039", "failed", "Today, 08:47", "Review queue unavailable. Retried automatically."),
      run("r4", "Request #1037", "successful", "Today, 08:20", "Assigned to Priya Raman"),
    ],
  },
  {
    id: "auto-escalation",
    name: "Approval escalation",
    workflowId: "request-fulfilment",
    trigger: "Approval exceeds expected processing time",
    conditions: ["Stage = Approval", "Time in stage > 8 h"],
    actions: ["Notify workflow owner"],
    status: "active",
    lastRun: "Today, 09:05",
    successRate: 100,
    runsToday: 6,
    runs: [
      run("r1", "Request #1037", "successful", "Today, 09:05", "Hina Ahmad notified"),
      run("r2", "Request #1019", "successful", "Today, 08:30", "Hina Ahmad notified"),
      run("r3", "Request #1022", "successful", "Today, 08:30", "Hina Ahmad notified"),
      run("r4", "Request #1024", "successful", "Yesterday, 16:10", "Hina Ahmad notified"),
    ],
  },
  {
    id: "auto-fulfilment",
    name: "Fulfilment notification",
    workflowId: "request-fulfilment",
    trigger: "Request approved",
    conditions: ["Approval outcome = Approved"],
    actions: ["Notify fulfilment team"],
    status: "active",
    lastRun: "Today, 09:36",
    successRate: 99,
    runsToday: 14,
    runs: [
      run("r1", "Request #1042", "successful", "Today, 09:36", "Ana Lindqvist notified"),
      run("r2", "Request #1018", "successful", "Today, 08:47", "Ana Lindqvist notified"),
      run("r3", "Request #1015", "successful", "Today, 08:02", "Ana Lindqvist notified"),
    ],
  },
  {
    id: "auto-stale",
    name: "Stale request alert",
    workflowId: "request-fulfilment",
    trigger: "No activity for 24 hours",
    conditions: ["Stage ≠ Complete"],
    actions: ["Escalate request"],
    status: "paused",
    lastRun: "Yesterday, 17:02",
    successRate: 94,
    runsToday: 0,
    runs: [
      run("r1", "Request #1011", "successful", "Yesterday, 17:02", "Escalated to Hina Ahmad"),
      run("r2", "Request #1009", "successful", "Yesterday, 11:30", "Escalated to Hina Ahmad"),
    ],
  },
  {
    id: "auto-completion",
    name: "Completion notification",
    workflowId: "request-fulfilment",
    trigger: "Request reaches Complete",
    conditions: [],
    actions: ["Send completion notification"],
    status: "active",
    lastRun: "Today, 09:18",
    successRate: 100,
    runsToday: 12,
    runs: [
      run("r1", "Request #1029", "successful", "Today, 09:18", "Requester notified"),
      run("r2", "Request #1026", "successful", "Today, 08:40", "Requester notified"),
      run("r3", "Request #1021", "successful", "Today, 07:55", "Requester notified"),
    ],
  },
  {
    id: "auto-balance",
    name: "Reviewer load balancing",
    workflowId: "request-fulfilment",
    trigger: "Reviewer above 90% capacity",
    conditions: ["Item priority ≠ High"],
    actions: ["Reassign to available reviewer", "Notify workflow owner"],
    status: "active",
    lastRun: "Today, 07:48",
    successRate: 92,
    runsToday: 3,
    runs: [
      run("r1", "Request #1031", "successful", "Today, 07:48", "Moved from Priya Raman to Sofia Marin"),
      run("r2", "Request #1034", "failed", "Today, 07:20", "No reviewer below 90% capacity"),
      run("r3", "Request #1030", "successful", "Yesterday, 15:44", "Moved from Priya Raman to Sofia Marin"),
    ],
  },
  {
    id: "auto-invoice",
    name: "Invoice PO matching",
    workflowId: "invoice-approval",
    trigger: "Invoice captured",
    conditions: ["Invoice total > 0"],
    actions: ["Match purchase order"],
    status: "active",
    lastRun: "Today, 09:39",
    successRate: 97,
    runsToday: 52,
    runs: [
      run("r1", "INV-7731", "successful", "Today, 09:39", "Matched to PO-4410"),
      run("r2", "INV-7730", "successful", "Today, 09:31", "Matched to PO-4402"),
      run("r3", "INV-7722", "successful", "Today, 09:10", "Price variance flagged for review"),
    ],
  },
];
