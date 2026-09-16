import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import WorkspacePlaceholder from "@/components/shell/WorkspacePlaceholder";

describe("WorkspacePlaceholder", () => {
  it("shows the workspace name", () => {
    render(<WorkspacePlaceholder name="Circuit" />);
    expect(screen.getByText("Circuit")).toBeInTheDocument();
  });

  it("notes the slice when provided", () => {
    render(<WorkspacePlaceholder name="Quiz" slice={3} />);
    expect(screen.getByText(/Slice 3/i)).toBeInTheDocument();
  });
});
