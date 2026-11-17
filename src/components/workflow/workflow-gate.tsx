"use client";

import { Suspense } from "react";
import Link from "next/link";
import { GitBranch } from "lucide-react";
import { WorkflowBuilder } from "@/components/builder/workflow-builder";
import { WorkflowDetail } from "@/components/workflow/workflow-detail";
import { useWorkflows } from "@/lib/workflow-state";

/**
 * Opens a workflow that isn't part of the seeded demo data, i.e. one created in this session.
 * Created workflows live only in session state, so after a refresh the address no longer matches
 * anything and this explains why instead of showing an error. The browser tab title stays generic
 * here: the server renders the title and can't know a session-only name, and a client-side title
 * would fight Next's own metadata.
 */
export function WorkflowGate({ id, view }: { id: string; view: "detail" | "builder" }) {
  const workflow = useWorkflows().find((w) => w.id === id);
  if (workflow)
    return view === "builder" ? (
      <Suspense fallback={null}>
        <WorkflowBuilder key={id} workflowId={id} />
      </Suspense>
    ) : (
      <WorkflowDetail key={id} workflowId={id} />
    );
  return (
    <div className="mx-auto mt-16 max-w-md rounded-3xl border border-border bg-white p-8 text-center shadow-card">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-soft text-primary">
        <GitBranch className="size-6" />
      </span>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-navy">This workflow isn&apos;t available</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Workflows created in this demo exist only for the current session, so a refresh clears them. Nothing is saved to a server.
      </p>
      <Link href="/workflows" className="bg-brand-gradient mt-6 inline-flex h-10 items-center rounded-xl px-5 text-sm font-semibold text-white shadow-card transition-opacity hover:opacity-90">
        Back to workflows
      </Link>
    </div>
  );
}
