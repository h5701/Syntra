import type {
  ActivityFeedItem,
  OperationalProcess,
} from "@/lib/types";

export const processes: OperationalProcess[] = [
  { id: "p1", name: "Cloud infrastructure commitment", workflowId: "request-fulfilment", ownerId: "tomas", health: "blocked", currentStage: "Approval", progress: 55, dueDate: "2026-10-06", note: "Waiting on second approver for 26 h" },
  { id: "p2", name: "Data-retention exception", workflowId: "request-fulfilment", ownerId: "priya", health: "at-risk", currentStage: "Review", progress: 38, dueDate: "2026-10-07", note: "Review target exceeded by 2 h" },
  { id: "p3", name: "INV-7701 — Halden Packaging", workflowId: "invoice-approval", ownerId: "tomas", health: "delayed", currentStage: "Approval", progress: 62, dueDate: "2026-10-05", note: "Approval 18 h overdue" },
  { id: "p4", name: "Laptop kits — new starters", workflowId: "employee-onboarding", ownerId: "jonah", health: "at-risk", currentStage: "Equipment Kit", progress: 70, dueDate: "2026-10-12", note: "Supplier delay of 1 day" },
  { id: "p5", name: "Vendor onboarding — Corvus Analytics", workflowId: "vendor-onboarding", ownerId: "sofia", health: "on-track", currentStage: "Due Diligence", progress: 44, dueDate: "2026-10-14", note: "Security questionnaire returned" },
  { id: "p6", name: "Standing desks — Berlin office", workflowId: "request-fulfilment", ownerId: "ana", health: "on-track", currentStage: "Fulfilment", progress: 84, dueDate: "2026-10-08", note: "Delivery slot confirmed" },
  { id: "p7", name: "Contractor access extension", workflowId: "request-fulfilment", ownerId: "priya", health: "at-risk", currentStage: "Review", progress: 41, dueDate: "2026-10-07", note: "High priority — reviewer at capacity" },
  { id: "p8", name: "Friday payment run", workflowId: "invoice-approval", ownerId: "tomas", health: "on-track", currentStage: "Payment Run", progress: 90, dueDate: "2026-10-09", note: "8 invoices scheduled" },
  { id: "p9", name: "Vendor onboarding — Brightline Logistics", workflowId: "vendor-onboarding", ownerId: "tomas", health: "on-track", currentStage: "Contracting", progress: 72, dueDate: "2026-10-12", note: "Redlines agreed" },
  { id: "p10", name: "Day-one setup — Support Team Lead", workflowId: "employee-onboarding", ownerId: "ana", health: "on-track", currentStage: "Day One", progress: 92, dueDate: "2026-10-12", note: "Buddy assigned" },
];

export const recentActivity: ActivityFeedItem[] = [
  { id: "f1", text: "escalated", target: "4 overdue approvals to management", actorId: "hina", time: "9 min ago", tone: "warn" },
  { id: "f2", text: "dispatched", target: "Request #1012 equipment kits", actorId: "jonah", time: "35 min ago", tone: "good" },
  { id: "f3", text: "approved", target: "Request #1018 — Annual software renewal", actorId: "tomas", time: "47 min ago", tone: "good" },
  { id: "f4", text: "paused", target: "Incident Escalation workflow", actorId: "kenji", time: "Yesterday", tone: "neutral" },
  { id: "f5", text: "flagged an SLA breach on", target: "Request #1028 — Data-retention exception", actorId: "sofia", time: "22 min ago", tone: "bad" },
  { id: "f6", text: "updated", target: "Balance reviewer load rule", actorId: "kenji", time: "3 h ago", tone: "neutral" },
];

export const kpis = {
  activeWorkflows: { value: 4, delta: "+1 this week", trend: [3, 3, 3, 4, 4, 4, 4] },
  atRisk: { value: 3, delta: "1 fewer than yesterday", trend: [6, 5, 5, 4, 5, 4, 3] },
  awaitingAction: { value: 11, delta: "4 fewer than last week", trend: [19, 18, 16, 15, 14, 12, 11] },
  onTrack: { value: 97.8, delta: "+1.8 pts", trend: [92, 93, 94, 95, 96, 97, 97.8] },
};
