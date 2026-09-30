import Markdown from "@/components/learn/Markdown";
import type { BlockProps } from "./types";

export default function MathBlock({ latex, displayMode, caption }: BlockProps<"math">) {
  const source = displayMode === false ? `$${latex}$` : `$$\n${latex}\n$$`;
  return (
    <figure className="my-4">
      <Markdown>{source}</Markdown>
      {caption && <figcaption className="text-center text-xs text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}
