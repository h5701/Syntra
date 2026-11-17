"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Health } from "@/lib/types";
import { cn } from "@/lib/utils";
import { flowSpeed, healthColor, progressionColor } from "@/components/workflow/flow-colors";

/**
 * Run of the process rail between two stages.
 * Colour follows the blue → cyan → violet progression, switching to the
 * status colour when the next stage is struggling. Dot speed shows throughput.
 */
export function WorkflowConnector({
  position,
  targetHealth,
  moved,
}: {
  position: number;
  targetHealth: Health;
  moved?: number;
}) {
  const reduce = useReducedMotion();
  const struggling = targetHealth === "attention" || targetHealth === "critical";
  const from = struggling ? healthColor[targetHealth] : progressionColor(position - 0.14);
  const to = struggling ? healthColor[targetHealth] : progressionColor(position + 0.14);
  const duration = flowSpeed[targetHealth];
  const live = duration > 0 && !reduce;

  const chip =
    moved !== undefined ? (
      <span
        title={`${moved} moved to the next stage today`}
        className="rounded-full border bg-white px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap tabular-nums shadow-card"
        style={{ color: to, borderColor: `${to}33` }}
      >
        +{moved}
        <span className="font-medium xl:hidden"> moved today</span>
      </span>
    ) : null;

  const dots = (axis: "x" | "y") =>
    live &&
    [0, 1].map((n) => (
      <motion.span
        key={n}
        className="absolute size-[7px] rounded-full bg-white"
        style={{
          boxShadow: `0 0 0 2px ${to}, 0 0 10px ${to}`,
          [axis === "x" ? "top" : "left"]: "50%",
          [axis === "x" ? "marginTop" : "marginLeft"]: -3.5,
        }}
        initial={{ [axis === "x" ? "left" : "top"]: "0%", opacity: 0 }}
        animate={{ [axis === "x" ? "left" : "top"]: "100%", opacity: [0, 1, 1, 0] }}
        transition={{ duration, repeat: Infinity, ease: "easeInOut", delay: (duration / 2) * n }}
      />
    ));

  return (
    <>
      {/* Horizontal rail (xl and up) */}
      <div className="relative hidden min-w-9 flex-[0.34_1_0] xl:block" aria-hidden>
        <div className="absolute inset-x-0 top-[26px] flex justify-center">{chip}</div>
        <div className="absolute inset-x-0 top-[50px]">
        <div
          className={cn("h-[3px] w-full rounded-full", targetHealth === "idle" && "opacity-50")}
          style={{ backgroundImage: `linear-gradient(90deg, ${from}, ${to})` }}
        />
        {dots("x")}
        </div>
      </div>

      {/* Vertical rail (below xl) */}
      <div className="relative flex h-14 justify-center xl:hidden" aria-hidden>
        <div
          className="h-full w-[3px] rounded-full"
          style={{ backgroundImage: `linear-gradient(180deg, ${from}, ${to})`, opacity: targetHealth === "idle" ? 0.5 : 1 }}
        />
        {dots("y")}
        {chip && <div className="absolute top-1/2 left-1/2 ml-4 -translate-y-1/2">{chip}</div>}
      </div>
    </>
  );
}
