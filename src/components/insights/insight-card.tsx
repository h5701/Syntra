import Link from "next/link";
import { ArrowUpRight, Lightbulb } from "lucide-react";
import { SourceChip, kindLabel, priorityInfo } from "@/components/insights/source-label";
import type { Insight } from "@/lib/insights";
import { cn } from "@/lib/utils";

/** One insight: what was found, the evidence it rests on and where each piece came from, and what to do next. */
export function InsightCard({ insight: i }: { insight: Insight }) {
  const p = priorityInfo[i.priority];
  return (
    <article className="surface rounded-2xl p-5" aria-labelledby={`insight-${i.id}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="rounded-full bg-soft px-2 py-0.5 text-[11px] font-semibold text-navy">{kindLabel[i.kind]}</span>
        <SourceChip source={i.source} />
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className={cn("size-1.5 rounded-full", p.dot)} aria-hidden /> {p.label}
        </span>
      </div>
      <h3 id={`insight-${i.id}`} className="mt-2.5 text-[0.9375rem] leading-snug font-semibold text-navy [overflow-wrap:anywhere]">{i.title}</h3>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{i.explanation}</p>

      <div className="mt-4">
        <p className="text-xs font-semibold text-navy">Evidence</p>
        <dl className="mt-1.5 divide-y divide-border rounded-xl border border-border bg-white text-[0.8125rem]">
          {i.evidence.map((e, n) => (
            <div key={`${e.label}-${n}`} className="grid gap-x-3 gap-y-0.5 px-3.5 py-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-baseline">
              <dt className="text-muted-foreground [overflow-wrap:anywhere]">{e.label}</dt>
              <dd className="font-semibold text-navy [overflow-wrap:anywhere]">{e.value}</dd>
              <dd className="justify-self-start sm:justify-self-end"><SourceChip source={e.source} short className="font-medium" /></dd>
            </div>
          ))}
        </dl>
      </div>

      {i.suggestion && (
        <p className="mt-3 flex gap-2 rounded-xl bg-soft px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-navy">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden />
          <span><span className="font-semibold">Suggested next step.</span> {i.suggestion}</span>
        </p>
      )}

      <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {i.actions.map((a) => (
          <Link key={a.href} href={a.href} className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-brand-blue hover:underline focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
            {a.label} <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        ))}
      </div>
    </article>
  );
}
