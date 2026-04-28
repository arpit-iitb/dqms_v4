"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileSearch,
  ClipboardList,
  Truck,
  Users,
  ChevronLeft,
  Settings,
  Cog,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  section?: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  // Pre-sales
  { label: "Leads & Quotations", href: "/quotations", icon: FileSearch, section: "Pre-Sales" },
  { label: "Clients", href: "/clients", icon: Users },
  // Post-sales
  { label: "Sales Orders", href: "/orders", icon: ClipboardList, section: "Production" },
  { label: "Vendors", href: "/vendors", icon: Truck },
  // Config
  { label: "Settings", href: "/settings", icon: Settings, section: "System" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  let currentSection = "";

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-slate-900 text-slate-100 transition-all duration-300 flex-shrink-0 relative",
        collapsed ? "w-16" : "w-58",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-4 border-b border-slate-700/60",
          collapsed && "justify-center px-2",
        )}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500 text-white flex-shrink-0">
          <Cog className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-bold text-base text-white leading-tight">
              DQMS v4
            </div>
            <div className="text-xs text-slate-400 leading-tight truncate">
              Mechximize Ops
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          const showSection =
            !collapsed && item.section && item.section !== currentSection;
          if (showSection) currentSection = item.section!;

          return (
            <React.Fragment key={item.href}>
              {showSection && (
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 pt-4 pb-1">
                  {item.section}
                </p>
              )}
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors",
                  collapsed ? "justify-center" : "",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronLeft
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            collapsed && "rotate-180",
          )}
        />
      </button>
    </aside>
  );
}
