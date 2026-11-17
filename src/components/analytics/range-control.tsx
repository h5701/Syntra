"use client";

import { cn } from "@/lib/utils";
import { ranges, type Range } from "@/lib/data/analytics";

/** Time-range switch. Each option swaps in a predefined demo dataset. */
export function RangeControl({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex gap-1 rounded-xl border border-border bg-white p-1 shadow-card" role="tablist" aria-label="Time range">
      {ranges.map((r) => {
        const on = r.id === value;
        return (
          <button
            key={r.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(r.id)}
            className={cn("rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors", on ? "bg-brand-gradient text-white shadow-sm" : "text-muted-foreground hover:bg-soft hover:text-navy")}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
