import { NODE_H, NODE_W, type Pos } from "@/lib/builder-layout";
import { defaultEdgeId, topoOrder, validateGraph } from "@/lib/builder-graph";
import { defaultConfig, type BuilderNodeData, type Branch, type NodeConfig, type NodeType } from "@/lib/builder-nodes";
import type { BuilderLayout } from "@/lib/workflow-state";
import type { StageKind, Workflow, WorkflowStage } from "@/lib/types";

/**
 * Starting points for new workflows. A template is a small description of a graph; building one
 * returns a fresh `BuilderLayout` in the same format the builder already uses, so a created
 * workflow is edited, validated and saved exactly like any other. Templates are illustrative:
 * nothing here connects to a real system and nothing has been run.
 */

interface Step {
  key: string;
  type: NodeType;
  name: string;
  description: string;
  config?: NodeConfig;
  /** Grid position. Columns run left to right; rows may be fractional. */
  col: number;
  row: number;
}

/** [from, to] or [from, to, branch] for the two paths leaving a Condition. */
type Link = [string, string] | [string, string, Branch];

export interface WorkflowTemplate {
  id: string;
  name: string;
  /** What it is for, in one sentence. */
  purpose: string;
  /** A typical situation where it would be used. */
  useCase: string;
  /** Suggested workflow name and description, which the person can change. */
  suggestedName: string;
  suggestedDescription: string;
  /** Plain-language summary of the Yes and No paths. */
  branchNote: string;
  steps: Step[];
  links: Link[];
}

const STEP_X = NODE_W + 88;
const ROW_Y = NODE_H + 56;

const ILLUSTRATIVE = "Illustrative: the rule is not evaluated yet.";

