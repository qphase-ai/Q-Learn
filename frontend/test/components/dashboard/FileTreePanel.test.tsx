import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import FileTreePanel from "@/components/dashboard/FileTreePanel";

describe("FileTreePanel", () => {
  it("renders the generated circuit file and marks it active", () => {
    render(<FileTreePanel activeFile="circuit.py" />);
    const entry = screen.getByText("circuit.py");
    expect(entry).toBeInTheDocument();
    expect(entry.closest("button")).toHaveAttribute("aria-current", "true");
  });

  it("renders the static starter file group", () => {
    render(<FileTreePanel activeFile="circuit.py" />);
    expect(screen.getByText("starter_bell_state.py")).toBeInTheDocument();
  });
});
