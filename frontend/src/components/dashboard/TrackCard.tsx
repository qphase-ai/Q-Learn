import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface TrackCardProps {
  title: string;
  icon: LucideIcon;
  href: string;
  accentClass: string;
  borderClass: string;
  completedLessons: number;
  masteryPct: number;
}

export default function TrackCard({
  title,
  icon: Icon,
  href,
  accentClass,
  borderClass,
  completedLessons,
  masteryPct,
}: TrackCardProps) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-xl border bg-surface p-5 transition-colors ${borderClass}`}
    >
      <div className="flex items-center gap-3">
        <Icon size={24} className={accentClass} aria-hidden />
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <p className="text-2xl font-bold text-foreground">{masteryPct}%</p>
          <p className="text-xs text-muted-foreground">mastery</p>
        </div>
        <div className="space-y-1 text-right">
          <p className="text-2xl font-bold text-foreground">{completedLessons}</p>
          <p className="text-xs text-muted-foreground">lessons completed</p>
        </div>
      </div>
      <Link
        href={href}
        aria-label={`Launch ${title}`}
        className={`block rounded-lg border px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-white/[0.04] ${accentClass} ${borderClass}`}
      >
        Launch
      </Link>
    </div>
  );
}
