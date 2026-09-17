"use client";

import { useCircuitStore } from "@/stores/circuitStore";

interface Row {
  label: string;
  amplitude: string;
  probability: string;
  phase: string;
}

export default function StateVectorTable() {
  const results = useCircuitStore((s) => s.results);

  if (!results || (!results.statevector && !results.probabilities)) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Run a circuit to see results.
      </p>
    );
  }

  let rows: Row[] = [];

  if (results.statevector) {
    const sv = results.statevector;
    const nBits = Math.round(Math.log2(sv.length));
    rows = sv.map(([re, im], i) => {
      const amp = Math.hypot(re, im);
      const prob = amp * amp;
      const label = `|${i.toString(2).padStart(nBits, "0")}⟩`;
      const amplitude = amp.toFixed(3);
      const probability = `${Math.round(prob * 100)}%`;
      const phase =
        amp < 1e-6
          ? "—"
          : `${Math.round((Math.atan2(im, re) * 180) / Math.PI)}°`;
      return { label, amplitude, probability, phase };
    });
  } else if (results.probabilities) {
    const sorted = Object.entries(results.probabilities).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    rows = sorted.map(([key, prob]) => ({
      label: `|${key}⟩`,
      amplitude: Math.sqrt(prob).toFixed(3),
      probability: `${Math.round(prob * 100)}%`,
      phase: "—",
    }));
  }

  return (
    <div className="w-full overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["State", "Amplitude", "Probability", "Phase"].map((h) => (
              <th
                key={h}
                className="text-left py-1 px-2 font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={idx}
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <td className="py-1 px-2 font-mono" style={{ color: "var(--quantum)" }}>
                {row.label}
              </td>
              <td className="py-1 px-2 font-mono" style={{ color: "var(--text-primary)" }}>
                {row.amplitude}
              </td>
              <td className="py-1 px-2" style={{ color: "var(--text-primary)" }}>
                {row.probability}
              </td>
              <td className="py-1 px-2" style={{ color: "var(--text-secondary)" }}>
                {row.phase}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
