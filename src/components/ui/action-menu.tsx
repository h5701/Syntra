"use client";

import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionMenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

/** Overflow ("…") menu for row actions. */
export function ActionMenu({ label, items }: { label: string; items: ActionMenuItem[] }) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors outline-none hover:bg-slate-100 hover:text-navy focus-visible:ring-2 focus-visible:ring-brand-blue data-popup-open:bg-slate-100 data-popup-open:text-navy"
      >
        <MoreHorizontal className="size-4" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6} className="z-[70]">
          <Menu.Popup className="min-w-44 rounded-xl border border-border bg-white p-1 shadow-lift outline-none transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            {items.map((it) => (
              <Menu.Item
                key={it.label}
                disabled={it.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  it.onSelect();
                }}
                className={cn(
                  "flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] font-medium outline-none select-none data-disabled:opacity-40 data-highlighted:bg-soft",
                  it.destructive ? "text-danger data-highlighted:bg-danger-soft" : "text-navy",
                )}
              >
                <it.icon className="size-4" />
                {it.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
