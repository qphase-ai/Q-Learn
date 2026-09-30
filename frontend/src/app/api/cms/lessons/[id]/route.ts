import { fetchLessonDetail } from "@/lib/cms";
import { respond } from "../../respond";

export function GET(_req: Request, { params }: { params: { id: string } }) {
  return respond(() => fetchLessonDetail(params.id));
}
