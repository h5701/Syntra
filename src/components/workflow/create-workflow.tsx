"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Plus, Split } from "lucide-react";
import { TemplatePreview } from "@/components/workflow/template-preview";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { nodeMeta, summarise } from "@/lib/builder-nodes";
import { currentUserId } from "@/lib/data/team";
import { useSettings } from "@/lib/settings-state";
import { useTeam } from "@/lib/team-state";
import { DESC_MAX, NAME_MAX, blankTemplate, buildTemplateLayout, cleanName, sameName, templateProblems, templates, type WorkflowTemplate } from "@/lib/workflow-templates";
import { useCreateWorkflow, useWorkflows } from "@/lib/workflow-state";
import { cn } from "@/lib/utils";

const countSteps = (t: WorkflowTemplate) => t.steps.length;
const countDecisions = (t: WorkflowTemplate) => t.steps.filter((s) => s.type === "condition").length;
const stepsLabel = (t: WorkflowTemplate) => `${countSteps(t)} steps${countDecisions(t) ? ` · ${countDecisions(t)} decision` : ""}`;

/** The "New workflow" button and the short guided flow it opens: choose a starting point, then name and create. */
export function NewWorkflowButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-brand-gradient inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white shadow-lift transition-opacity hover:opacity-90"
      >
        <Plus className="size-4" /> New workflow
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="gap-0 border-l border-border bg-white p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[680px]">
          {/* Mounted only while open, so every visit starts from a clean first step. */}
          {open && <CreateFlow onClose={() => setOpen(false)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function CreateFlow({ onClose }: { onClose: () => void }) {
  const [template, setTemplate] = useState<WorkflowTemplate | null>(null);
  // Remembered so Back can put focus on the card that was chosen.
  const [lastId, setLastId] = useState<string | null>(null);
  return template ? (
    <Details template={template} onBack={() => setTemplate(null)} onCancel={onClose} onDone={onClose} />
  ) : (
    <Choose
      lastId={lastId}
      onPick={(t) => {
        setLastId(t.id);
        setTemplate(t);
      }}
      onCancel={onClose}
    />
  );
}

const headerBg = { backgroundImage: "radial-gradient(420px 180px at 0% 0%, rgb(37 99 255 / 0.12), transparent 70%), radial-gradient(300px 160px at 100% 0%, rgb(124 58 237 / 0.08), transparent 70%)" };

function Choose({ onPick, onCancel, lastId }: { onPick: (t: WorkflowTemplate) => void; onCancel: () => void; lastId: string | null }) {
  const root = useRef<HTMLDivElement>(null);
  // Coming back from step 2, focus returns to the card that was chosen.
  useEffect(() => {
    if (lastId) root.current?.querySelector<HTMLElement>(`[data-template="${lastId}"]`)?.focus();
  }, [lastId]);
  return (
    <div ref={root} className="flex h-full flex-col">
      <div className="px-6 pt-7 pb-5 pr-14" style={headerBg}>
        <p className="text-xs font-medium text-muted-foreground">Step 1 of 2</p>
        <SheetTitle className="mt-2 text-2xl leading-tight font-bold tracking-tight text-navy">New workflow</SheetTitle>
        <SheetDescription className="mt-1.5 text-sm">Pick a starting point. Everything can be changed afterwards in the builder.</SheetDescription>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pt-2 pb-6">
        <ul className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                data-template={t.id}
                onClick={() => onPick(t)}
                className="group flex h-full w-full flex-col rounded-2xl border border-border bg-white p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <span className="flex h-20 items-center justify-center rounded-xl bg-soft/70 px-2" aria-hidden>
                  <TemplatePreview template={t} className="h-full w-full" />
                </span>
                <span className="mt-3 text-[0.9375rem] font-semibold text-navy">{t.name}</span>
                <span className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">{t.purpose}</span>
                <span className="mt-3 text-xs font-medium text-slate-500">{stepsLabel(t)}</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          data-template={blankTemplate.id}
          onClick={() => onPick(blankTemplate)}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-left transition-colors hover:border-primary/50 hover:bg-soft/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft text-primary"><Plus className="size-5" /></span>
          <span>
            <span className="block text-[0.9375rem] font-semibold text-navy">Start from scratch</span>
            <span className="block text-[0.8125rem] text-muted-foreground">A trigger, one step and an end, ready to build on.</span>
          </span>
        </button>
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          Templates are illustrative starting points. They haven&apos;t been run and aren&apos;t connected to any real system.
        </p>
      </div>
      <div className="flex gap-2 border-t border-border bg-white px-6 py-4">
        <button type="button" onClick={onCancel} className="h-10 rounded-xl border border-border bg-white px-5 text-sm font-semibold transition-colors hover:bg-soft">
          Cancel
        </button>
      </div>
    </div>
  );
}

function Details({ template, onBack, onCancel, onDone }: { template: WorkflowTemplate; onBack: () => void; onCancel: () => void; onDone: () => void }) {
  const router = useRouter();
  const create = useCreateWorkflow();
  const existing = useWorkflows();
  const { byId } = useTeam();
  const operator = useSettings().settings.profile.name;
  const blank = template.id === blankTemplate.id;
  // A suggestion that is already taken (e.g. a seeded "Employee Onboarding") gets a number, so the form starts valid.
  const [name, setName] = useState(() => {
    const base = template.suggestedName;
    let candidate = base;
    for (let n = 2; base && existing.some((w) => sameName(w.name, candidate)); n++) candidate = `${base} ${n}`;
    return candidate;
  });
  const [description, setDescription] = useState(template.suggestedDescription);
  const [error, setError] = useState<string | null>(null);
  const [fault, setFault] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // The structure shown here is the one that gets created.
  const layout = useMemo(() => buildTemplateLayout(template, "summary"), [template]);
  const problems = useMemo(() => templateProblems(template), [template]);
  const nameOf = (id: string) => (id.startsWith("summary-") ? layout.nodes[id]?.name : byId(id)?.name);

  const problemWith = (value: string) => {
    const v = cleanName(value);
    if (!v) return "Enter a workflow name.";
    if (v.length > NAME_MAX) return `Keep the name to ${NAME_MAX} characters or fewer.`;
    if (existing.some((w) => sameName(w.name, v))) return "A workflow with this name already exists. Choose a different name.";
    return null;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = problemWith(name);
    setError(problem);
    if (problem) {
      nameRef.current?.focus();
      return;
    }
    const owner = byId(currentUserId) ? currentUserId : existing[0]?.ownerId;
    const id = create(template, { name, description, ownerId: owner }, operator);
    if (!id) {
      setFault("This template couldn't be created because its structure isn't valid. Nothing was added.");
      return;
    }
    onDone();
    router.push(`/workflows/${id}`);
  };

  const steps = layout.order.map((id) => ({ id, node: layout.nodes[id], out: layout.edges.filter((e) => e.from === id) }));

  return (
    <form onSubmit={submit} noValidate className="flex h-full flex-col">
      <div className="px-6 pt-7 pb-5 pr-14" style={headerBg}>
        <p className="text-xs font-medium text-muted-foreground">Step 2 of 2</p>
        <SheetTitle className="mt-2 text-2xl leading-tight font-bold tracking-tight text-navy">{blank ? "Start from scratch" : template.name}</SheetTitle>
        <SheetDescription className="mt-1.5 text-sm">{blank ? "Name your workflow, then shape it in the builder." : template.useCase}</SheetDescription>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 pt-2 pb-6">
        <div>
          <label htmlFor="new-wf-name" className="mb-1.5 block text-[0.8125rem] font-semibold text-navy">Workflow name</label>
          <Input
            id="new-wf-name"
            ref={nameRef}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(problemWith(e.target.value));
            }}
            maxLength={NAME_MAX + 20}
            autoFocus
            className="h-10 rounded-xl bg-white"
            aria-invalid={!!error}
            aria-describedby={error ? "new-wf-name-error" : undefined}
          />
          {error && <p id="new-wf-name-error" role="alert" className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
        </div>
        <div>
          <label htmlFor="new-wf-desc" className="mb-1.5 flex items-baseline justify-between text-[0.8125rem] font-semibold text-navy">
            <span>Description <span className="font-normal text-muted-foreground">(optional)</span></span>
            <span className="text-xs font-normal text-muted-foreground tabular-nums">{description.length}/{DESC_MAX}</span>
          </label>
          <textarea
            id="new-wf-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
            rows={2}
            className="w-full resize-none rounded-xl border border-input bg-white px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          />
        </div>

        <section aria-labelledby="new-wf-structure">
          <h3 id="new-wf-structure" className="text-[0.8125rem] font-semibold text-navy">{blank ? "What you start with" : "What this template creates"}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{template.branchNote}</p>
          <div
            // Keyboard users can scroll the outline when it is wider than the sheet; the step list below carries the same content.
            tabIndex={0}
            role="region"
            aria-label="Workflow outline, scrollable"
            className="mt-3 overflow-x-auto rounded-2xl border border-border bg-soft/50 p-3 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <TemplatePreview template={template} labels className="mx-auto h-auto min-w-[460px] w-full max-w-[600px]" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Outline only. Nothing here has run. The numbers match the steps listed below.</p>
          <ol className="mt-3 divide-y divide-border rounded-2xl border border-border bg-white text-[0.8125rem]">
            {steps.map(({ id, node, out }, i) => {
              const Icon = nodeMeta(node.type).icon;
              return (
                <li key={id} className="flex items-start gap-3 px-3.5 py-2.5">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: nodeMeta(node.type).accent }}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-navy">
                      <span className="mr-1.5 text-xs font-medium text-slate-400 tabular-nums">{i + 1}</span>
                      {node.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">{summarise(node, nameOf)}</span>
                    {node.type === "condition" && (
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                        {out.map((e) => (
                          <span key={e.id} className="inline-flex items-center gap-1 font-medium" style={{ color: e.branch === "yes" ? "#0891b2" : "#7c3aed" }}>
                            <Split className="size-3" /> {e.branch === "yes" ? "Yes" : "No"}: {layout.nodes[e.to].name}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 rounded-xl bg-soft px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
            {blank
              ? "Open the builder to rename the steps, add more and connect them. Every workflow keeps one Trigger and one End."
              : "A starting point, not a finished process. It hasn't been run and isn't connected to any real system. Open the builder to adjust any step or connection."}
          </p>
        </section>

        {(fault || problems.length > 0) && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-xs font-medium text-danger">
            {fault ?? "This template's structure isn't valid, so it can't be created."}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border bg-white px-6 py-4">
        <button type="button" onClick={onBack} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-white px-4 text-sm font-semibold transition-colors hover:bg-soft">
          <ArrowLeft className="size-4" /> Back
        </button>
        <button type="button" onClick={onCancel} className="h-10 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-soft hover:text-navy">
          Cancel
        </button>
        <button
          type="submit"
          disabled={problems.length > 0}
          className={cn("bg-brand-gradient ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl px-4 whitespace-nowrap sm:px-5 text-sm font-semibold text-white shadow-card transition-opacity hover:opacity-90", "disabled:pointer-events-none disabled:opacity-50")}
        >
          <Check className="size-4" /> Create workflow <ArrowRight className="hidden size-4 sm:block" />
        </button>
      </div>
    </form>
  );
}
