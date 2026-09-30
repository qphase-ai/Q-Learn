"use client";

import { Atom, Search, ChevronDown, LogOut } from "lucide-react";
import { useLearningStore } from "@/stores/learningStore";
import { useAuthStore } from "@/stores/authStore";
import { useAuth } from "@/hooks/useAuth";
import { useApiHealth } from "@/hooks/useApiHealth";
import {
  findModuleIndexForLesson,
  levelLabel,
  moduleCompletion,
  sortedModules,
} from "@/lib/curriculum";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function DashboardHeader() {
  const activeCourse = useLearningStore((s) => s.activeCourse);
  const currentLessonId = useLearningStore((s) => s.currentLessonId);
  const lessonProgress = useLearningStore((s) => s.lessonProgress);
  const user = useAuthStore((s) => s.user);
  const health = useApiHealth();
  const { logout } = useAuth();

  const modules = activeCourse ? sortedModules(activeCourse) : [];
  const moduleIndex = findModuleIndexForLesson(modules, currentLessonId);
  const activeModule = moduleIndex >= 0 ? modules[moduleIndex] : null;
  const { done, total } = activeModule
    ? moduleCompletion(activeModule, lessonProgress)
    : { done: 0, total: 0 };
  const levelPct = total > 0 ? Math.round((done / total) * 100) : 0;

  const initial = (user?.email ?? "S").charAt(0).toUpperCase();

  return (
    <header className="flex h-14 flex-shrink-0 items-center gap-4 border-b border-overlay/10 bg-surface px-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyber-cyan/20 to-electric-purple/20">
          <Atom size={18} className="text-cyber-cyan" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">Q-Learn</p>
          <p className="text-[11px] text-muted-foreground">Quantum Learning Laboratory</p>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-md items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-overlay/10 bg-overlay/[0.02] px-3 text-sm text-muted-foreground">
              <Search size={15} aria-hidden />
              <input
                type="text"
                disabled
                placeholder="Search lessons, concepts, or ask a question…"
                aria-label="Search (coming soon)"
                className="w-full flex-1 bg-transparent text-sm text-muted-foreground placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed"
              />
              <kbd className="rounded border border-overlay/10 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </div>
          </TooltipTrigger>
          <TooltipContent>Search coming soon</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-shrink-0 items-center gap-4">
        <span
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          aria-label={`Backend status: ${health}`}
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              health === "online"
                ? "bg-success"
                : health === "offline"
                  ? "bg-error"
                  : "bg-warning"
            }`}
            aria-hidden
          />
          API {health === "online" ? "Online" : health === "offline" ? "Offline" : "Checking"}
        </span>

        {activeModule && (
          <div className="flex w-36 flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{levelLabel(moduleIndex)} Progress</span>
              <span>{levelPct}%</span>
            </div>
            <Progress
              value={levelPct}
              className="[&>*]:bg-electric-purple [&>*]:shadow-glow-purple"
              aria-label={`${levelLabel(moduleIndex)} progress`}
            />
          </div>
        )}

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 outline-none hover:bg-overlay/5">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">{initial}</AvatarFallback>
            </Avatar>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-xs font-medium text-foreground">
                {user?.email ?? "Student"}
              </span>
              <span className="block text-[10px] text-muted-foreground">Free Plan</span>
            </span>
            <ChevronDown size={14} className="text-muted-foreground" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.email ?? "Student"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void logout()}>
              <LogOut size={14} className="mr-2" aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
