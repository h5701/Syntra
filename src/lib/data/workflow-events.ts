import type { Workflow, WorkflowEvent } from "@/lib/types";

/** Demo "now" for relative timestamps: 09:45 on the demo day. */
const NOW_MINUTES = 9 * 60 + 45;

const clock = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `Today, ${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Turns "12 min ago" / "3 h ago" into a clock time on the demo day. */
function absolute(relative: string) {
  const min = /^(\d+) min/.exec(relative);
  if (min) return clock(NOW_MINUTES - Number(min[1]));
  const hr = /^(\d+) h/.exec(relative);
  if (hr) return clock(NOW_MINUTES - Number(hr[1]) * 60);
  return relative === "Yesterday" ? "Yesterday" : relative;
}

const sessionStart = Date.now();

/** Timestamp for events created during this session, continuing on from the demo clock. */
export const nowStamp = () => clock(NOW_MINUTES + 1 + Math.floor((Date.now() - sessionStart) / 60000));

const primary: WorkflowEvent[] = [
  { id: "ev1", text: "Request #1047 entered Review", stageId: "review", time: clock(9 * 60 + 41), tone: "neutral" },
  { id: "ev2", text: "Hina Ahmad approved Request #1042", actorId: "hina", stageId: "approval", time: clock(9 * 60 + 36), tone: "good" },
  { id: "ev3", text: "Request #1039 moved to Fulfilment", stageId: "fulfilment", time: clock(9 * 60 + 22), tone: "neutral" },
  { id: "ev4", text: "Automation completed successfully: Auto-route by request type", stageId: "new-request", time: clock(9 * 60 + 12), tone: "good" },
  { id: "ev5", text: "Request #1037 exceeded expected processing time", stageId: "approval", time: clock(9 * 60 + 5), tone: "warn" },
  { id: "ev6", text: "Tomás Berg approved Request #1018", actorId: "tomas", stageId: "approval", time: clock(8 * 60 + 47), tone: "good" },
  { id: "ev7", text: "4 approvals passed their SLA and were escalated", stageId: "approval", time: clock(8 * 60 + 30), tone: "warn" },
  { id: "ev8", text: "Priya Raman sent Request #1033 back for more detail", actorId: "priya", stageId: "review", time: clock(8 * 60 + 12), tone: "neutral" },
  { id: "ev9", text: "Request #1041 received from the portal", stageId: "new-request", time: clock(8 * 60 + 2), tone: "neutral" },
  { id: "ev10", text: "Jonah Whitfield dispatched equipment kits for Request #1012", actorId: "jonah", stageId: "fulfilment", time: clock(7 * 60 + 55), tone: "good" },
];

/** Recent events for a workflow. Hand-written for the primary demo, derived from stage activity for the rest. */
export function eventsFor(workflow: Workflow): WorkflowEvent[] {
  if (workflow.id === "request-fulfilment") return primary;
  return workflow.stages
    .flatMap((s) =>
      s.activity.map((a) => ({
        id: `${workflow.id}-${a.id}`,
        text: a.text,
        actorId: a.actorId,
        stageId: s.id,
        time: absolute(a.time),
        tone: "neutral" as const,
      })),
    )
    .sort((a, b) => b.time.localeCompare(a.time));
}
