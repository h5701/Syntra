import type { Metadata } from "next";
import { WorkflowGate } from "@/components/workflow/workflow-gate";
import { WorkflowDetail } from "@/components/workflow/workflow-detail";
import { workflowById, workflows } from "@/lib/data/workflows";

export function generateStaticParams() {
  return workflows.map((w) => ({ id: w.id }));
}

export async function generateMetadata({ params }: PageProps<"/workflows/[id]">): Promise<Metadata> {
  const { id } = await params;
  // Created workflows are session-only, so the server can't know their names and they get the generic title.
  return { title: workflowById(id)?.name ?? "Workflow" };
}

export default async function WorkflowDetailPage({ params }: PageProps<"/workflows/[id]">) {
  const { id } = await params;
  const workflow = workflowById(id);
  // Not a seeded workflow: it may have been created this session, which only the browser knows.
  if (!workflow) return <WorkflowGate id={id} view="detail" />;
  return <WorkflowDetail key={workflow.id} workflowId={workflow.id} />;
}
