import { cn } from "@/lib/utils";

/**
 * Slow-moving cyan/purple/green color wash over the near-black base.
 * Usage: mount once near the root of a marketing/auth surface (e.g. a page
 * or a layout) — it is `fixed inset-0`, so a single instance covers the
 * whole viewport regardless of where it is mounted in the tree.
 */
export default function AuroraBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background",
        className,
      )}
    >
      <div
        className="absolute -inset-[20%] animate-aurora blur-3xl motion-reduce:animate-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(0,240,255,0.22), transparent 45%), " +
            "radial-gradient(circle at 80% 25%, rgba(176,38,255,0.20), transparent 45%), " +
            "radial-gradient(circle at 50% 85%, rgba(57,255,20,0.16), transparent 45%)",
          backgroundSize: "220% 220%",
        }}
      />
      <div
        className="absolute -inset-[20%] animate-aurora blur-3xl motion-reduce:animate-none"
        style={{
          backgroundImage:
            "conic-gradient(from 90deg at 50% 50%, rgba(176,38,255,0.14), rgba(0,240,255,0.14), rgba(57,255,20,0.12), rgba(176,38,255,0.14))",
          backgroundSize: "260% 260%",
          opacity: 0.7,
        }}
      />
    </div>
  );
}
