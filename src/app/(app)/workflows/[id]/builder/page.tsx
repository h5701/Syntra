import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { WorkflowGate } from "@/components/workflow/workflow-gate";
import { WorkflowBuilder } from "@/components/builder/workflow-builder";
import { workflowById, workflows } from "@/lib/data/workflows";

// Let the page resize when a phone's keyboard opens, so the inspector's fields stay reachable.
export const viewport: Viewport = { interactiveWidget: "resizes-content" };

export function generateStaticParams() {
  return workflows.map((w) => ({ id: w.id }));
}

export async function generateMetadata({ params }: PageProps<"/workflows/[id]/builder">): Promise<Metadata> {
  const { id } = await params;
  const name = workflowById(id)?.name;
  return { title: name ? `Builder · ${name}` : "Builder" };
}

export default async function WorkflowBuilderPage({ params }: PageProps<"/workflows/[id]/builder">) {
  const { id } = await params;
  // Not a seeded workflow: it may have been created this session, which only the browser knows.
  if (!workflowById(id)) return <WorkflowGate id={id} view="builder" />;
  // The builder reads ?focus= to open a step, which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <WorkflowBuilder key={id} workflowId={id} />
    </Suspense>
  );
}
