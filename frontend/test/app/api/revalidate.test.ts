import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

import { revalidateTag } from "next/cache";
import { POST } from "@/app/api/revalidate/route";

function request(body: unknown, secret?: string) {
  return new Request("http://app/api/revalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(secret ? { "X-Revalidate-Secret": secret } : {}) },
    body: JSON.stringify(body),
  });
}

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    vi.stubEnv("REVALIDATE_SECRET", "s3cret");
    vi.mocked(revalidateTag).mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects a missing or wrong secret", async () => {
    expect((await POST(request({ collection: "lessons", id: 1 }))).status).toBe(401);
    expect((await POST(request({ collection: "lessons", id: 1 }, "nope"))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("is disabled when no secret is configured", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "");
    expect((await POST(request({ collection: "lessons", id: 1 }, ""))).status).toBe(401);
  });

  it("revalidates the curriculum tree and both lesson keys", async () => {
    const res = await POST(request({ collection: "lessons", id: 5, contentRefId: "ref-5" }, "s3cret"));
    expect(res.status).toBe(200);
    expect(vi.mocked(revalidateTag).mock.calls.map((c) => c[0])).toEqual([
      "cms:curriculum",
      "cms:lesson:payload:5",
      "cms:lesson:ref-5",
    ]);
  });

  it("revalidates only the tree for non-lesson collections", async () => {
    await POST(request({ collection: "levels", id: 2 }, "s3cret"));
    expect(vi.mocked(revalidateTag).mock.calls.map((c) => c[0])).toEqual(["cms:curriculum"]);
  });

  it("validates the body", async () => {
    expect((await POST(request({ id: 1 }, "s3cret"))).status).toBe(422);
  });
});
