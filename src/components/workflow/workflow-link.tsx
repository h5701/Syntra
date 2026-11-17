"use client";

import Link from "next/link";
import { useWorkflows } from "@/lib/workflow-state";

/** Link to a workflow, labelled with its current (possibly renamed) name. */
export function WorkflowLink({ id, className }: { id: string; className?: string }) {
  const workflow = useWorkflows().find((w) => w.id === id);
  if (!workflow) return null;
  return (
    <Link href={`/workflows/${workflow.id}`} className={className} onClick={(e) => e.stopPropagation()}>
      {workflow.name}
    </Link>
  );
}
