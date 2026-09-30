import { fetchCourses } from "@/lib/cms";
import { respond } from "../respond";

export const dynamic = "force-dynamic";

export function GET() {
  return respond(fetchCourses);
}
