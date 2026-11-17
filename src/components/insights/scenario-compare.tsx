"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import { branchColor } from "@/components/builder/builder-edge";
import { Card, CardHeader } from "@/components/common/section";
import { Input } from "@/components/ui/input";
import { buildTemplateLayout, templates } from "@/lib/workflow-templates";
import { comparableConditions, compareScenarios, parseInputs, type PathOutcome } from "@/lib/whatif";
import { formatElapsed } from "@/lib/simulation";
import type { BuilderLayout } from "@/lib/workflow-state";
import { cn } from "@/lib/utils";

interface Option {
  key: string;
  label: string;
  layout: BuilderLayout;
  /** Set for a real workflow in this session. Template examples have no builder to open. */
  workflowId?: string;
}

const selectClass =
  "h-10 w-full min-w-0 rounded-xl border border-input bg-white px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

const defaultInputs: Record<string, string> = {
  priority: "High, Medium, Low",
  status: "Approved, Complete, Incomplete",
  type: "Customer request, Office-based, Remote",
};

/** Sensible starting inputs: values around a numeric threshold, or a few typical values for a text field. */
function startingInputs(field: string, value: string) {
  const n = Number(value);
  if (field === "value" || (value.trim() && Number.isFinite(n))) {
    if (Number.isFinite(n) && n > 0) return [Math.round(n * 0.25), n, Math.round(n * 1.5), Math.round(n * 2.4)].join(", ");
    return "1200, 5000, 7500, 12000";
  }
  return defaultInputs[field] ?? value;
}

const stepWord = (n: number) => `${n} ${n === 1 ? "step" : "steps"}`;

/**
 * Compare a workflow as it is with the same workflow after changing one Condition's value, using the
 * same sample inputs. Only the simulation is involved: the saved workflow is never edited here.
 */
