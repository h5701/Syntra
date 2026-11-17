import { cn } from "@/lib/utils";
import { DemoBadge } from "@/components/common/section";

export function PageHeader({
  title,
  badge,
  description,
  actions,
  actionsClassName,
  className,
}: {
  title: string;
  badge?: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  /** Replaces the default row of wrapping actions, e.g. to lay buttons out in a grid on phones. */
  actionsClassName?: string;
  className?: string;
}) {
  return (
    <header className={cn("mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between lg:mb-10", className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-[1.75rem] [overflow-wrap:anywhere] leading-tight font-bold tracking-tight text-navy sm:text-[2.125rem]">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-2 max-w-2xl [overflow-wrap:anywhere] text-[0.9375rem] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className={cn("flex shrink-0 flex-wrap items-center gap-2", actionsClassName)}>
        {actions}
        <DemoBadge />
      </div>
    </header>
  );
}
