import { cn } from "@/lib/utils";

// Compact fractal-noise SVG, inlined as a data URI (standard grain technique).
const NOISE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
  <filter id='n'>
    <feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>
    <feColorMatrix type='saturate' values='0'/>
  </filter>
  <rect width='100%' height='100%' filter='url(#n)'/>
</svg>`;

const NOISE_DATA_URI = `url("data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}")`;

/**
 * Subtle film-grain texture layer. Usage: mount once near the root of a
 * persistent shell/layout — it is `fixed inset-0`, so a single instance
 * covers the whole viewport.
 */
export default function NoiseOverlay({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 mix-blend-overlay opacity-[0.04]",
        className,
      )}
      style={{ backgroundImage: NOISE_DATA_URI }}
    />
  );
}
