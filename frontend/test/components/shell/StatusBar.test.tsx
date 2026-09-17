import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBar from "@/components/shell/StatusBar";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true } as Response)));
});

describe("StatusBar", () => {
  it("renders mastery and a backend status label", () => {
    render(<StatusBar />);
    expect(screen.getByText(/mastery/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/backend status/i)).toBeInTheDocument();
  });
});
