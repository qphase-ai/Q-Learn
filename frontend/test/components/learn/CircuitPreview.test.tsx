import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CircuitPreview from "@/components/learn/CircuitPreview";

const spec = {
  qubits: 2,
  gates: [
    { type: "H", targets: [0] },
    { type: "CX", targets: [1], control: 0 },
    { type: "M", targets: [0] },
    { type: "M", targets: [1] },
  ],
};

describe("CircuitPreview", () => {
  it("renders an SVG with testid circuit-preview", () => {
    render(<CircuitPreview spec={spec} />);
    expect(screen.getByTestId("circuit-preview")).toBeInTheDocument();
  });

  it("renders one wire line per qubit (2 wires for 2 qubits)", () => {
    render(<CircuitPreview spec={spec} />);
    const wires = screen.getAllByTestId(/^wire-/);
    expect(wires).toHaveLength(2);
  });

  it("renders H gate label", () => {
    render(<CircuitPreview spec={spec} />);
    expect(screen.getByText("H")).toBeInTheDocument();
  });

  it("renders CX gate label", () => {
    render(<CircuitPreview spec={spec} />);
    expect(screen.getAllByText("CX").length).toBeGreaterThanOrEqual(1);
  });

  it("renders M gate labels", () => {
    render(<CircuitPreview spec={spec} />);
    expect(screen.getAllByText("M").length).toBeGreaterThanOrEqual(2);
  });

  it("uses CSS token var(--wire) on wire elements", () => {
    const { container } = render(<CircuitPreview spec={spec} />);
    const wireEl = container.querySelector("[data-testid^='wire-']");
    expect(wireEl).not.toBeNull();
    // The stroke attribute uses the CSS variable
    expect(wireEl?.getAttribute("stroke")).toBe("var(--wire)");
  });

  it("renders with minimal spec (no gates)", () => {
    render(<CircuitPreview spec={{ qubits: 1, gates: [] }} />);
    expect(screen.getByTestId("circuit-preview")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^wire-/)).toHaveLength(1);
  });
});
