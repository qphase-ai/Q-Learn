export function ProbabilityMockSVG() {
  return (
    <svg
      viewBox="0 0 280 110"
      aria-label="Probability chart: |00⟩ 50%, |11⟩ 50%"
      role="img"
      className="w-full max-w-xs"
    >
      {/* |00⟩ label */}
      <text x="8" y="32" className="fill-overlay/60" fontSize="11" fontFamily="monospace">
        |00⟩
      </text>
      {/* |00⟩ bar background */}
      <rect x="48" y="18" width="200" height="20" rx="4" className="fill-overlay/5" />
      {/* |00⟩ bar fill */}
      <rect x="48" y="18" width="100" height="20" rx="4" fill="#00d4ff" opacity="0.7" />
      {/* |00⟩ percentage */}
      <text x="156" y="32" className="fill-overlay/80" fontSize="11" fontFamily="monospace">
        50%
      </text>

      {/* |11⟩ label */}
      <text x="8" y="82" className="fill-overlay/60" fontSize="11" fontFamily="monospace">
        |11⟩
      </text>
      {/* |11⟩ bar background */}
      <rect x="48" y="68" width="200" height="20" rx="4" className="fill-overlay/5" />
      {/* |11⟩ bar fill */}
      <rect x="48" y="68" width="100" height="20" rx="4" fill="#B026FF" opacity="0.7" />
      {/* |11⟩ percentage */}
      <text x="156" y="82" className="fill-overlay/80" fontSize="11" fontFamily="monospace">
        50%
      </text>

      {/* x-axis tick marks */}
      {[0, 25, 50, 75, 100].map((pct) => (
        <g key={pct}>
          <line
            x1={48 + pct * 2}
            y1="95"
            x2={48 + pct * 2}
            y2="100"
            className="stroke-overlay/20"
            strokeWidth="1"
          />
          <text
            x={48 + pct * 2}
            y="108"
            textAnchor="middle"
            className="fill-overlay/30"
            fontSize="9"
            fontFamily="monospace"
          >
            {pct}%
          </text>
        </g>
      ))}
    </svg>
  );
}
