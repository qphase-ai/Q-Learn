import CircuitPreview from "@/components/learn/CircuitPreview";
import type { BlockProps } from "./types";

export default function CircuitBlock({ spec, title, description }: BlockProps<"circuit">) {
  return (
    <figure className="my-6">
      {title && <p className="mb-2 font-semibold">{title}</p>}
      <CircuitPreview spec={spec} />
      {description && <figcaption className="mt-2 text-sm text-muted-foreground">{description}</figcaption>}
    </figure>
  );
}
