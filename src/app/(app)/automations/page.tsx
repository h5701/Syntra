import type { Metadata } from "next";
import { Suspense } from "react";
import { AutomationCenter } from "@/components/automations/automation-center";

export const metadata: Metadata = { title: "Automations" };

export default function AutomationsPage() {
  return (
    <Suspense>
      <AutomationCenter />
    </Suspense>
  );
}
