"use client";

import { formatDate } from "@/lib/format";
import { useSettings } from "@/lib/settings-state";

/** A calendar date in the format chosen in Settings. */
export function FormattedDate({ iso }: { iso: string }) {
  const { settings } = useSettings();
  return <>{formatDate(iso, settings.workspace.dateFormat)}</>;
}
