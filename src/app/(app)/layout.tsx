import { AppShell } from "@/components/shell/app-shell";
import { AutomationStateProvider } from "@/lib/automation-state";
import { SettingsStateProvider } from "@/lib/settings-state";
import { TeamStateProvider } from "@/lib/team-state";
import { WorkflowStateProvider } from "@/lib/workflow-state";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SettingsStateProvider>
      <TeamStateProvider>
        <WorkflowStateProvider>
          <AutomationStateProvider>
            <AppShell>{children}</AppShell>
          </AutomationStateProvider>
        </WorkflowStateProvider>
      </TeamStateProvider>
    </SettingsStateProvider>
  );
}
