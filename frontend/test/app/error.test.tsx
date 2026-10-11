import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "@/app/error";

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureException: (...args: unknown[]) => captureException(...args) }));

describe("app/error.tsx", () => {
  it("reports the error to Sentry and renders a retry button", () => {
    captureException.mockClear();
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    const reset = vi.fn();

    render(<ErrorBoundary error={error} reset={reset} />);

    expect(captureException).toHaveBeenCalledWith(error);
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
