export type Health = "healthy" | "attention" | "critical" | "idle" | "done";

export type StageKind = "intake" | "review" | "approval" | "fulfilment" | "complete";

export type MemberStatus = "active" | "away" | "inactive";
export type WorkloadLevel = "light" | "moderate" | "high" | "at-capacity";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: string;
  status: MemberStatus;
  email: string;
  capacity: number; // percent of capacity in use
  openItems: number;
  responsibilities: string[];
  hue: number;
}

export interface StageItem {
  id: string;
  title: string;
  assigneeId: string;
  age: string;
  priority: "high" | "medium" | "low";
  /** Short status, e.g. "waiting for review". */
  state?: string;
}

export interface ActivityEntry {
  id: string;
  text: string;
  actorId?: string;
  time: string;
}

export interface StageMetric {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}

export interface WorkflowStage {
  id: string;
  name: string;
  kind: StageKind;
  description: string;
  health: Health;
  statusLabel: string;
  count: number;
  countLabel: string;
  ownerId: string;
  sla: number;
  /** Items that have exceeded their expected processing time. */
  overdue?: number;
  /** Typical time a unit of work spends in this stage. */
  time: string;
  timeNote: string;
  metrics: StageMetric[];
  items: StageItem[];
  activity: ActivityEntry[];
  /** Items that moved on to the next stage today. */
  movedToday?: number;
}

export type WorkflowStatus = "active" | "paused" | "draft";

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  ownerId: string;
  lastRun: string;
  updated: string;
  successRate: number;
  avgCycle: string;
  runsPerWeek: number;
  stages: WorkflowStage[];
  /** Set on workflows created in this session. Its stages follow the builder graph, and nothing has run. */
  origin?: { templateId: string | null; templateName: string };
}

export type ProcessHealth = "on-track" | "at-risk" | "delayed" | "blocked";

export interface OperationalProcess {
  id: string;
  name: string;
  workflowId: string;
  ownerId: string;
  health: ProcessHealth;
  currentStage: string;
  progress: number;
  /** ISO calendar date (YYYY-MM-DD). */
  dueDate: string;
  note: string;
}

export type AutomationStatus = "active" | "paused";
export type RunResult = "successful" | "failed" | "running";

export interface AutomationRun {
  id: string;
  /** What the run acted on, e.g. "Request #1047". */
  target: string;
  result: RunResult;
  time: string;
  detail?: string;
}

export interface Automation {
  id: string;
  name: string;
  workflowId: string;
  /** Trigger label, from the trigger catalogue. */
  trigger: string;
  conditions: string[];
  /** Ordered actions. The first is the primary action. */
  actions: string[];
  status: AutomationStatus;
  lastRun: string;
  successRate: number;
  runsToday: number;
  runs: AutomationRun[];
}

export interface ActivityFeedItem {
  id: string;
  text: string;
  target: string;
  actorId: string;
  time: string;
  tone: "good" | "warn" | "bad" | "neutral";
}

export interface WorkflowEvent {
  id: string;
  text: string;
  /** Team member id. Omitted for automation/system events. */
  actorId?: string;
  stageId?: string;
  time: string;
  tone: "good" | "warn" | "bad" | "neutral";
}
