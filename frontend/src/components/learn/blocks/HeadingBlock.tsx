import type { BlockProps } from "./types";

export default function HeadingBlock({ text, level }: BlockProps<"heading">) {
  if (level === "3") return <h3 className="mb-2 mt-6 text-lg font-semibold">{text}</h3>;
  if (level === "4") return <h4 className="mb-2 mt-4 text-base font-semibold">{text}</h4>;
  return <h2 className="mb-3 mt-8 text-xl font-semibold">{text}</h2>;
}
