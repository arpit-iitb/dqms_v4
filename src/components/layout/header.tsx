"use client";

import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-slate-200 bg-white flex-shrink-0">
      {title ? (
        <h1 className="text-sm font-semibold text-slate-800">{title}</h1>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <User className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{user.name || user.email}</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="text-slate-500 hover:text-slate-800 h-8 px-2"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline ml-1">Logout</span>
        </Button>
      </div>
    </header>
  );
}