export const templates: WorkflowTemplate[] = [
  {
    id: "client-onboarding",
    name: "Client onboarding",
    purpose: "Bring a new client from first request to a set-up account.",
    useCase: "A client submits a form and someone checks the details are complete before setup begins.",
    suggestedName: "Client Onboarding",
    suggestedDescription: "Capture and review a new client's details, then approve and set up their account.",
    branchNote: "Complete information goes to approval and setup. Incomplete information asks the client for what's missing.",
    steps: [
      { key: "trigger", type: "trigger", name: "New client request", description: "A client submits the onboarding form.", config: { event: "form-submitted", detail: "Client onboarding form" }, col: 0, row: 0 },
      { key: "capture", type: "action", name: "Capture client details", description: "Record the company, contact and scope of work.", config: { action: "create-task", title: "Capture company, contact and scope details" }, col: 1, row: 0 },
      { key: "review", type: "action", name: "Review details", description: "A reviewer checks the submission.", config: { action: "assign-owner", ownerId: "priya" }, col: 2, row: 0 },
      { key: "complete", type: "condition", name: "Is information complete?", description: `Checks whether the client supplied everything needed. ${ILLUSTRATIVE}`, config: { field: "status", operator: "equals", value: "Complete" }, col: 3, row: 0 },
      { key: "approve", type: "approval", name: "Approve setup", description: "An approver signs off before the account is created.", config: { approverId: "hina", instructions: "Confirm the scope and contact details look right.", deadlineHours: "24" }, col: 4, row: 0 },
      { key: "setup", type: "action", name: "Set up client account", description: "Create the client's account and workspace.", config: { action: "create-task", title: "Create the client account and workspace" }, col: 5, row: 0 },
      { key: "missing", type: "notification", name: "Request missing information", description: "Ask the client for what's missing.", config: { recipientType: "requester", message: "We need a few more details to continue your onboarding." }, col: 4, row: 1 },
      { key: "end", type: "end", name: "Onboarding finished", description: "Both paths finish here.", config: { outcome: "Completed" }, col: 6, row: 0.5 },
    ],
    links: [["trigger", "capture"], ["capture", "review"], ["review", "complete"], ["complete", "approve", "yes"], ["complete", "missing", "no"], ["approve", "setup"], ["setup", "end"], ["missing", "end"]],
  },
  {
    id: "purchase-approval",
    name: "Purchase approval",
    purpose: "Route purchase requests to the right level of approval.",
    useCase: "Staff request a purchase and larger amounts need finance sign-off.",
    suggestedName: "Purchase Approval",
    suggestedDescription: "Validate purchase requests and send larger ones for finance approval.",
    branchNote: "Requests over the example threshold go to finance approval. Smaller ones are recorded directly. Both then notify the requester.",
    steps: [
      { key: "trigger", type: "trigger", name: "Purchase request submitted", description: "A purchase request arrives.", config: { event: "form-submitted", detail: "Purchase request form" }, col: 0, row: 0 },
      { key: "validate", type: "action", name: "Validate request", description: "Check the budget code, supplier and quote.", config: { action: "create-task", title: "Check budget code, supplier and quote" }, col: 1, row: 0 },
      { key: "threshold", type: "condition", name: "Over approval threshold?", description: `Compares the request value with an example threshold of 5,000. ${ILLUSTRATIVE}`, config: { field: "value", operator: "greater-than", value: "5000" }, col: 2, row: 0 },
      { key: "approve", type: "approval", name: "Finance approval", description: "Finance approves larger purchases.", config: { approverId: "tomas", instructions: "Check the budget and the supplier quote.", deadlineHours: "48" }, col: 3, row: 0 },
      { key: "record", type: "action", name: "Record approval", description: "Smaller purchases are recorded without extra sign-off.", config: { action: "update-record", field: "Status", value: "Approved" }, col: 3, row: 1 },
      { key: "notify", type: "notification", name: "Confirm to requester", description: "Tell the requester the outcome.", config: { recipientType: "requester", message: "Your purchase request has been processed." }, col: 4, row: 0.5 },
      { key: "end", type: "end", name: "Request closed", description: "Both paths finish here.", config: { outcome: "Completed" }, col: 5, row: 0.5 },
    ],
    links: [["trigger", "validate"], ["validate", "threshold"], ["threshold", "approve", "yes"], ["threshold", "record", "no"], ["approve", "notify"], ["record", "notify"], ["notify", "end"]],
  },
  {
    id: "employee-onboarding",
    name: "Employee onboarding",
    purpose: "Get a new starter ready for their first week.",
    useCase: "HR confirms a new starter and teams prepare for their arrival.",
    suggestedName: "Employee Onboarding",
    suggestedDescription: "Collect a new starter's details, assign responsibilities and prepare their first week.",
    branchNote: "Office-based starters get equipment prepared. Remote starters get a remote-working guide. Both then get a first-week plan.",
    steps: [
      { key: "trigger", type: "trigger", name: "New starter confirmed", description: "A new starter's details are confirmed.", config: { event: "record-updated", detail: "Employment status" }, col: 0, row: 0 },
      { key: "collect", type: "action", name: "Collect starter information", description: "Gather the details needed before day one.", config: { action: "create-task", title: "Collect contact, bank and right-to-work details" }, col: 1, row: 0 },
      { key: "assign", type: "action", name: "Assign responsibilities", description: "Name who looks after each part of onboarding.", config: { action: "assign-owner", ownerId: "hina" }, col: 2, row: 0 },
      { key: "equipment", type: "condition", name: "Office-based starter?", description: `Decides whether equipment is needed. ${ILLUSTRATIVE}`, config: { field: "type", operator: "equals", value: "Office-based" }, col: 3, row: 0 },
      { key: "prepare", type: "action", name: "Prepare equipment", description: "Order a laptop and set up a desk.", config: { action: "create-task", title: "Order equipment and set up a desk" }, col: 4, row: 0 },
      { key: "remote", type: "notification", name: "Send remote-working guide", description: "Share how to work remotely.", config: { recipientType: "requester", message: "Here is your remote-working guide and setup checklist." }, col: 4, row: 1 },
      { key: "plan", type: "action", name: "Schedule first-week plan", description: "Book introductions and training.", config: { action: "create-task", title: "Schedule introductions and training" }, col: 5, row: 0.5 },
      { key: "end", type: "end", name: "Onboarding complete", description: "Both paths finish here.", config: { outcome: "Completed" }, col: 6, row: 0.5 },
    ],
    links: [["trigger", "collect"], ["collect", "assign"], ["assign", "equipment"], ["equipment", "prepare", "yes"], ["equipment", "remote", "no"], ["prepare", "plan"], ["remote", "plan"], ["plan", "end"]],
  },
  {
    id: "support-request",
    name: "Support request handling",
    purpose: "Sort incoming support requests and escalate urgent ones.",
    useCase: "A support team triages requests and sends high-priority ones to a senior reviewer.",
    suggestedName: "Support Request Handling",
    suggestedDescription: "Categorise and review support requests, escalating high-priority ones.",
    branchNote: "High-priority requests are escalated and resolved. Others are resolved normally, then followed up with the requester.",
    steps: [
      { key: "trigger", type: "trigger", name: "New support request", description: "A support request arrives.", config: { event: "new-request", detail: "Support request" }, col: 0, row: 0 },
      { key: "categorise", type: "action", name: "Categorise request", description: "Label the request by topic.", config: { action: "update-record", field: "Category", value: "To be categorised" }, col: 1, row: 0 },
      { key: "review", type: "action", name: "Review request", description: "A coordinator reviews the request.", config: { action: "assign-owner", ownerId: "daniel" }, col: 2, row: 0 },
      { key: "priority", type: "condition", name: "Is priority high?", description: `Decides whether the request is escalated. ${ILLUSTRATIVE}`, config: { field: "priority", operator: "equals", value: "High" }, col: 3, row: 0 },
      { key: "escalate", type: "notification", name: "Escalate to senior reviewer", description: "Alert a senior reviewer.", config: { recipientType: "member", memberId: "priya", message: "A high-priority support request needs your attention." }, col: 4, row: 0 },
      { key: "resolve-high", type: "action", name: "Resolve escalated request", description: "The senior reviewer resolves it.", config: { action: "create-task", title: "Resolve the escalated request" }, col: 5, row: 0 },
      { key: "resolve", type: "action", name: "Resolve request", description: "Resolve the request in the normal queue.", config: { action: "create-task", title: "Resolve the request" }, col: 4, row: 1 },
      { key: "follow-up", type: "notification", name: "Follow up with requester", description: "Check the requester is satisfied.", config: { recipientType: "requester", message: "We've resolved your request. Let us know if you need anything else." }, col: 5, row: 1 },
      { key: "end", type: "end", name: "Request closed", description: "Both paths finish here.", config: { outcome: "Completed" }, col: 6, row: 0.5 },
    ],
    links: [["trigger", "categorise"], ["categorise", "review"], ["review", "priority"], ["priority", "escalate", "yes"], ["priority", "resolve", "no"], ["escalate", "resolve-high"], ["resolve-high", "end"], ["resolve", "follow-up"], ["follow-up", "end"]],
  },
];

