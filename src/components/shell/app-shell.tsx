"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-sidebar lg:block">
        <SidebarNav />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-white/90 px-4 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2" aria-label="Syntra home">
          <LogoMark className="size-7" />
          <span className="text-lg font-bold tracking-tight text-navy">Syntra</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-white text-foreground shadow-card transition-colors hover:bg-muted"
        >
          <Menu className="size-[18px]" strokeWidth={1.8} />
        </button>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-72 gap-0 bg-sidebar p-0 sm:max-w-72">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
