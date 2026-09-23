import { cn } from "@/lib/utils";

/**
 * Dashboard-scoped animated Bloch-sphere orbital background.
 * Mount inside a `relative` container — uses `absolute inset-0`, not `fixed`.
 * Three elliptical orbits rotate at different speeds; a particle dot rides each.
 * Animation is suppressed via @media (prefers-reduced-motion: reduce).
 */
export default function QuantumSpinBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden text-cyber-cyan",
        className,
      )}
    >
      <svg
        viewBox="0 0 800 600"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 opacity-[0.07]"
      >
        <style>{`
          @media (prefers-reduced-motion: reduce) {
            .qs-orbit { animation: none !important; }
          }
          .qs-orbit-a {
            animation: qs-cw 14s linear infinite;
            transform-origin: 400px 300px;
          }
          .qs-orbit-b {
            animation: qs-ccw 20s linear infinite;
            transform-origin: 400px 300px;
          }
          .qs-orbit-c {
            animation: qs-cw 28s linear infinite;
            transform-origin: 400px 300px;
          }
          @keyframes qs-cw  { to { transform: rotate(360deg);  } }
          @keyframes qs-ccw { to { transform: rotate(-360deg); } }
        `}</style>

        {/* Nucleus */}
        <circle cx="400" cy="300" r="7" fill="currentColor" opacity="0.9" />
        <circle cx="400" cy="300" r="16" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.4" />

        {/* Inner orbit — tilted 0° */}
        <g className="qs-orbit qs-orbit-a">
          <ellipse cx="400" cy="300" rx="130" ry="52" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="530" cy="300" r="4" fill="currentColor" />
        </g>

        {/* Mid orbit — tilted 60° */}
        <g className="qs-orbit qs-orbit-b" transform="rotate(60, 400, 300)">
          <ellipse cx="400" cy="300" rx="230" ry="88" fill="none" stroke="currentColor" strokeWidth="0.8" />
          <circle cx="630" cy="300" r="5" fill="currentColor" />
        </g>

        {/* Outer orbit — tilted 120° */}
        <g className="qs-orbit qs-orbit-c" transform="rotate(120, 400, 300)">
          <ellipse cx="400" cy="300" rx="330" ry="124" fill="none" stroke="currentColor" strokeWidth="0.6" />
          <circle cx="730" cy="300" r="3.5" fill="currentColor" />
        </g>
      </svg>
    </div>
  );
}
