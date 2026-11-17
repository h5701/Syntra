import { useId } from "react";

export function Sparkline({
  data,
  color = "#2563ff",
  className,
  fill = true,
}: {
  data: number[];
  color?: string;
  className?: string;
  fill?: boolean;
}) {
  const id = useId();
  const w = 120;
  const h = 40;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 4 - ((v - min) / range) * (h - 10)]);
  // Smooth the line with simple midpoint curves.
  const line = pts.reduce((d, p, i) => {
    if (i === 0) return `M${p[0]} ${p[1]}`;
    const prev = pts[i - 1];
    const mx = (prev[0] + p[0]) / 2;
    return `${d} C${mx} ${prev[1]} ${mx} ${p[1]} ${p[0]} ${p[1]}`;
  }, "");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor={color} stopOpacity="0.25" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0] - 2} cy={last[1]} r="2.5" fill="#fff" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
