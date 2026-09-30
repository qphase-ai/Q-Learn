"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CircuitBoard,
  Code2,
  ListChecks,
  BarChart3,
  Sparkles,
  Crown,
  FileText,
  MessageSquareWarning,
  Settings,
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  disabledHint?: string;
}

export default function DashboardActivityBar({
  onOpenTutor,
  dim = false,
}: {
  onOpenTutor?: () => void;
  dim?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const isActive = (href?: string) =>
    !!href && (pathname === href || pathname.startsWith(`${href}/`));

  const navItems: NavItem[] = [
    { label: "Learn", icon: BookOpen, href: "/learn" },
    { label: "Circuits", icon: CircuitBoard, href: "/circuit" },
    { label: "Code", icon: Code2, href: "/code" },
    { label: "Practice", icon: ListChecks, href: "/quiz" },
    { label: "Progress", icon: BarChart3, href: "/progress" },
    { label: "AI Tutor", icon: Sparkles, onClick: onOpenTutor },
  ];

  const utilityItems: NavItem[] = [
    { label: "Docs", icon: FileText, href: "/docs" },
    { label: "Feedback", icon: MessageSquareWarning, href: "/feedback" },
    { label: "Settings", icon: Settings, href: "/settings" },
  ];

  return (
    <nav
      aria-label="Dashboard navigation"
      className={`flex w-[68px] flex-shrink-0 flex-col items-center gap-1 border-r border-overlay/10 bg-surface py-3 transition-opacity ${
        dim ? "opacity-30" : ""
      }`}
    >
      <div className="flex flex-col items-center gap-1">
        {navItems.map((item) => (
          <NavButton key={item.label} item={item} isActive={isActive(item.href)} />
        ))}
      </div>

      <Link
        href="/pricing"
        aria-label="Upgrade"
        aria-current={isActive("/pricing") ? "page" : undefined}
        title="Upgrade to Pro"
        className="mt-auto flex w-14 flex-col items-center gap-1 rounded-lg border border-warning/30 bg-gradient-to-b from-warning/15 to-transparent px-1 py-2 text-[10px] font-medium text-warning transition-colors hover:from-warning/25"
      >
        <Crown size={16} aria-hidden />
        Upgrade
      </Link>

      <div className="mt-2 flex flex-col items-center gap-1">
        {utilityItems.map((item) => (
          <NavButton key={item.label} item={item} isActive={isActive(item.href)} />
        ))}
      </div>
    </nav>
  );
}

function NavButton({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  const content = (
    <span
      className={`flex h-11 w-14 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium transition-colors ${
        isActive
          ? "bg-electric-purple/15 text-electric-purple"
          : "text-muted-foreground hover:bg-overlay/5 hover:text-foreground"
      }`}
    >
      <Icon size={17} aria-hidden />
      {item.label}
    </span>
  );

  if (item.href) {
    return (
      <Link href={item.href} aria-label={item.label} aria-current={isActive ? "page" : undefined}>
        {content}
      </Link>
    );
  }

  if (item.onClick) {
    return (
      <button type="button" aria-label={item.label} onClick={item.onClick}>
        {content}
      </button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={item.label} disabled className="cursor-not-allowed opacity-60">
          {content}
        </button>
      </TooltipTrigger>
      <TooltipContent>{item.disabledHint}</TooltipContent>
    </Tooltip>
  );
}
