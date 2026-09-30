import Markdown from "@/components/learn/Markdown";
import { cn } from "@/lib/utils";
import type { BlockProps } from "./types";

const VARIANT_CLASSES: Record<BlockProps<"callout">["variant"], string> = {
  info: "border-cyber-cyan/40 bg-cyber-cyan/5",
  tip: "border-neon-green/40 bg-neon-green/5",
  warning: "border-warning/50 bg-warning/5",
  important: "border-electric-purple/50 bg-electric-purple/5",
};

export default function CalloutBlock({ variant, title, body }: BlockProps<"callout">) {
  return (
    <aside role="note" className={cn("my-4 rounded-md border-l-4 px-4 py-3", VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.info)}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <Markdown>{body}</Markdown>
    </aside>
  );
}
