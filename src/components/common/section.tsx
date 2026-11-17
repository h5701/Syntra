import { cn } from "@/lib/utils";

/** A titled block of page content. */
export function Section({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      {(title || action) && (
        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** White surface with soft depth. Use where content benefits from grouping. */
export function Card({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "li" | "article";
}) {
  return <Tag className={cn("surface rounded-2xl", className)}>{children}</Tag>;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h3 className="text-[0.9375rem] font-semibold tracking-tight [overflow-wrap:anywhere]">{title}</h3>
        {description && <p className="mt-0.5 text-[0.8125rem] text-muted-foreground [overflow-wrap:anywhere]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-card">
      <span className="size-1.5 rounded-full bg-brand-cyan" />
      Demo data
    </span>
  );
}
