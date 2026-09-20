/**
 * Static H–CNOT–Measure circuit diagram using circuit palette token colors.
 * Gate colors: H=#8b5cf6, CX=#3b82f6, M=#00d4ff (from globals.css CIRCUIT PALETTE).
 */
export function HeroCircuitSVG() {
  return (
    <svg
      viewBox="0 0 420 160"
      aria-label="Quantum circuit diagram: Hadamard gate, CNOT, and Measurement"
      role="img"
      className="w-full max-w-md"
    >
      {/* Qubit labels */}
      <text x="8" y="65" fill="rgba(255,255,255,0.5)" fontSize="13" fontFamily="monospace">
        q₀
      </text>
      <text x="8" y="125" fill="rgba(255,255,255,0.5)" fontSize="13" fontFamily="monospace">
        q₁
      </text>

      {/* Qubit wires */}
      <line x1="36" y1="60" x2="400" y2="60" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      <line x1="36" y1="120" x2="400" y2="120" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

      {/* H gate — q0 at x=70 */}
      <rect x="60" y="40" width="40" height="40" rx="6" fill="#8b5cf6" />
      <text x="80" y="65" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="monospace">
        H
      </text>

      {/* CNOT at x=180 */}
      {/* Control dot */}
      <circle cx="180" cy="60" r="7" fill="#3b82f6" />
      {/* Vertical line */}
      <line x1="180" y1="67" x2="180" y2="106" stroke="#3b82f6" strokeWidth="2" />
      {/* Target ⊕ */}
      <circle cx="180" cy="120" r="14" stroke="#3b82f6" strokeWidth="2" fill="none" />
      <line x1="180" y1="106" x2="180" y2="134" stroke="#3b82f6" strokeWidth="2" />
      <line x1="166" y1="120" x2="194" y2="120" stroke="#3b82f6" strokeWidth="2" />

      {/* Measure gates at x=300 */}
      <rect x="290" y="40" width="44" height="40" rx="6" fill="#00d4ff" className="animate-pulse motion-reduce:animate-none" style={{ animationDuration: "2.5s" }} />
      <text x="312" y="58" textAnchor="middle" fill="#050505" fontSize="11" fontWeight="bold" fontFamily="monospace">
        M
      </text>
      {/* Meter arc inside M gate q0 */}
      <path d="M 297 72 Q 312 60 327 72" stroke="#050505" strokeWidth="1.5" fill="none" />

      <rect x="290" y="100" width="44" height="40" rx="6" fill="#00d4ff" className="animate-pulse motion-reduce:animate-none" style={{ animationDuration: "2.5s", animationDelay: "0.4s" }} />
      <text x="312" y="118" textAnchor="middle" fill="#050505" fontSize="11" fontWeight="bold" fontFamily="monospace">
        M
      </text>
      <path d="M 297 132 Q 312 120 327 132" stroke="#050505" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
