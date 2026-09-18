import { cn } from "@/lib/utils";

/**
 * Static faint grid, radially masked to fade out toward the edges. Usage:
 * mount once near the root of a persistent shell/layout — it is `fixed
 * inset-0`, so a single instance covers the whole viewport.
 */
export default function GridBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10",
        "bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]",
        className,
      )}
      style={{
        maskImage: "radial-gradient(ellipse at center, black 0%, transparent 70%)",
        WebkitMaskImage: "radial-gradient(ellipse at center, black 0%, transparent 70%)",
      }}
    />
  );
}
