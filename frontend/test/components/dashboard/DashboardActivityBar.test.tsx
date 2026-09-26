import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardActivityBar from "@/components/dashboard/DashboardActivityBar";

describe("DashboardActivityBar", () => {
  it("applies reduced opacity styling when dim is true", () => {
    render(
      <TooltipProvider>
        <DashboardActivityBar dim />
      </TooltipProvider>
    );
    expect(screen.getByLabelText("Dashboard navigation")).toHaveClass("opacity-30");
  });

  it("includes a Code nav entry linking to /code", () => {
    render(
      <TooltipProvider>
        <DashboardActivityBar />
      </TooltipProvider>
    );
    expect(screen.getByRole("link", { name: /code/i })).toHaveAttribute("href", "/code");
  });
});
