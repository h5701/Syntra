"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { MemberAvatar } from "@/components/common/member-avatar";
import { currentUserId } from "@/lib/data/team";
import { useTeam } from "@/lib/team-state";
import { useWorkflows } from "@/lib/workflow-state";
import { useAutomations } from "@/lib/automation-state";
import { useSettings } from "@/lib/settings-state";
import { navGroups, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  const { automations } = useAutomations();
  const { members } = useTeam();
  const workflows = useWorkflows();
  const count = item.href === "/automations" ? automations.length : item.href === "/team" ? members.length : item.href === "/workflows" ? workflows.length : item.count;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
        active ? "text-brand-blue" : "text-slate-600 hover:bg-slate-100/80 hover:text-navy",
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-xl bg-info-soft ring-1 ring-brand-blue/10"
          transition={{ type: "spring", stiffness: 480, damping: 38 }}
        >
          <span className="bg-brand-gradient-v absolute top-2 bottom-2 -left-px w-[3px] rounded-full" />
        </motion.span>
      )}
      <Icon className={cn("relative size-[18px] transition-colors", active ? "text-brand-blue" : "text-slate-400 group-hover:text-slate-600")} strokeWidth={1.8} />
      <span className="relative flex-1">{item.label}</span>
      {count !== undefined && (
        <span className={cn("relative rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums", active ? "bg-white text-brand-blue" : "bg-slate-100 text-slate-500")}>
          {count}
        </span>
      )}
    </Link>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { settings } = useSettings();
  const { byId } = useTeam();
  const user = byId(currentUserId);
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48"
        style={{
          background:
            "radial-gradient(260px 150px at 20% 0%, rgb(37 99 255 / 0.13), transparent 70%), radial-gradient(220px 140px at 90% 10%, rgb(124 58 237 / 0.10), transparent 70%)",
        }}
      />
      <div className="relative px-4 pt-5">
        <Link href="/dashboard" onClick={onNavigate} aria-label="Syntra home" className="block px-1">
          <Logo />
        </Link>
        <Link
          href="/settings#workspace"
          onClick={onNavigate}
          aria-label="Workspace settings"
          className="mt-5 flex w-full items-center gap-2.5 rounded-xl border border-border bg-white/80 p-2 text-left shadow-card transition-colors hover:bg-white"
        >
          <span className="bg-brand-gradient flex size-8 items-center justify-center rounded-lg text-xs font-bold text-white">{settings.workspace.name.trim().charAt(0).toUpperCase() || "S"}</span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[0.8125rem] font-semibold">{settings.workspace.name}</span>
            <span className="block text-[11px] text-muted-foreground">Concept workspace</span>
          </span>
          <ChevronRight className="size-4 text-slate-400" />
        </Link>
      </div>

      <nav aria-label="Primary" className="relative mt-6 flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {navGroups.map((g) => (
          <div key={g.label}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map((item) => (
                <NavLink key={item.href} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="relative m-3 flex items-center gap-3 rounded-xl border border-border bg-white p-2.5 shadow-card">
        <MemberAvatar member={{ name: settings.profile.name, hue: user.hue }} size="lg" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[0.8125rem] font-semibold">{settings.profile.name}</p>
          <p className="truncate text-xs text-muted-foreground">{settings.profile.role}</p>
        </div>
      </div>
    </div>
  );
}
