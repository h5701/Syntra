import type { Health } from "@/lib/types";

const stops = ["#2563ff", "#06b6d4", "#7c3aed"];

/** Position along the process (0..1) mapped onto the blue → cyan → violet progression. */
export function progressionColor(t: number) {
  const x = Math.min(0.999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = parseInt(stops[i].slice(1), 16);
  const b = parseInt(stops[i + 1].slice(1), 16);
  const mix = (shift: number) => Math.round(((a >> shift) & 255) * (1 - f) + ((b >> shift) & 255) * f);
  return `rgb(${mix(16)} ${mix(8)} ${mix(0)})`;
}

export const healthColor: Record<Health, string> = {
  healthy: "#12a150",
  attention: "#ea7a0c",
  critical: "#e5484d",
  idle: "#a3adc2",
  done: "#2563ff",
};

/** Seconds for one dot to cross a connector. Slower = work is queuing. */
export const flowSpeed: Record<Health, number> = {
  healthy: 1.8,
  done: 1.8,
  attention: 3.2,
  critical: 5,
  idle: 0,
};
