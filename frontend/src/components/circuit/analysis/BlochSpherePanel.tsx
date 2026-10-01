"use client";

import { useId, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Orbit } from "lucide-react";
import { useCircuitStore } from "@/stores/circuitStore";
import { blochVector, qubitCountFromStatevector, type Amplitude } from "@/lib/quantum-state";
import AnalysisPanel, { PanelEmpty, PanelSelect } from "@/components/circuit/analysis/AnalysisPanel";

// Orthographic camera: azimuth puts +X toward the viewer's lower-left and
// +Y to the lower-right; a small elevation shows the equator as an ellipse.
const AZ = (-40 * Math.PI) / 180;
const EL = (18 * Math.PI) / 180;
const W = 220;
const H = 200;
const CX = W / 2;
const CY = 102;
const R = 70;

type V3 = [number, number, number];

function project([x, y, z]: V3): { sx: number; sy: number; depth: number } {
  const x1 = x * Math.cos(AZ) - y * Math.sin(AZ);
  const y1 = x * Math.sin(AZ) + y * Math.cos(AZ);
  return {
    sx: CX + R * y1,
    sy: CY - R * (z * Math.cos(EL) - x1 * Math.sin(EL)),
    depth: x1 * Math.cos(EL) + z * Math.sin(EL),
  };
}

/** Split a great circle into front (solid) and back (dashed) SVG paths. */
function circlePaths(point: (t: number) => V3): { front: string; back: string } {
  const front: string[] = [];
  const back: string[] = [];
  const N = 96;
  let prev: ReturnType<typeof project> | null = null;
  for (let i = 0; i <= N; i++) {
    const p = project(point((i / N) * Math.PI * 2));
    if (prev) {
      const seg = `M${prev.sx.toFixed(2)},${prev.sy.toFixed(2)}L${p.sx.toFixed(2)},${p.sy.toFixed(2)}`;
      ((prev.depth + p.depth) / 2 >= 0 ? front : back).push(seg);
    }
    prev = p;
  }
  return { front: front.join(""), back: back.join("") };
}

const CIRCLES = [
  circlePaths((t) => [Math.cos(t), Math.sin(t), 0]), // equator
  circlePaths((t) => [Math.cos(t), 0, Math.sin(t)]), // XZ meridian
  circlePaths((t) => [0, Math.cos(t), Math.sin(t)]), // YZ meridian
];

const AXES: { v: V3; label: string }[] = [
  { v: [1, 0, 0], label: "X" },
  { v: [0, 1, 0], label: "Y" },
  { v: [0, 0, 1], label: "Z" },
];

function fmt(v: number) {
  const s = v.toFixed(2);
  return s === "-0.00" ? "0.00" : s;
}

