import { NextResponse } from "next/server";
import { CmsNotFoundError } from "@/lib/cms";

/** Wrap a CMS read in the same { success, data | error } envelope FastAPI uses. */
export async function respond<T>(load: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json({ success: true, data: await load() });
  } catch (err) {
    const notFound = err instanceof CmsNotFoundError;
    if (!notFound) console.error("cms read failed", err);
    return NextResponse.json(
      {
        success: false,
        error: notFound
          ? { code: "NOT_FOUND", message: err.message }
          : { code: "CMS_UNAVAILABLE", message: "Curriculum content is temporarily unavailable" },
      },
      { status: notFound ? 404 : 502 }
    );
  }
}
