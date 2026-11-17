import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Manage your workspace, operator profile and preferences. This is a concept: changes apply to this demo session only." />
      <SettingsView />
    </>
  );
}