export function BlochSphereSvg({ x, y, z }: { x: number; y: number; z: number }) {
  const gid = useId().replace(/:/g, "");
  const reduceMotion = useReducedMotion();
  const tip = project([x, y, z]);
  const foot = project([x, y, 0]);
  const r = Math.sqrt(x * x + y * y + z * z);
  const transition = reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 140, damping: 18 };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[240px]" role="img" aria-label={`Bloch vector x ${fmt(x)}, y ${fmt(y)}, z ${fmt(z)}`}>
      <defs>
        <radialGradient id={`${gid}-shade`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" style={{ stopColor: "hsl(var(--cyber-cyan) / 0.16)" }} />
          <stop offset="55%" style={{ stopColor: "hsl(var(--electric-purple) / 0.07)" }} />
          <stop offset="100%" style={{ stopColor: "hsl(var(--overlay) / 0.02)" }} />
        </radialGradient>
        <marker id={`${gid}-arrow`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" style={{ fill: "hsl(var(--cyber-cyan))" }} />
        </marker>
      </defs>

      <circle cx={CX} cy={CY} r={R} fill={`url(#${gid}-shade)`} style={{ stroke: "hsl(var(--overlay) / 0.22)" }} />

      {CIRCLES.map((c, i) => (
        <g key={i} fill="none">
          <path d={c.back} strokeDasharray="2 3" style={{ stroke: "hsl(var(--overlay) / 0.14)" }} />
          <path d={c.front} style={{ stroke: "hsl(var(--overlay) / 0.24)" }} />
        </g>
      ))}

      {AXES.map(({ v, label }) => {
        const a = project([-v[0], -v[1], -v[2]]);
        const b = project(v);
        const l = project([v[0] * 1.2, v[1] * 1.2, v[2] * 1.2]);
        return (
          <g key={label}>
            <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} strokeWidth={1} style={{ stroke: "hsl(var(--overlay) / 0.3)" }} />
            <text x={l.sx} y={l.sy + 4} textAnchor="middle" fontSize={11} fontWeight={600} className="fill-muted-foreground">
              {label}
            </text>
          </g>
        );
      })}
      <text x={CX + 8} y={CY - R - 4} fontSize={9} className="fill-muted-foreground font-mono">|0⟩</text>
      <text x={CX + 8} y={CY + R + 11} fontSize={9} className="fill-muted-foreground font-mono">|1⟩</text>

      {r > 1e-3 && (
        <>
          <motion.line
            initial={false}
            animate={{ x1: tip.sx, y1: tip.sy, x2: foot.sx, y2: foot.sy }}
            transition={transition}
            strokeDasharray="2 2"
            style={{ stroke: "hsl(var(--cyber-cyan) / 0.45)" }}
          />
          <motion.line
            initial={false}
            x1={CX}
            y1={CY}
            animate={{ x2: tip.sx, y2: tip.sy }}
            transition={transition}
            strokeWidth={2.5}
            strokeLinecap="round"
            markerEnd={`url(#${gid}-arrow)`}
            style={{ stroke: "hsl(var(--cyber-cyan))" }}
          />
        </>
      )}
      <circle cx={CX} cy={CY} r={2.5} className="fill-foreground" />
    </svg>
  );
}

export default function BlochSpherePanel() {
  const results = useCircuitStore((s) => s.results);
  const runState = useCircuitStore((s) => s.runState);
  const [qubit, setQubit] = useState(0);

  const sv = (results?.statevector ?? null) as Amplitude[] | null;
  const n = sv ? qubitCountFromStatevector(sv) : 0;
  const k = Math.min(qubit, Math.max(n - 1, 0));
  const vec = useMemo(() => (sv && n > 0 ? blochVector(sv, k) : null), [sv, n, k]);

  const options = Array.from({ length: Math.max(n, 1) }, (_, i) => ({ value: i, label: `Qubit ${i}` }));
  const theta = vec ? Math.acos(Math.max(-1, Math.min(1, vec.z / (vec.r || 1)))) / Math.PI : 0;
  const phi = vec && Math.hypot(vec.x, vec.y) > 1e-6 ? Math.atan2(vec.y, vec.x) / Math.PI : 0;

  return (
    <AnalysisPanel
      icon={<Orbit size={14} />}
      title="Bloch Sphere"
      actions={n > 0 && <PanelSelect label="Qubit shown on the Bloch sphere" value={k} options={options} onChange={setQubit} />}
    >
      {!vec ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1">
          <div className={runState === "running" ? "animate-pulse motion-reduce:animate-none" : "opacity-60"}>
            <BlochSphereSvg x={0} y={0} z={1} />
          </div>
          <PanelEmpty>
            {runState === "running" ? "Simulating…" : "Run a simulation to place each qubit on the sphere."}
          </PanelEmpty>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-2">
          <BlochSphereSvg x={vec.x} y={vec.y} z={vec.z} />
          <dl className="grid w-full grid-cols-3 gap-1 font-mono text-[11px]">
            {(["x", "y", "z"] as const).map((key) => (
              <div key={key} className="flex items-center justify-between rounded bg-overlay/[0.03] px-2 py-1">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="tabular-nums text-foreground">{fmt(vec[key])}</dd>
              </div>
            ))}
          </dl>
          {vec.r < 0.99 ? (
            <p className="text-center text-[11px] leading-snug text-warning">
              Mixed state (|r| = {fmt(vec.r)}) — qubit {k} is entangled with the others, so its
              vector sits inside the sphere.
            </p>
          ) : (
            <p className="text-center font-mono text-[11px] text-muted-foreground">
              θ = {fmt(theta)}π · φ = {fmt(phi)}π
            </p>
          )}
        </div>
      )}
    </AnalysisPanel>
  );
}
