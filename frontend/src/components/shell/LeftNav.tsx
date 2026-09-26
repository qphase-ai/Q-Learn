"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  CircuitBoard,
  Target,
  BarChart3,
  Sparkles,
  Crown,
  FileText,
  MessageSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useShellStore } from "@/stores/shellStore";

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  match?: string[];
  onClick?: () => void;
}

export default function LeftNav() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const toggleTutor = useShellStore((s) => s.toggleTutor);
  const setLessonTab = useShellStore((s) => s.setLessonTab);

  const primary: NavItem[] = [
    { id: "learn", label: "Learn", icon: BookOpen, href: "/learn", match: ["/learn"] },
    { id: "circuits", label: "Circuits", icon: CircuitBoard, href: "/circuit", match: ["/circuit"] },
    {
      id: "practice",
      label: "Practice",
      icon: Target,
      onClick: () => {
        setLessonTab("practice");
        router.push("/learn");
      },
    },
    { id: "progress", label: "Progress", icon: BarChart3, href: "/dashboard", match: ["/dashboard"] },
    { id: "tutor", label: "AI Tutor", icon: Sparkles, onClick: toggleTutor },
  ];

  const secondary: NavItem[] = [
    {
      id: "upgrade",
      label: "Upgrade",
      icon: Crown,
      onClick: () => router.push("/#pricing"),
    },
    {
      id: "docs",
      label: "Docs",
      icon: FileText,
      onClick: () => toast.info("Documentation opens in the docs workspace (coming soon)."),
    },
    {
      id: "feedback",
      label: "Feedback",
      icon: MessageSquare,
      onClick: () => toast.info("Thanks! Feedback collection is coming soon."),
    },
    { id: "settings", label: "Settings", icon: Settings, href: "/settings", match: ["/settings"] },
  ];

  const isActive = (item: NavItem) =>
    item.match?.some((m) => pathname === m || pathname.startsWith(`${m}/`)) ?? false;

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item);
    const className = `group flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium outline-none transition-colors ${
      active
        ? "bg-cyber-cyan/10 text-cyber-cyan"
        : "text-muted-foreground hover:bg-elevated hover:text-foreground"
    }`;
    const inner = (
      <>
        <Icon size={20} aria-hidden />
        <span className="leading-none">{item.label}</span>
      </>
    );
    if (item.href) {
      return (
        <Link key={item.id} href={item.href} aria-current={active ? "page" : undefined} className={className}>
          {inner}
        </Link>
      );
    }
    return (
      <button key={item.id} type="button" onClick={item.onClick} className={className}>
        {inner}
      </button>
    );
  };

  return (
    <nav
      aria-label="Primary navigation"
      className="flex w-[76px] flex-shrink-0 flex-col items-stretch gap-1 border-r border-border bg-surface px-2 py-3"
    >
      <div className="flex flex-col gap-1">{primary.map(renderItem)}</div>
      <div className="mt-auto flex flex-col gap-1 border-t border-border pt-2">
        {secondary.map(renderItem)}
      </div>
    </nav>
  );
}
