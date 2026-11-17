import { useId } from "react";
import { cn } from "@/lib/utils";

/** The Syntra mark. The Syntra mark: two nodes joined by a flowing S. */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} role="img" aria-label="Syntra" fill="none">
      <defs>
        <linearGradient id={id} x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2F6BFF" />
          <stop offset="0.55" stopColor="#14B8E6" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <path
        d="M21.5 10.5c0-2.2-2.4-3.4-5.5-3.4s-5.2 1.6-5.2 3.8c0 4.3 10.4 2.4 10.4 7.3 0 2.4-2.4 4.3-5.4 4.3s-5.6-1.3-5.6-3.6"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="21.5" cy="10.5" r="2.6" fill="#fff" />
      <circle cx="10.2" cy="21.9" r="2.6" fill="#fff" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[1.1875rem] font-bold tracking-tight text-navy">Syntra</span>
    </div>
  );
}