/** Starting from scratch: one Trigger, one first step and one End, already connected. */
export const blankTemplate: WorkflowTemplate = {
  id: "blank",
  name: "Start from scratch",
  purpose: "Begin with the minimum and build the rest yourself.",
  useCase: "You already know how the process should look.",
  suggestedName: "",
  suggestedDescription: "",
  branchNote: "A single path with no branches. Add a Condition in the builder when you need a Yes/No split.",
  steps: [
    { key: "trigger", type: "trigger", name: "Workflow starts", description: "Choose what starts this workflow.", config: { event: "new-request" }, col: 0, row: 0 },
    { key: "first", type: "action", name: "First step", description: "Replace this with the first thing that should happen.", config: { action: "create-task" }, col: 1, row: 0 },
    { key: "end", type: "end", name: "Workflow ends", description: "Where the workflow finishes.", config: { outcome: "Completed" }, col: 2, row: 0 },
  ],
  links: [["trigger", "first"], ["first", "end"]],
};

export const templateById = (id: string) => (id === blankTemplate.id ? blankTemplate : templates.find((t) => t.id === id));

/** A fresh graph for a template. Every call returns new objects, so graphs never share state. Node ids start with `prefix`. */
export function buildTemplateLayout(template: WorkflowTemplate, prefix = "t"): BuilderLayout {
  const id = (key: string) => `${prefix}-${key}`;
  const nodes: Record<string, BuilderNodeData> = {};
  const positions: Record<string, Pos> = {};
  for (const s of template.steps) {
    nodes[id(s.key)] = { type: s.type, name: s.name, description: s.description, config: { ...defaultConfig(s.type), ...s.config }, custom: true };
    positions[id(s.key)] = { x: s.col * STEP_X, y: Math.round(s.row * ROW_Y) };
  }
  const edges = template.links.map(([from, to, branch]) => ({ id: defaultEdgeId(id(from), id(to)), from: id(from), to: id(to), ...(branch ? { branch } : {}) }));
  const layout: BuilderLayout = { positions, order: [], nodes, edges };
  return { ...layout, order: topoOrder(layout) };
}

