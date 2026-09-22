import { describe, it, expect } from "vitest";
import { WORKSPACES, workspaceFromPathname } from "@/lib/workspaces";

describe("WORKSPACES", () => {
  it("lists the six workspaces in ActivityBar order", () => {
    expect(WORKSPACES.map((w) => w.id)).toEqual([
      "dashboard",
      "learn",
      "circuit",
      "code",
      "quiz",
      "settings",
    ]);
  });

  it("uses /<id> hrefs for all workspaces", () => {
    expect(WORKSPACES.find((w) => w.id === "circuit")?.href).toBe("/circuit");
    expect(WORKSPACES.find((w) => w.id === "settings")?.href).toBe("/settings");
  });
});

describe("workspaceFromPathname", () => {
  it("matches by leading segment", () => {
    expect(workspaceFromPathname("/circuit")).toBe("circuit");
    expect(workspaceFromPathname("/learn/lesson-3")).toBe("learn");
    expect(workspaceFromPathname("/settings/billing")).toBe("settings");
  });

  it("returns null for unknown paths", () => {
    expect(workspaceFromPathname("/pricing")).toBeNull();
    expect(workspaceFromPathname("/")).toBeNull();
  });
});
