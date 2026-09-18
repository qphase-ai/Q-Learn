import { cn } from "@/lib/utils";

/**
 * Soft blurred SVG color-blob mesh (cyan/purple/green). Usage: mount inside
 * a `relative`-positioned container it should fill (`absolute inset-0`) —
 * intended for per-page/per-section use, not a single layout-wide mount.
 */
export default function MeshGradient({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <style>{`
        @keyframes mesh-drift-a { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(6%, -4%); } }
        @keyframes mesh-drift-b { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-5%, 5%); } }
        @keyframes mesh-drift-c { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(4%, 6%); } }
        @keyframes mesh-drift-d { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-6%, -3%); } }
      `}</style>
      <svg className="h-full w-full" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="mesh-gradient-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="70" />
          </filter>
        </defs>
        <circle
          cx="180"
          cy="160"
          r="220"
          fill="#00F0FF"
          opacity="0.18"
          filter="url(#mesh-gradient-blur)"
          className="origin-center animate-[mesh-drift-a_16s_ease-in-out_infinite] motion-reduce:animate-none"
        />
        <circle
          cx="620"
          cy="180"
          r="200"
          fill="#B026FF"
          opacity="0.2"
          filter="url(#mesh-gradient-blur)"
          className="origin-center animate-[mesh-drift-b_20s_ease-in-out_infinite] motion-reduce:animate-none"
        />
        <circle
          cx="260"
          cy="440"
          r="200"
          fill="#39FF14"
          opacity="0.14"
          filter="url(#mesh-gradient-blur)"
          className="origin-center animate-[mesh-drift-c_18s_ease-in-out_infinite] motion-reduce:animate-none"
        />
        <circle
          cx="600"
          cy="460"
          r="180"
          fill="#00F0FF"
          opacity="0.12"
          filter="url(#mesh-gradient-blur)"
          className="origin-center animate-[mesh-drift-d_22s_ease-in-out_infinite] motion-reduce:animate-none"
        />
      </svg>
    </div>
  );
}
