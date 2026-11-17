"use client";

import { useId, useMemo } from "react";
import { branchColor } from "@/components/builder/builder-edge";
import { NODE_H, NODE_W, edgeGeometry } from "@/lib/builder-layout";
import { nodeMeta } from "@/lib/builder-nodes";
import { buildTemplateLayout, type WorkflowTemplate } from "@/lib/workflow-templates";

/** Splits a name over at most two lines of roughly `max` characters. */
function wrap(text: string, max: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > max) {
      lines.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  if (lines.length > 2) return [lines[0], `${lines.slice(1).join(" ").slice(0, max - 1)}…`];
  return lines;
}

/**
 * A small map of a template's graph. With `labels` it names every step and marks the Yes and No
 * paths; without, it is a quiet silhouette for cards. Steps are numbered to match the written step list, which is the full, readable version: long names are shortened here.
 */
export function TemplatePreview({ template, labels = false, className }: { template: WorkflowTemplate; labels?: boolean; className?: string }) {
  const layout = useMemo(() => buildTemplateLayout(template, "preview"), [template]);
  const uid = useId();
  const pad = 36;
  const pos = Object.values(layout.positions);
  const width = Math.max(...pos.map((p) => p.x)) + NODE_W + pad * 2;
  const height = Math.max(...pos.map((p) => p.y)) + NODE_H + pad * 2;
  const at = (id: string) => ({ x: layout.positions[id].x + pad, y: layout.positions[id].y + pad });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label={`${template.name} outline: ${layout.order.length} steps`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="#94a3b8" />
        </marker>
      </defs>
      {layout.edges.map((e) => {
        const g = edgeGeometry(at(e.from), at(e.to), e.branch);
        const color = e.branch ? branchColor[e.branch] : "#b6c0d4";
        return (
          <g key={e.id}>
            <path d={g.d} fill="none" stroke={color} strokeWidth={labels ? 6 : 9} strokeLinecap="round" />
            {labels && e.branch && (
              <g transform={`translate(${g.x1 + 18} ${g.y1 + (e.branch === "yes" ? -40 : 14)})`}>
                <rect width={e.branch === "yes" ? 74 : 62} height={34} rx={17} fill="#fff" stroke={color} strokeWidth={3} />
                <text x={e.branch === "yes" ? 37 : 31} y={25} textAnchor="middle" fontSize={22} fontWeight={700} fill={color}>
                  {e.branch === "yes" ? "YES" : "NO"}
                </text>
              </g>
            )}
          </g>
        );
      })}
      {layout.order.map((id, index) => {
        const n = layout.nodes[id];
        const meta = nodeMeta(n.type);
        const p = at(id);
        return (
          <g key={id} transform={`translate(${p.x} ${p.y})`}>
            <title>{`${index + 1}. ${n.name}`}</title>
            <rect width={NODE_W} height={NODE_H} rx={32} fill={labels ? "#fff" : `${meta.accent}1f`} stroke={meta.accent} strokeWidth={labels ? 5 : 7} />
            {labels && (
              <>
                <circle cx={NODE_W - 36} cy={42} r={24} fill={meta.accent} />
                <text x={NODE_W - 36} y={51} textAnchor="middle" fontSize={26} fontWeight={700} fill="#fff">
                  {index + 1}
                </text>
                <text x={26} y={52} fontSize={24} fontWeight={700} letterSpacing={2} fill={meta.accent}>
                  {meta.label.toUpperCase()}
                </text>
                {wrap(n.name, 14).map((line, i) => (
                  <text key={i} x={26} y={104 + i * 40} fontSize={34} fontWeight={600} fill="#0f1b4c">
                    {line}
                  </text>
                ))}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
