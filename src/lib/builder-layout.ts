import type { WorkflowStage } from "@/lib/types";

export const NODE_W = 256;
export const NODE_H = 184;
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 1.6;

export interface Pos {
  x: number;
  y: number;
}
export interface View {
  x: number;
  y: number;
  z: number;
}

/** A left-to-right row with a gentle stagger, so the flow reads as movement rather than a grid. */
export function defaultPositions(stages: WorkflowStage[]): Record<string, Pos> {
  return Object.fromEntries(stages.map((s, i) => [s.id, { x: i * (NODE_W + 88), y: i % 2 ? 44 : 0 }]));
}

/** Keeps zoom within range. A view that is already below the minimum (a fit on a small screen) can't be pushed further out. */
export const clampZoom = (z: number, current = MIN_ZOOM) => Math.min(MAX_ZOOM, Math.max(Math.min(MIN_ZOOM, current), z));

const FIT_FLOOR = 0.12;

/** The view that fits every node inside a viewport of the given size. */
export function fitView(positions: Pos[], width: number, height: number, padding = 56): View {
  if (positions.length === 0 || width === 0) return { x: 0, y: 0, z: 1 };
  const minX = Math.min(...positions.map((p) => p.x));
  const maxX = Math.max(...positions.map((p) => p.x + NODE_W));
  const minY = Math.min(...positions.map((p) => p.y));
  const maxY = Math.max(...positions.map((p) => p.y + NODE_H));
  const bw = maxX - minX;
  const bh = maxY - minY;
  const z = Math.min(Math.max(FIT_FLOOR, Math.min((width - padding * 2) / bw, (height - padding * 2) / bh)), 1.1);
  return { z, x: (width - bw * z) / 2 - minX * z, y: (height - bh * z) / 2 - minY * z };
}

/** Where a connection leaves a step: the middle, or a branch handle for Yes and No. */
export const handleY = (branch?: "yes" | "no") => (branch === "yes" ? NODE_H * 0.34 : branch === "no" ? NODE_H * 0.68 : NODE_H / 2);

/** Curve from the right edge of one step (at its branch handle, if any) to the left edge of the next. */
export function edgeGeometry(a: Pos, b: Pos, branch?: "yes" | "no") {
  const x1 = a.x + NODE_W;
  const y1 = a.y + handleY(branch);
  const x2 = b.x;
  const y2 = b.y + NODE_H / 2;
  const dx = Math.max(70, Math.abs(x2 - x1) / 2);
  const c1x = x1 + dx;
  const c2x = x2 - dx;
  return {
    d: `M${x1} ${y1} C${c1x} ${y1} ${c2x} ${y2} ${x2} ${y2}`,
    x1,
    y1,
    x2,
    y2,
    mid: { x: (x1 + 3 * c1x + 3 * c2x + x2) / 8, y: (y1 + 3 * y1 + 3 * y2 + y2) / 8 },
  };
}

/** On narrow screens, start at a readable size on the first stage instead of a tiny overview. */
export function focusFirstView(first: Pos, height: number, z = 0.8): View {
  return { z, x: 24 - first.x * z, y: height * 0.3 - (first.y + NODE_H / 2) * z };
}