export function ScenarioCompare({ workflows }: { workflows: { id: string; name: string; layout: BuilderLayout }[] }) {
  const options = useMemo<Option[]>(
    () => [
      ...workflows.map((w) => ({ key: `wf:${w.id}`, label: w.name, layout: w.layout, workflowId: w.id })),
      ...templates.map((t) => ({ key: `tpl:${t.id}`, label: `${t.name} (template example)`, layout: buildTemplateLayout(t, "example") })),
    ].filter((o) => comparableConditions(o.layout).length > 0),
    [workflows],
  );

  const [optionKey, setOptionKey] = useState(options.find((o) => o.key === "tpl:purchase-approval")?.key ?? options[0]?.key ?? "");
  const option = options.find((o) => o.key === optionKey) ?? options[0];
  const conditions = option ? comparableConditions(option.layout) : [];
  const [condKey, setCondKey] = useState<string | null>(null);
  const cond = conditions.find((c) => c.id === condKey) ?? conditions[0];

  // Edits are remembered per choice, so switching back and forth doesn't lose them.
  const scope = `${option?.key}|${cond?.id}`;
  const [edits, setEdits] = useState<Record<string, { value?: string; inputs?: string }>>({});
  const value = edits[scope]?.value ?? (cond ? (Number.isFinite(Number(cond.value)) && cond.value.trim() ? String(Math.round(Number(cond.value) * 2)) : cond.value) : "");
  const inputsText = edits[scope]?.inputs ?? (cond ? startingInputs(cond.field, cond.value) : "");
  const inputs = parseInputs(inputsText);
  const result = option && cond ? compareScenarios(option.layout, cond.id, value, inputs.slice(0, 8)) : null;

  if (!option || !cond) {
    return (
      <Card className="p-5">
        <p className="text-[0.8125rem] text-muted-foreground">No workflow has a Condition to compare yet.</p>
      </Card>
    );
  }

  return (
    <Card className="pb-5">
      <CardHeader
        title="Compare a change in simulation"
        description="Change one Condition value and see which route each sample input would take, before and after."
        action={<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-brand-blue"><FlaskConical className="size-3.5" aria-hidden /> Simulation only</span>}
      />
      <div className="grid gap-4 px-5 pt-4 md:grid-cols-2">
        <div>
          <label htmlFor="cmp-workflow" className="mb-1.5 block text-[0.8125rem] font-semibold text-navy">Workflow</label>
          <select id="cmp-workflow" value={option.key} onChange={(e) => { setOptionKey(e.target.value); setCondKey(null); }} className={selectClass}>
            {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cmp-condition" className="mb-1.5 block text-[0.8125rem] font-semibold text-navy">Condition to change</label>
          <select id="cmp-condition" value={cond.id} onChange={(e) => setCondKey(e.target.value)} className={selectClass}>
            {conditions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cmp-value" className="mb-1.5 block text-[0.8125rem] font-semibold text-navy">{cond.rule} …</label>
          <Input id="cmp-value" value={value} onChange={(e) => setEdits((p) => ({ ...p, [scope]: { ...p[scope], value: e.target.value } }))} className="h-10 rounded-xl bg-white" aria-describedby="cmp-value-hint" />
          <p id="cmp-value-hint" className="mt-1 text-xs text-muted-foreground">Currently <span className="font-semibold text-navy">{cond.value || "(none)"}</span> in the workflow. This is an example value, not a recommendation.</p>
        </div>
        <div>
          <label htmlFor="cmp-inputs" className="mb-1.5 block text-[0.8125rem] font-semibold text-navy">Sample inputs to try</label>
          <Input id="cmp-inputs" value={inputsText} onChange={(e) => setEdits((p) => ({ ...p, [scope]: { ...p[scope], inputs: e.target.value } }))} className="h-10 rounded-xl bg-white" aria-describedby="cmp-inputs-hint" />
          <p id="cmp-inputs-hint" className="mt-1 text-xs text-muted-foreground">Separate with commas. Up to 8. These are made-up values.</p>
        </div>
      </div>

      <div className="px-5 pt-5">
        {!result || result.rows.length === 0 ? (
          <p className="rounded-xl bg-soft px-3.5 py-4 text-center text-[0.8125rem] text-muted-foreground">Enter at least one sample input to compare.</p>
        ) : (
          <>
            <p role="status" className="text-[0.9375rem] font-semibold text-navy">
              {result.changedCount === 0
                ? "With this change every sample input takes the same route as before."
                : `${result.changedCount} of ${result.rows.length} sample ${result.rows.length === 1 ? "input" : "inputs"} ${result.changedCount === 1 ? "takes" : "take"} a different route.`}
              {result.approvalsOriginal !== result.approvalsModified && (
                <span className="font-normal text-muted-foreground"> Approvals met across these inputs: {result.approvalsOriginal} → {result.approvalsModified}.</span>
              )}
            </p>
            <ul className="mt-3 space-y-2">
              {result.rows.map((r) => {
                const gone = r.original.path.filter((n) => !r.modified.path.includes(n));
                const added = r.modified.path.filter((n) => !r.original.path.includes(n));
                return (
                  <li key={r.input} className={cn("rounded-xl border bg-white p-3", r.changed ? "border-brand-blue/35 shadow-card" : "border-border")}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-sm font-semibold text-navy [overflow-wrap:anywhere]">{r.input}</span>
                      {r.changed ? <span className="rounded-full bg-info-soft px-2 py-0.5 text-[11px] font-semibold text-brand-blue">Route changes</span> : <span className="text-[11px] font-medium text-muted-foreground">Same route</span>}
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start">
                      <Outcome label="As it is" o={r.original} />
                      <ArrowRight className="hidden size-4 self-center text-slate-400 sm:block" aria-hidden />
                      <Outcome label="With the change" o={r.modified} />
                    </div>
                    {r.changed && (gone.length > 0 || added.length > 0) && (
                      <p className="mt-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        {gone.length > 0 && <>No longer meets <span className="font-semibold text-navy">{gone.join(", ")}</span>. </>}
                        {added.length > 0 && <>Now meets <span className="font-semibold text-navy">{added.join(", ")}</span>.</>}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p className="mt-4 rounded-xl bg-soft px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
          This compares simulated routes only. {option.workflowId ? "The saved workflow is unchanged until you edit it in the builder." : "This template example isn't one of your workflows, and nothing is saved."} It doesn&apos;t predict real volumes, timings or outcomes, and the step times shown are fixed simulation values.
        </p>
        {option.workflowId && (
          <Link href={`/workflows/${option.workflowId}/builder?focus=${encodeURIComponent(cond.id)}`} className="mt-3 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-brand-blue hover:underline focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
            Make this change in the builder <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </Card>
  );
}

function Outcome({ label, o }: { label: string; o: PathOutcome }) {
  const bad = o.status !== "completed";
  return (
    <div className="min-w-0 rounded-lg bg-soft/70 px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem]">
        {o.branch ? (
          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: branchColor[o.branch] }}>{o.branch === "yes" ? "Yes" : "No"} path</span>
        ) : null}
        <span className={cn("font-semibold", bad ? "text-danger" : "text-navy")}>{bad ? (o.status === "blocked" ? "Blocked" : o.status === "rejected" ? "Can't run" : "Failed") : "Reaches the End"}</span>
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {stepWord(o.path.length)} · {o.approvals} {o.approvals === 1 ? "approval" : "approvals"} · {formatElapsed(o.elapsed)} simulated
      </p>
      {o.note && <p className="mt-0.5 text-xs text-danger [overflow-wrap:anywhere]">{o.note}</p>}
    </div>
  );
}
