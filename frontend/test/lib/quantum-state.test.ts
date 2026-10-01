import { describe, it, expect } from "vitest";
import {
  basisLabel,
  blochVector,
  formatComplex,
  formatPolar,
  ketExpression,
  type Amplitude,
} from "@/lib/quantum-state";

const s = Math.SQRT1_2;

describe("blochVector", () => {
  it("|0⟩ points to +Z, |1⟩ to −Z", () => {
    expect(blochVector([[1, 0], [0, 0]], 0)).toMatchObject({ x: 0, y: 0, z: 1, r: 1 });
    expect(blochVector([[0, 0], [1, 0]], 0).z).toBe(-1);
  });

  it("|+⟩ points to +X and |i⟩ to +Y", () => {
    const plus = blochVector([[s, 0], [s, 0]], 0);
    expect(plus.x).toBeCloseTo(1);
    expect(plus.z).toBeCloseTo(0);
    const i = blochVector([[s, 0], [0, s]], 0);
    expect(i.y).toBeCloseTo(1);
    expect(i.x).toBeCloseTo(0);
  });

  it("a Bell state gives each qubit a zero-length (maximally mixed) vector", () => {
    const bell: Amplitude[] = [[s, 0], [0, 0], [0, 0], [s, 0]];
    expect(blochVector(bell, 0).r).toBeCloseTo(0);
    expect(blochVector(bell, 1).r).toBeCloseTo(0);
  });

  it("reads qubit k from bit k (little-endian)", () => {
    // |q1 q0⟩ = |10⟩ → index 2: q1 = 1, q0 = 0
    const sv: Amplitude[] = [[0, 0], [0, 0], [1, 0], [0, 0]];
    expect(blochVector(sv, 0).z).toBe(1);
    expect(blochVector(sv, 1).z).toBe(-1);
  });
});

describe("formatting", () => {
  it("labels basis states with leading zeros", () => {
    expect(basisLabel(1, 3)).toBe("001");
  });

  it("formats complex amplitudes without negative zero", () => {
    expect(formatComplex([s, 0])).toBe("0.7071 + 0.0000i");
    expect(formatComplex([-0.00001, -0.5])).toBe("0.0000 − 0.5000i");
  });

  it("formats polar amplitudes in units of π", () => {
    expect(formatPolar([0, 1])).toBe("1.0000 ∠ 0.50π");
  });

  it("builds a ket expansion skipping negligible terms", () => {
    expect(ketExpression([[s, 0], [0, 0], [0, 0], [s, 0]])).toBe("0.707|00⟩ + 0.707|11⟩");
    expect(ketExpression([[s, 0], [-s, 0]])).toBe("0.707|0⟩ − 0.707|1⟩");
  });
});
