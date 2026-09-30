import Markdown from "@/components/learn/Markdown";
import type { BlockProps } from "./types";

export default function MarkdownBlock({ body }: BlockProps<"markdown">) {
  return <Markdown>{body}</Markdown>;
}
