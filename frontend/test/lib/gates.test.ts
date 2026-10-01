import { describe, it, expect } from "vitest";
import { GATE_LIST, defaultParams, formatAngle, isGateType, isTwoQubitGate, searchGates } from "@/lib/gates";

describe("gate catalog", () => {
  it("has a unique entry with a matrix and description for every gate", () => {
    const types = GATE_LIST.map((g) => g.type);
    expect(new Set(types).size).toBe(types.length);
    for (const g of GATE_LIST) {
      expect(g.matrix.length).toBeGreaterThan(0);
      expect(g.description.length).toBeGreaterThan(0);
    }
  });

  it("classifies two-qubit gates", () => {
    expect(["CX", "CZ", "SWAP", "RXX", "RYY", "RZZ"].every((t) => isTwoQubitGate(t as never))).toBe(true);
    expect(isTwoQubitGate("H")).toBe(false);
  });

  it("validates gate types", () => {
    expect(isGateType("U3")).toBe(true);
    expect(isGateType("FOO")).toBe(false);
  });

  it("provides default params only for parametric gates", () => {
    expect(defaultParams("H")).toBeUndefined();
    expect(defaultParams("U")).toEqual({ theta: Math.PI / 2, phi: 0, lambda: 0 });
  });

  it("searches by symbol, name, description and keywords", () => {
    expect(searchGates("hadamard").map((g) => g.type)).toEqual(["H"]);
    expect(searchGates("ising").map((g) => g.type)).toEqual(["RXX", "RYY", "RZZ"]);
    expect(searchGates("").length).toBe(GATE_LIST.length);
  });
});

describe("formatAngle", () => {
  it("renders common multiples of π symbolically", () => {
    expect(formatAngle(Math.PI / 4)).toBe("π/4");
    expect(formatAngle(-Math.PI / 2)).toBe("−π/2");
    expect(formatAngle(3 * Math.PI / 4)).toBe("3π/4");
    expect(formatAngle(Math.PI)).toBe("π");
    expect(formatAngle(0)).toBe("0");
    expect(formatAngle(0.3)).toBe("0.30");
  });
});