/** Problems that would stop this template being used. Empty when the graph is valid. */
export const templateProblems = (template: WorkflowTemplate) => validateGraph(buildTemplateLayout(template, "check"));

const kindFor: Record<NodeType, StageKind | null> = {
  trigger: "intake",
  action: "review",
  approval: "approval",
  delay: "fulfilment",
  notification: "fulfilment",
  end: "complete",
  condition: null,
};

/**
 * The operational stages for a created workflow, taken from its graph. A Condition is a decision,
 * not a stage, so it has none. Nothing has run, so every stage is idle and empty.
 */
export function deriveStages(layout: BuilderLayout, ownerId: string): WorkflowStage[] {
  return layout.order.flatMap((id) => {
    const node = layout.nodes[id];
    const kind = node && kindFor[node.type];
    if (!node || !kind) return [];
    return [
      {
        id,
        name: node.name,
        kind,
        description: node.description,
        health: "idle" as const,
        statusLabel: "Not run yet",
        count: 0,
        countLabel: "items",
        ownerId,
        sla: 0,
        time: "—",
        timeNote: "no data",
        metrics: [{ label: "In stage", value: "0", hint: "Nothing has run yet", tone: "neutral" as const }],
        items: [],
        activity: [],
      },
    ];
  });
}

export const NAME_MAX = 60;
export const DESC_MAX = 160;

/** A name as it is stored: trimmed, with runs of whitespace collapsed to one space. */
export const cleanName = (s: string) => s.trim().replace(/\s+/g, " ");

/** Names are the same if they differ only in case or spacing. */
export const sameName = (a: string, b: string) => cleanName(a).toLowerCase() === cleanName(b).toLowerCase();

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

/** An id for a new workflow that isn't in `taken`. */
export function uniqueWorkflowId(name: string, taken: Set<string>): string {
  const base = slug(name) || "workflow";
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

export interface NewWorkflow {
  workflow: Workflow;
  layout: BuilderLayout;
}

/** A draft workflow from a template (or the blank one). Returns null if the template's graph isn't valid. */
export function createFromTemplate(template: WorkflowTemplate, input: { name: string; description: string; ownerId: string }, taken: Set<string>): NewWorkflow | null {
  const name = cleanName(input.name);
  if (!name || name.length > NAME_MAX) return null;
  const id = uniqueWorkflowId(name, taken);
  const layout = buildTemplateLayout(template, id);
  if (validateGraph(layout).length > 0) return null;
  return {
    layout,
    workflow: {
      id,
      name,
      description: cleanName(input.description).slice(0, DESC_MAX),
      status: "draft",
      ownerId: input.ownerId,
      lastRun: "Never run",
      updated: "Just now",
      successRate: 0,
      avgCycle: "—",
      runsPerWeek: 0,
      stages: deriveStages(layout, input.ownerId),
      origin: { templateId: template.id === blankTemplate.id ? null : template.id, templateName: template.name },
    },
  };
}
