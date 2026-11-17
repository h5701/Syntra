"use client";

import { useId } from "react";
import { useReducedMotion } from "framer-motion";
import { edgeGeometry, type Pos } from "@/lib/builder-layout";
import type { Branch } from "@/lib/builder-nodes";
import { flowSpeed, healthColor, progressionColor } from "@/components/workflow/flow-colors";
import type { Health } from "@/lib/types";

/** Branch colours: cyan for Yes, violet for No. Always paired with a text label, never colour alone. */
export const branchColor: Record<Branch, string> = { yes: "#0891b2", no: "#7c3aed" };

/**
 * One connection. It carries direction (arrowhead, and moving dots where work really flows) and
 * status: orange when the step it feeds needs attention, still and dashed when paused. Connections
 * leaving a Condition take their branch colour. Clicking one selects it.
 */
export function BuilderEdge({
  id,
  from,
  to,
  branch,
  position,
  targetHealth,
  paused,
  configured = false,
  selected,
  ariaLabel,
  onKeySelect,
}: {
  id: string;
  from: Pos;
  to: Pos;
  branch?: Branch;
  position: number;
  targetHealth: Health;
  paused: boolean;
  /** True when an added step is on either end: the connection exists but nothing is running through it. */
  configured?: boolean;
  selected: boolean;
  ariaLabel: string;
  onKeySelect: () => void;
}) {
  const gid = useId();
  const reduce = useReducedMotion();
  const g = edgeGeometry(from, to, branch);
  const struggling = !paused && !configured && !branch && (targetHealth === "attention" || targetHealth === "critical");
  const c1 = branch ? branchColor[branch] : paused ? healthColor.idle : struggling ? healthColor[targetHealth] : progressionColor(position - 0.14);
  const c2 = branch ? branchColor[branch] : paused ? healthColor.idle : struggling ? healthColor[targetHealth] : progressionColor(position + 0.14);
  const duration = paused || configured || branch ? 0 : flowSpeed[targetHealth];
  const live = duration > 0 && !reduce;

  return (
    <g>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={g.x1} y1={0} x2={g.x2} y2={0}>
          <stop stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      {selected && <path d={g.d} fill="none" stroke={c2} strokeOpacity={0.28} strokeWidth={18} strokeLinecap="round" />}
      <path d={g.d} fill="none" stroke={c2} strokeOpacity={0.12} strokeWidth={12} strokeLinecap="round" />
      <path
        d={g.d}
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth={selected ? 4 : 3}
        strokeLinecap="round"
        strokeDasharray={paused ? "6 8" : undefined}
        opacity={paused ? 0.7 : configured ? 0.9 : 1}
      />
      {live && (
        <path d={g.d} fill="none" stroke="#fff" strokeOpacity={0.85} strokeWidth={1.5} strokeLinecap="round" strokeDasharray="2 12" className="builder-flow" style={{ animation: `builder-flow ${duration / 1.6}s linear infinite` }} />
      )}
      <path d={`M${g.x2 - 4} ${g.y2} l-11 -6.5 v13 z`} fill={c2} />
      {live &&
        [0, 1].map((n) => (
          <circle key={n} r={4} fill="#fff" stroke={c2} strokeWidth={2}>
            <animateMotion dur={`${duration}s`} begin={`${(duration / 2) * n}s`} repeatCount="indefinite" path={g.d} />
            <animate attributeName="opacity" values="0;1;1;0" dur={`${duration}s`} begin={`${(duration / 2) * n}s`} repeatCount="indefinite" />
          </circle>
        ))}
      {/* A wide invisible stroke makes the connection easy to click and focus. */}
      <path
        data-edge-id={id}
        d={g.d}
        fill="none"
        stroke="transparent"
        strokeWidth={22}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-pressed={selected}
        style={{ pointerEvents: "stroke", cursor: "pointer", outline: "none" }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onKeySelect();
          }
        }}
      />
    </g>
  );
}
