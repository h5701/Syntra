import { CheckCircle2, ClipboardCheck, Inbox, PackageCheck, ShieldCheck, type LucideIcon } from "lucide-react";
import type { StageKind } from "@/lib/types";

export const stageIcon: Record<StageKind, LucideIcon> = {
  intake: Inbox,
  review: ClipboardCheck,
  approval: ShieldCheck,
  fulfilment: PackageCheck,
  complete: CheckCircle2,
};
