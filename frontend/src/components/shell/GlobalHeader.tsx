"use client";

import { useEffect, useState } from "react";
import { Atom, Search, Sun, Moon } from "lucide-react";
import { useLearningStore } from "@/stores/learningStore";
import { useShellStore } from "@/stores/shellStore";
import { useTutorStore } from "@/stores/tutorStore";
import { useTheme } from "@/hooks/useTheme";
import { findModuleOfLesson, moduleProgressPct, courseProgressPct } from "@/lib/progress";
import UserMenu from "@/components/shell/UserMenu";

type Health = "checking" | "online" | "offline";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function useBackendHealth(): Health {
  const [health, setHealth] = useState<Health>("checking");
  useEffect(() => {
    let cancelled = false;
    const check = () =>
      fetch(`${API_BASE}/health`)
        .then((res) => !cancelled && setHealth(res.ok ? "online" : "offline"))
        .catch(() => !cancelled && setHealth("offline"));
    check();
    const id = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  return health;
}

export default function GlobalHeader() {
  const activeCourse = useLearningStore((s) => s.activeCourse);
  const currentLessonId = useLearningStore((s) => s.currentLessonId);
  const lessonProgress = useLearningStore((s) => s.lessonProgress);
  const setTutorOpen = useShellStore((s) => s.setTutorOpen);
  const setTutorTab = useShellStore((s) => s.setTutorTab);
  const sendMessage = useTutorStore((s) => s.sendMessage);
  const { theme, toggleTheme } = useTheme();
  const health = useBackendHealth();

  const [query, setQuery] = useState("");

  const moduleInfo = findModuleOfLesson(activeCourse, currentLessonId);
  const level = moduleInfo?.level ?? 1;
  const pct = moduleInfo
    ? moduleProgressPct(moduleInfo.module, lessonProgress)
    : courseProgressPct(activeCourse, lessonProgress);

  const healthLabel =
    health === "online" ? "API Online" : health === "offline" ? "API Offline" : "Connecting…";
  const healthDot =
    health === "online" ? "bg-success" : health === "offline" ? "bg-error" : "bg-warning";

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // Route free-text questions to the real AI Tutor (no local mock search).
    setTutorTab("chat");
    setTutorOpen(true);
    void sendMessage(q);
    setQuery("");
  }

  return (
    <header
      role="banner"
      className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-border bg-surface/80 px-3 backdrop-blur-md sm:px-4"
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyber-cyan/10 text-cyber-cyan shadow-glow-cyan">
          <Atom size={22} aria-hidden />
        </div>
        <div className="hidden leading-tight sm:block">
          <div className="text-[15px] font-semibold tracking-tight text-foreground">Q-Learn</div>
          <div className="text-[11px] text-muted-foreground">Quantum Learning Laboratory</div>
        </div>
      </div>

      {/* Global search */}
      <form onSubmit={onSearchSubmit} className="mx-auto flex w-full max-w-xl items-center">
        <div className="relative flex w-full items-center">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 text-muted-foreground"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lessons, concepts, or ask a question…"
            aria-label="Search lessons, concepts, or ask a question"
            className="h-10 w-full rounded-lg border border-border/60 bg-elevated/60 pl-9 pr-12 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-cyber-cyan/70 focus:shadow-glow-cyan"
          />
          <kbd className="pointer-events-none absolute right-3 hidden rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
            ⌘K
          </kbd>
        </div>
      </form>

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
          <span className={`inline-block h-2 w-2 rounded-full ${healthDot}`} aria-hidden />
          {healthLabel}
        </span>

        {/* Level progress */}
        <div className="hidden min-w-[150px] flex-col gap-1 md:flex" aria-label={`Level ${level} progress ${pct}%`}>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Level {level} Progress</span>
            <span className="font-medium text-cyber-cyan">{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyber-cyan to-electric-purple transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title="Toggle theme"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
        >
          {theme === "dark" ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
        </button>

        <UserMenu />
      </div>
    </header>
  );
}
