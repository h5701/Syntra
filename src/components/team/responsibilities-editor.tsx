"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GripVertical, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface ResponsibilityDraft {
  id: string;
  text: string;
}

let counter = 0;
export const newResponsibility = (text: string): ResponsibilityDraft => ({ id: `r-${Date.now()}-${counter++}`, text });

/** Add, edit and remove a list of responsibilities. */
export function ResponsibilitiesEditor({
  items,
  onChange,
}: {
  items: ResponsibilityDraft[];
  onChange: (items: ResponsibilityDraft[]) => void;
}) {
  const [text, setText] = useState("");

  const add = () => {
    const value = text.trim();
    if (!value) return;
    onChange([...items, newResponsibility(value)]);
    setText("");
  };

  return (
    <div>
      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-[0.8125rem] text-muted-foreground">
          No responsibilities yet. Add the duties this person owns.
        </p>
      )}
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {items.map((r, i) => (
            <motion.li
              key={r.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="group flex items-center gap-2 rounded-xl border border-border bg-white pr-1.5 pl-2 transition-colors focus-within:border-brand-blue/50 focus-within:ring-3 focus-within:ring-ring/30">
                <GripVertical className="size-4 shrink-0 text-slate-300" />
                <Input
                  value={r.text}
                  aria-label={`Responsibility ${i + 1}`}
                  onChange={(e) => onChange(items.map((x) => (x.id === r.id ? { ...x, text: e.target.value } : x)))}
                  className="h-10 border-0 bg-transparent px-1 shadow-none ring-0 focus-visible:ring-0"
                />
                <button
                  type="button"
                  aria-label={`Remove responsibility ${i + 1}`}
                  onClick={() => onChange(items.filter((x) => x.id !== r.id))}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <X className="size-4" />
                </button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="mt-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a responsibility, e.g. Escalate blocked processes"
          aria-label="New responsibility"
          className="h-10 rounded-xl bg-white"
        />
        <button
          type="button"
          onClick={add}
          disabled={!text.trim()}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-info-soft px-3.5 text-[0.8125rem] font-semibold text-brand-blue transition-colors hover:bg-brand-blue/15 disabled:opacity-50"
        >
          <Plus className="size-4" /> Add
        </button>
      </div>
    </div>
  );
}
