"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Meter({
  value,
  tone,
  className,
}: {
  value: number;
  tone?: "good" | "warn" | "bad" | "brand";
  className?: string;
}) {
  const resolved = tone ?? (value >= 90 ? "good" : value >= 75 ? "warn" : "bad");
  const fill = { good: "bg-success", warn: "bg-warning", bad: "bg-danger", brand: "bg-brand-gradient" }[resolved];
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70", className)}
    >
      <motion.div
        className={cn("h-full rounded-full", fill)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}
