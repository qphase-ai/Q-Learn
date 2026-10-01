// ---------------------------------------------------------------------------
// Pure helpers for reading a simulated statevector. The backend returns the
// statevector as [re, im] pairs in Qiskit's little-endian order: amplitude
// index i has qubit k's value in bit k, and its label is written q_{n-1}…q_0
// — the same convention Qiskit uses for measurement count keys.
// ---------------------------------------------------------------------------

export type Amplitude = [number, number];

export function qubitCountFromStatevector(sv: readonly Amplitude[]): number {
  return sv.length > 0 ? Math.round(Math.log2(sv.length)) : 0;
}

/** Basis-state label for amplitude index `i` of an `n`-qubit register. */
export function basisLabel(i: number, n: number): string {
  return i.toString(2).padStart(Math.max(n, 1), "0");
}

export interface BlochVector {
  x: number;
  y: number;
  z: number;
  /** Length of the vector: 1 for a pure single-qubit state, < 1 when entangled. */
  r: number;
}

/**
 * Bloch vector of qubit `k` from the full statevector, via the reduced density
 * matrix ρ = Tr_{others}(|ψ⟩⟨ψ|):  x = 2·Re ρ₀₁,  y = −2·Im ρ₀₁,  z = ρ₀₀ − ρ₁₁.
 */
export function blochVector(sv: readonly Amplitude[], k: number): BlochVector {
  let p0 = 0;
  let p1 = 0;
  let re01 = 0;
  let im01 = 0;
  const bit = 1 << k;
  for (let i = 0; i < sv.length; i++) {
    if (i & bit) continue;
    const [ar, ai] = sv[i];
    const [br, bi] = sv[i | bit] ?? [0, 0];
    p0 += ar * ar + ai * ai;
    p1 += br * br + bi * bi;
    // ρ₀₁ += a · conj(b)
    re01 += ar * br + ai * bi;
    im01 += ai * br - ar * bi;
  }
  // "+ 0" normalises -0 so callers never see a signed zero.
  const x = 2 * re01 + 0;
  const y = -2 * im01 + 0;
  const z = p0 - p1 + 0;
  return { x, y, z, r: Math.sqrt(x * x + y * y + z * z) };
}

export function probability([re, im]: Amplitude): number {
  return re * re + im * im;
}

function fixed(v: number, digits: number): string {
  // Avoid "-0.0000".
  const s = v.toFixed(digits);
  return /^-0\.?0*$/.test(s) ? s.slice(1) : s;
}

/** "0.7071 + 0.0000i" */
export function formatComplex([re, im]: Amplitude, digits = 4): string {
  const sign = im < 0 && fixed(im, digits) !== fixed(0, digits) ? "−" : "+";
  return `${fixed(re, digits)} ${sign} ${fixed(Math.abs(im), digits)}i`;
}

/** "0.7071 ∠ 0.25π" — magnitude and phase in units of π. */
export function formatPolar([re, im]: Amplitude, digits = 4): string {
  const mag = Math.hypot(re, im);
  const phase = mag < 1e-9 ? 0 : Math.atan2(im, re) / Math.PI;
  return `${fixed(mag, digits)} ∠ ${fixed(phase, 2)}π`;
}

/**
 * Compact ket expansion, e.g. "0.707|00⟩ + 0.707|11⟩". Terms with negligible
 * probability are dropped; complex coefficients are shown in parentheses.
 */
export function ketExpression(sv: readonly Amplitude[], maxTerms = 4): string {
  const n = qubitCountFromStatevector(sv);
  const terms: string[] = [];
  let hidden = 0;
  sv.forEach((amp, i) => {
    if (probability(amp) < 1e-6) return;
    if (terms.length >= maxTerms) {
      hidden++;
      return;
    }
    const [re, im] = amp;
    let coef: string;
    if (Math.abs(im) < 1e-6) coef = fixed(re, 3);
    else if (Math.abs(re) < 1e-6) coef = `${fixed(im, 3)}i`;
    else coef = `(${fixed(re, 3)}${im < 0 ? "−" : "+"}${fixed(Math.abs(im), 3)}i)`;
    terms.push(`${coef}|${basisLabel(i, n)}⟩`);
  });
  if (terms.length === 0) return "0";
  let expr = terms.join(" + ").replace(/\+ -/g, "− ");
  if (hidden > 0) expr += ` + … (${hidden} more)`;
  return expr;
}
