import { Loader2 } from "lucide-react";
import { StatusMark } from "@/components/common/status";
import type { RunResult } from "@/lib/types";

const map = { successful: { tone: "success", label: "Successful" }, failed: { tone: "danger", label: "Failed" } } as const;

/** Result of a single automation run. */
export function RunMark({ result }: { result: RunResult }) {
  if (result === "running") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium whitespace-nowrap text-brand-blue">
        <Loader2 className="size-3.5 animate-spin" /> Running
      </span>
    );
  }
  return <StatusMark tone={map[result].tone}>{map[result].label}</StatusMark>;
}
