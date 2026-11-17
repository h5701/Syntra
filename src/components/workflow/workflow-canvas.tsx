"use client";

import { Fragment, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { NodeDetailPanel } from "@/components/workflow/node-detail-panel";
import { WorkflowConnector } from "@/components/workflow/workflow-connector";
import { WorkflowNode } from "@/components/workflow/workflow-node";
import type { Workflow } from "@/lib/types";

const legend = [
  { label: "Running well", color: "bg-success" },
  { label: "Needs attention", color: "bg-warning" },
  { label: "At risk", color: "bg-danger" },
];

export function WorkflowCanvas({
  workflow,
  workflowHref,
  selectedId: controlledId,
  onSelectStage,
  paused,
  currentStageId,
  currentReason,
}: {
  workflow: Workflow;
  workflowHref?: string;
  /** Optional controlled selection, so other parts of a page can open the inspector. */
  selectedId?: string | null;
  onSelectStage?: (id: string | null) => void;
  paused?: boolean;
  currentStageId?: string | null;
  currentReason?: "bottleneck" | "busiest" | null;
}) {
  const [internalId, setInternalId] = useState<string | null>(null);
  const selectedId = controlledId !== undefined ? controlledId : internalId;
  const select = (id: string | null) => (onSelectStage ? onSelectStage(id) : setInternalId(id));

  // Keep the last stage mounted while the sheet animates closed.
  const [shownId, setShownId] = useState<string | null>(null);
  if (selectedId && selectedId !== shownId) setShownId(selectedId);
  const index = workflow.stages.findIndex((s) => s.id === selectedId);
  const shownIndex = Math.max(0, workflow.stages.findIndex((s) => s.id === shownId));
  const shown = workflow.stages[shownIndex];
  const last = workflow.stages.length - 1;

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="process-map relative px-4 pt-5 pb-8 sm:px-8 xl:px-6 xl:pb-12">
        <ul className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground xl:mb-8">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${l.color}`} />
              {l.label}
            </li>
          ))}
        </ul>
        <div className="mx-auto flex max-w-sm flex-col items-center xl:max-w-none xl:flex-row xl:items-stretch xl:justify-between">
          {workflow.stages.map((stage, i) => (
            <Fragment key={stage.id}>
              <WorkflowNode
                stage={stage}
                index={i}
                total={workflow.stages.length}
                selected={stage.id === selectedId}
                onSelect={() => select(stage.id)}
                paused={paused}
                highlight={stage.id === currentStageId ? (currentReason === "bottleneck" ? "Bottleneck" : "Most work here") : undefined}
              />
              {i < last && (
                <WorkflowConnector
                  position={(i + 0.5) / last}
                  targetHealth={paused ? "idle" : workflow.stages[i + 1].health}
                  moved={stage.movedToday}
                />
              )}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-border bg-white px-5 py-3 text-xs text-muted-foreground">
        <span>Select a stage to inspect its owner, items and activity.</span>
        <span>Moving dots show work in flow. Slower motion means a queue is building.</span>
      </div>

      <Sheet open={index >= 0} onOpenChange={(o) => !o && select(null)}>
        <SheetContent side="right" className="gap-0 border-l border-border bg-white p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[480px]">
          {shown && (
            <NodeDetailPanel
              stage={shown}
              stageNumber={shownIndex + 1}
              stageCount={workflow.stages.length}
              workflowName={workflow.name}
              workflowHref={workflowHref}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
