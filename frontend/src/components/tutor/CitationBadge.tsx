import type { Citation } from "@/types";
import { Badge } from "@/components/ui/badge";

/**
 * A single grounding source. Renders as an external link when the chunk has a
 * `url`, otherwise as a plain badge (e.g. an in-app lesson source).
 */
export default function CitationBadge({ citation }: { citation: Citation }) {
  if (citation.url) {
    return (
      <a
        href={citation.url}
        target="_blank"
        rel="noopener noreferrer"
        className="no-underline"
      >
        <Badge variant="outline" className="hover:border-cyber-cyan hover:text-cyber-cyan">
          {citation.title}
          <span aria-hidden className="ml-1 text-[0.65rem]">↗</span>
        </Badge>
      </a>
    );
  }

  return <Badge variant="outline">{citation.title}</Badge>;
}
