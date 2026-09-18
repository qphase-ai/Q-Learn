import { cn } from "@/lib/utils";

interface Orb {
  colorClass: string;
  size: string;
  position: string;
  opacity: string;
  delay: string;
  duration: string;
}

// Staggered delay/duration per orb (inline style, since Tailwind can't
// express per-instance animation-delay) so the float cycles don't sync up.
const ORBS: Orb[] = [
  {
    colorClass: "bg-cyber-cyan",
    size: "h-[320px] w-[320px]",
    position: "-top-24 -left-20",
    opacity: "opacity-20",
    delay: "0s",
    duration: "5s",
  },
  {
    colorClass: "bg-electric-purple",
    size: "h-[360px] w-[360px]",
    position: "-top-16 right-[-10%]",
    opacity: "opacity-[0.18]",
    delay: "1.2s",
    duration: "6s",
  },
  {
    colorClass: "bg-neon-green",
    size: "h-[280px] w-[280px]",
    position: "bottom-[-15%] left-[10%]",
    opacity: "opacity-[0.12]",
    delay: "0.6s",
    duration: "4.5s",
  },
  {
    colorClass: "bg-electric-purple",
    size: "h-[240px] w-[240px]",
    position: "bottom-[-10%] right-[8%]",
    opacity: "opacity-[0.14]",
    delay: "2s",
    duration: "5.5s",
  },
  {
    colorClass: "bg-cyber-cyan",
    size: "h-[200px] w-[200px]",
    position: "top-[35%] left-[45%]",
    opacity: "opacity-10",
    delay: "1.6s",
    duration: "7s",
  },
];

/**
 * 3-5 large blurred floating orbs, one per accent color. Usage: mount
 * inside a `relative`-positioned container it should fill (`absolute
 * inset-0`) — per-page/per-section (e.g. alongside AuroraBackground on
 * marketing/auth surfaces), not a single layout-wide mount.
 */
export default function GlowingOrbs({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {ORBS.map((orb, i) => (
        <div
          key={i}
          className={cn(
            "absolute animate-float rounded-full blur-3xl motion-reduce:animate-none",
            orb.colorClass,
            orb.size,
            orb.position,
            orb.opacity,
          )}
          style={{ animationDelay: orb.delay, animationDuration: orb.duration }}
        />
      ))}
    </div>
  );
}
