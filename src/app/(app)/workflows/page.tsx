import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { NewWorkflowButton } from "@/components/workflow/create-workflow";
import { WorkflowList } from "@/components/workflow/workflow-list";
import { WorkflowStats } from "@/components/workflow/workflow-stats";

export const metadata: Metadata = { title: "Workflows" };

export default function WorkflowsPage() {
  return (
    <>
      <PageHeader title="Workflows" description="Design, monitor and optimise the processes that keep your operation moving." actions={<NewWorkflowButton />} />
      <WorkflowStats />
      <WorkflowList />
    </>
  );
}
