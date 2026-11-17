"use client";

import { cn } from "@/lib/utils";

/** Radio-style segmented control. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-border bg-soft p-1">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={cn(
              "rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium transition-all",
              active ? "bg-white text-brand-blue shadow-card ring-1 ring-brand-blue/20" : "text-muted-foreground hover:text-navy",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
