"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCircuitStore } from "@/stores/circuitStore";

/**
 * Approximate, illustrative Bloch-sphere-style visualization — NOT a
 * physically rigorous projection. A true Bloch sphere is only well-defined
 * for a single qubit; for an entangled multi-qubit state there is no single
 * point on a sphere that represents the joint state, and the backend result
 * payload carries no per-qubit (x, y, z) coordinates. This renders each
 * basis outcome from `results.probabilities` at a deterministic pseudo
 * position (hashed from the bitstring) around a static wireframe sphere,
 * sized/opacity-weighted by probability, purely to give a visual sense of
 * "the state is spread across these outcomes" — do not read exact angles
 * off this as physics.
 */

const PALETTE = ["#B026FF", "#00F0FF", "#39FF14", "#f97316", "#f85149"];

function angleForBitstring(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return (hash % 360) * (Math.PI / 180);
}

export default function StateSphereVisualization() {
  const results = useCircuitStore((s) => s.results);
  const shouldReduceMotion = useReducedMotion();

  const probabilities = results?.probabilities
    ? Object.entries(results.probabilities)
        .filter(([, p]) => p > 0.01)
        .sort(([a], [b]) => a.localeCompare(b))
    : [];

  const cx = 100;
  const cy = 100;
  const r = 70;

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.svg
        role="img"
        aria-label="Illustrative quantum state sphere"
        viewBox="0 0 200 200"
        width="180"
        height="180"
        animate={shouldReduceMotion ? undefined : { rotate: 360 }}
        transition={
          shouldReduceMotion ? undefined : { duration: 40, repeat: Infinity, ease: "linear" }
        }
        style={{ transformOrigin: "100px 100px" }}
      >
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--wire)" strokeOpacity={0.35} />
        <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.32} fill="none" stroke="var(--wire)" strokeOpacity={0.35} />
        <ellipse cx={cx} cy={cy} rx={r * 0.32} ry={r} fill="none" stroke="var(--wire)" strokeOpacity={0.35} />
        <line x1={cx - r - 10} y1={cy} x2={cx + r + 10} y2={cy} stroke="var(--wire)" strokeOpacity={0.5} />
        <line x1={cx} y1={cy - r - 10} x2={cx} y2={cy + r + 10} stroke="var(--wire)" strokeOpacity={0.5} />
        <line
          x1={cx - (r + 10) * 0.6}
          y1={cy + (r + 10) * 0.6}
          x2={cx + (r + 10) * 0.6}
          y2={cy - (r + 10) * 0.6}
          stroke="var(--wire)"
          strokeOpacity={0.5}
        />
        <text x={cx + r + 12} y={cy + 4} fontSize="10" fill="var(--text-secondary)">x</text>
        <text x={cx - 6} y={cy - r - 14} fontSize="10" fill="var(--text-secondary)">z</text>
        <text
          x={cx + (r + 10) * 0.6 + 4}
          y={cy - (r + 10) * 0.6}
          fontSize="10"
          fill="var(--text-secondary)"
        >
          y
        </text>

        {probabilities.map(([key, prob], i) => {
          const angle = angleForBitstring(key);
          const mr = r * 0.9;
          const x = cx + mr * Math.cos(angle);
          const y = cy + mr * 0.45 * Math.sin(angle);
          const color = PALETTE[i % PALETTE.length];
          return (
            <circle
              key={key}
              cx={x}
              cy={y}
              r={4 + prob * 8}
              fill={color}
              opacity={0.5 + prob * 0.5}
            />
          );
        })}
      </motion.svg>

      {probabilities.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {probabilities.map(([key, prob], i) => (
            <span
              key={key}
              className="flex items-center gap-1.5 rounded-full bg-white/[0.03] px-2 py-0.5 text-xs text-foreground"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: PALETTE[i % PALETTE.length] }}
                aria-hidden
              />
              |{key}⟩ ({prob.toFixed(2)})
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Run a simulation to see the state.</p>
      )}
    </div>
  );
}
