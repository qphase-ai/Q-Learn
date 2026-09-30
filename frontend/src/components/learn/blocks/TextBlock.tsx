import type { BlockProps } from "./types";

/** Plain text — rendered as text nodes only, never as HTML. */
export default function TextBlock({ body }: BlockProps<"text">) {
  const paragraphs = body.split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className="my-3 whitespace-pre-line">
          {p.trim()}
        </p>
      ))}
    </>
  );
}
