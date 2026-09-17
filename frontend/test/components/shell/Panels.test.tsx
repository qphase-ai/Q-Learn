import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import RightPanel from "@/components/shell/RightPanel";
import BottomPanel from "@/components/shell/BottomPanel";
import { useShellStore } from "@/stores/shellStore";

beforeEach(() => {
  useShellStore.setState({ rightPanelOpen: true, bottomPanelOpen: true, bottomPanelTab: "probabilities" });
});

describe("RightPanel", () => {
  it("renders its region when open", () => {
    render(<RightPanel />);
    expect(screen.getByRole("complementary", { name: /ai tutor/i })).toBeInTheDocument();
  });

  it("is hidden when closed", () => {
    useShellStore.setState({ rightPanelOpen: false });
    render(<RightPanel />);
    expect(screen.queryByRole("complementary", { name: /ai tutor/i })).not.toBeInTheDocument();
  });
});

describe("BottomPanel", () => {
  it("renders the four result tabs when open", () => {
    render(<BottomPanel />);
    expect(screen.getByRole("tab", { name: /probabilities/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /state vector/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /qasm/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /console/i })).toBeInTheDocument();
  });
});
