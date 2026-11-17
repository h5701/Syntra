"use client";

import { useId, useState } from "react";
import { motion } from "framer-motion";

interface Point {
  label: string;
  /** Longer label for the tooltip. */
  title?: string;
  value: number;
  secondary?: number;
}

/** Interactive gradient area chart with an optional second series. */
export function AreaChart({
  data,
  unit = "",
  height = 220,
  secondaryLabel,
  primaryLabel = "Value",
}: {
  data: Point[];
  unit?: string;
  height?: number;
  primaryLabel?: string;
  secondaryLabel?: string;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const w = 600;
  const h = height;
  const padX = 12;
  const padTop = 16;
  const padBottom = 8;
  const all = data.flatMap((d) => (d.secondary !== undefined ? [d.value, d.secondary] : [d.value]));
  const min = Math.min(...all) * 0.85;
  const max = Math.max(...all) * 1.08;
  const x = (i: number) => padX + (i / (data.length - 1)) * (w - padX * 2);
  const y = (v: number) => padTop + (1 - (v - min) / (max - min)) * (h - padTop - padBottom);

  const path = (get: (d: Point) => number) =>
    data.reduce((d, p, i) => {
      const px = x(i);
      const py = y(get(p));
      if (i === 0) return `M${px} ${py}`;
      const mx = (x(i - 1) + px) / 2;
      return `${d} C${mx} ${y(get(data[i - 1]))} ${mx} ${py} ${px} ${py}`;
    }, "");

  const main = path((d) => d.value);
  const second = data[0].secondary !== undefined ? path((d) => d.secondary ?? 0) : null;
  const active = hover ?? data.length - 1;
  // Show roughly seven axis labels however many points there are.
  const step = Math.ceil(data.length / 7);

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full"
          style={{ height }}
          preserveAspectRatio="none"
          role="img"
          aria-label="Trend chart"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const i = Math.round(((e.clientX - r.left) / r.width) * (data.length - 1));
            setHover(Math.max(0, Math.min(data.length - 1, i)));
          }}
        >
          <defs>
            <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#2563ff" stopOpacity="0.28" />
              <stop offset="0.6" stopColor="#06b6d4" stopOpacity="0.08" />
              <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${id}-s`} x1="0" y1="0" x2="1" y2="0">
              <stop stopColor="#2563ff" />
              <stop offset="0.55" stopColor="#06b6d4" />
              <stop offset="1" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
          {[0.2, 0.4, 0.6, 0.8].map((g) => (
            <line key={g} x1="0" x2={w} y1={h * g} y2={h * g} stroke="#e3e8f2" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
          ))}
          <motion.path d={`${main} L${x(data.length - 1)} ${h} L${x(0)} ${h} Z`} fill={`url(#${id}-f)`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
          {second && (
            <motion.path d={second} fill="none" stroke="#a5b4d6" strokeWidth="1.75" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
          )}
          <motion.path d={main} fill="none" stroke={`url(#${id}-s)`} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} />
          <line x1={x(active)} x2={x(active)} y1={0} y2={h} stroke="#2563ff" strokeOpacity="0.25" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Marker is HTML so it stays circular under the stretched viewBox. */}
        <span
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-blue bg-white shadow"
          style={{ left: `${(x(active) / w) * 100}%`, top: `${(y(data[active].value) / h) * 100}%` }}
        />
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border border-border bg-white px-3 py-2 text-xs shadow-lift"
          style={{ left: `${Math.min(88, Math.max(12, (x(active) / w) * 100))}%` }}
        >
          <p className="text-muted-foreground">{(data[active].title ?? data[active].label).trim()}</p>
          <p className="mt-0.5 font-semibold tabular-nums">
            {data[active].value.toLocaleString()}
            {unit} <span className="font-normal text-muted-foreground">{primaryLabel}</span>
          </p>
          {data[active].secondary !== undefined && (
            <p className="tabular-nums text-muted-foreground">
              {data[active].secondary?.toLocaleString()}
              {unit} {secondaryLabel}
            </p>
          )}
        </div>
      </div>
      <div className="relative mt-2 h-4 text-[11px] text-muted-foreground">
        {data.map((d, i) =>
          i % step === 0 || i === data.length - 1 ? (
            <span
              key={i}
              className={`absolute -translate-x-1/2 whitespace-nowrap ${i === active ? "font-semibold text-foreground" : ""}`}
              style={{ left: `${Math.min(96, Math.max(4, (x(i) / w) * 100))}%` }}
            >
              {d.label.trim()}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
