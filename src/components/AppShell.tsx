import { Link, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Briefcase,
  Building2,
  Compass,
  FileText,
  LogOut,
  MessagesSquare,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Compass className="size-4" />
            </span>
            <span className="font-display text-lg font-semibold">NextAdventureAI</span>
          </Link>

          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">Add job</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/jobs">
                <Briefcase className="size-4" /> Jobs
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/companies">
                <Building2 className="size-4" /> Companies
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/skills">
                <BarChart3 className="size-4" /> Skills
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/resume">
                <FileText className="size-4" /> Resume
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/chat">
                <MessagesSquare className="size-4" /> Chat
              </Link>
            </Button>

            {user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/auth" });
                }}
              >
                <LogOut className="size-4" />
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}

export function ScoreDial({ score, size = 72 }: { score: number | null; size?: number }) {
  const value = score ?? 0;
  const tone =
    score === null
      ? "var(--color-muted-foreground)"
      : value >= 75
        ? "var(--color-success)"
        : value >= 50
          ? "var(--color-warning)"
          : "var(--color-destructive)";

  return (
    <div
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${tone} ${value * 3.6}deg, var(--color-secondary) 0deg)`,
      }}
    >
      <div
        className="grid place-items-center rounded-full bg-card"
        style={{ width: size - 12, height: size - 12 }}
      >
        <span className="font-display text-lg font-semibold">{score === null ? "—" : value}</span>
      </div>
    </div>
  );
}
