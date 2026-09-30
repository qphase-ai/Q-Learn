import { timingSafeEqual } from "crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { CMS_TAGS } from "@/lib/cms";

/**
 * Called by the Payload CMS (cms/src/hooks/revalidate.ts) when published
 * content changes, so cached /api/cms/* reads refresh on publish rather than
 * on a timer. Authenticated with the shared REVALIDATE_SECRET.
 */
function authorized(provided: string | null): boolean {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req.headers.get("x-revalidate-secret"))) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid secret" } }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { collection?: unknown; id?: unknown; contentRefId?: unknown }
    | null;
  if (!body || typeof body.collection !== "string" || body.id === undefined || body.id === null) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "collection and id are required" } }, { status: 422 });
  }

  // Titles, ordering and publication state all feed the curriculum tree.
  const tags: string[] = [CMS_TAGS.curriculum];
  if (body.collection === "lessons") {
    tags.push(CMS_TAGS.lesson(`payload:${String(body.id)}`));
    if (typeof body.contentRefId === "string" && body.contentRefId) {
      tags.push(CMS_TAGS.lesson(body.contentRefId));
    }
  }
  tags.forEach((tag) => revalidateTag(tag));

  return NextResponse.json({ success: true, data: { revalidated: tags } });
}
