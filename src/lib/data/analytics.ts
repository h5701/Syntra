import { DEMO_TODAY } from "@/lib/format";

/**
 * Fictional analytics for the Syntra concept. Each time range is a predefined
 * dataset, not a calculation over real events.
 */

export type Range = "7d" | "30d" | "90d";

export const ranges: { id: Range; label: string; long: string }[] = [
  { id: "7d", label: "7 days", long: "last 7 days" },
  { id: "30d", label: "30 days", long: "last 30 days" },
  { id: "90d", label: "90 days", long: "last 90 days" },
];

export const formatDuration = (min: number) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m`;

// Deterministic pseudo-random numbers, so server and client render the same chart.
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateBack(daysBack: number) {
  const [y, m, d] = DEMO_TODAY.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - daysBack));
}
const short = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;

export interface TrendPoint {
  label: string;
  title: string;
  value: number;
  secondary: number;
}

/** Realistic volume: quieter weekends, a few spikes, gentle growth, scaled to hit `total` exactly. */
function buildSeries(points: number, stepDays: number, total: number, successRate: number, seed: number): TrendPoint[] {
  const rand = rng(seed);
  const dates = Array.from({ length: points }, (_, i) => dateBack((points - 1 - i) * stepDays));
  const weights = dates.map((d, i) => {
    const weekend = stepDays === 1 && (d.getUTCDay() === 0 || d.getUTCDay() === 6) ? 0.3 : 1;
    const growth = 0.92 + (0.16 * i) / (points - 1);
    const spike = rand() > 0.88 ? 1.28 : 1;
    return weekend * growth * spike * (0.8 + rand() * 0.4);
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  const values = weights.map((w) => Math.round((w / sum) * total));
  const diff = total - values.reduce((a, b) => a + b, 0);
  values[values.indexOf(Math.max(...values))] += diff;
  return dates.map((d, i) => ({
    label: short(d),
    title: stepDays === 1 ? `${DAYS[d.getUTCDay()]}, ${short(d)}` : `Week ending ${short(d)}`,
    value: values[i],
    secondary: Math.min(values[i], Math.round(values[i] * (successRate / 100 + (rand() - 0.5) * 0.03))),
  }));
}

export interface WorkflowPerf {
  workflowId: string;
  executions: number;
  success: number;
  cycleMin: number;
  /** Demo health assessment. Pause or draft state comes from the live workflow. */
  health: "healthy" | "attention";
}

// 7-day baseline. Longer ranges scale volume and drift slightly slower, so the trend reads as improving.
const base: WorkflowPerf[] = [
  { workflowId: "request-fulfilment", executions: 428, success: 97.4, cycleMin: 252, health: "healthy" },
  { workflowId: "invoice-approval", executions: 216, success: 95.8, cycleMin: 368, health: "attention" },
  { workflowId: "employee-onboarding", executions: 184, success: 98.1, cycleMin: 164, health: "healthy" },
  { workflowId: "vendor-onboarding", executions: 97, success: 94.8, cycleMin: 312, health: "healthy" },
  { workflowId: "incident-escalation", executions: 0, success: 0, cycleMin: 0, health: "healthy" },
];

function scaleWorkflows(volume: number, successShift: number, cycleScale: number, jitter: number[]): WorkflowPerf[] {
  return base.map((w, i) =>
    w.executions === 0
      ? w
      : {
          ...w,
          executions: Math.round(w.executions * volume * jitter[i]),
          success: Math.round((w.success + successShift) * 10) / 10,
          cycleMin: Math.round(w.cycleMin * cycleScale),
        },
  );
}

/** Automation runs by seed automation id. Other automations (e.g. ones added this session) have no demo history. */
const autoBase: Record<string, { runs: number; success: number }> = {
  "auto-routing": { runs: 168, success: 98.2 },
  "auto-escalation": { runs: 41, success: 96.8 },
  "auto-fulfilment": { runs: 96, success: 99 },
  "auto-completion": { runs: 82, success: 100 },
  "auto-balance": { runs: 21, success: 92 },
  "auto-invoice": { runs: 361, success: 96.5 },
  "auto-stale": { runs: 9, success: 94 },
};

function scaleAutomations(volume: number, shift: number) {
  return Object.fromEntries(
    Object.entries(autoBase).map(([id, a], i) => [
      id,
      { runs: Math.round(a.runs * volume * (0.94 + (i % 3) * 0.05)), success: Math.min(100, Math.round((a.success + shift) * 10) / 10) },
    ]),
  );
}

export interface RangeData {
  trend: TrendPoint[];
  workflows: WorkflowPerf[];
  automations: Record<string, { runs: number; success: number }>;
  completed: number;
  deltas: { executions: string; success: string; time: string; completed: string };
  /** Average cycle time for Customer Request Processing across the range, oldest first (minutes). */
  cycleTrend: number[];
  cycleChange: number;
}

function cycleSeries(points: number, from: number, to: number, seed: number) {
  const rand = rng(seed);
  return Array.from({ length: points }, (_, i) => Math.round(from + ((to - from) * i) / (points - 1) + (rand() - 0.5) * 22));
}

function make(range: Range): RangeData {
  const cfg = {
    "7d": { volume: 1, shift: 0, cycle: 1, jitter: [1, 1, 1, 1, 1], points: 7, step: 1, seed: 11, completed: 241, cycleFrom: 266, cycleTo: 252, change: 9 },
    "30d": { volume: 4.3, shift: -0.3, cycle: 1.04, jitter: [1.02, 0.97, 1.01, 1.04, 1], points: 30, step: 1, seed: 29, completed: 1018, cycleFrom: 288, cycleTo: 262, change: 7 },
    "90d": { volume: 13.1, shift: -0.6, cycle: 1.11, jitter: [1.01, 1.03, 0.98, 1.02, 1], points: 13, step: 7, seed: 47, completed: 3094, cycleFrom: 318, cycleTo: 280, change: 12 },
  }[range];
  const workflows = scaleWorkflows(cfg.volume, cfg.shift, cfg.cycle, cfg.jitter);
  const total = workflows.reduce((n, w) => n + w.executions, 0);
  const rate = workflows.reduce((n, w) => n + w.success * w.executions, 0) / total;
  return {
    trend: buildSeries(cfg.points, cfg.step, total, rate, cfg.seed),
    workflows,
    automations: scaleAutomations(cfg.volume, cfg.shift),
    completed: cfg.completed,
    deltas: {
      "7d": { executions: "+12.4%", success: "+1.8 pts", time: "9% faster", completed: "+6%" },
      "30d": { executions: "+8.1%", success: "+1.1 pts", time: "6% faster", completed: "+4%" },
      "90d": { executions: "+21.6%", success: "+0.4 pts", time: "3% faster", completed: "+11%" },
    }[range],
    cycleTrend: cycleSeries(Math.min(cfg.points, 14), cfg.cycleFrom, cfg.cycleTo, cfg.seed + 5),
    cycleChange: cfg.change,
  };
}

export const rangeData: Record<Range, RangeData> = { "7d": make("7d"), "30d": make("30d"), "90d": make("90d") };

/** Where work is stuck right now. Not range-dependent. */
export const bottlenecks = {
  slow: {
    workflowId: "request-fulfilment",
    stage: "Approval",
    stageNumber: 3,
    waiting: 11,
    percentSlower: 22,
    actualMin: 588,
    expectedMin: 480,
    oldest: [
      { id: "#1019", title: "Cloud infrastructure commitment", age: "1 d 2 h" },
      { id: "#1022", title: "Training budget — Q4 cohort", age: "19 h" },
      { id: "#1024", title: "Office furniture replacement", age: "11 h" },
    ],
  },
  approaching: {
    workflowId: "request-fulfilment",
    stage: "Review",
    stageNumber: 2,
    approaching: 7,
    total: 17,
  },
  blocked: {
    workflowId: "request-fulfilment",
    stage: "Fulfilment",
    stageNumber: 4,
    blocked: 3,
    reasons: [
      { label: "Awaiting supplier confirmation", count: 2 },
      { label: "Missing delivery address", count: 1 },
    ],
  },
};

export const bottleneckedItems = bottlenecks.slow.waiting + bottlenecks.approaching.approaching + bottlenecks.blocked.blocked;
