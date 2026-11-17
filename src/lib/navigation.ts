import {
  BarChart3,
  GitBranch,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Settings,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { processes } from "@/lib/data/operations";
import { workflows } from "@/lib/data/workflows";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/workflows", label: "Workflows", icon: GitBranch, count: workflows.length },
      { href: "/processes", label: "Processes", icon: ListChecks, count: processes.length },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/automations", label: "Automations", icon: Zap },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/insights", label: "Insights", icon: Lightbulb },
    ],
  },
  {
    label: "Organisation",
    items: [
      { href: "/team", label: "Team", icon: Users },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];
