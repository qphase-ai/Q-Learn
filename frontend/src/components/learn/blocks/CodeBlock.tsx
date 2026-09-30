import type { BlockProps } from "./types";

export default function CodeBlock({ code, language, filename, caption }: BlockProps<"code">) {
  return (
    <figure className="my-4 overflow-hidden rounded-md border border-overlay/10 bg-surface">
      {filename && (
        <div className="border-b border-overlay/10 px-3 py-1.5 font-mono text-xs text-muted-foreground">{filename}</div>
      )}
      <pre className="overflow-x-auto p-3 text-sm">
        <code className={`language-${language} font-mono`}>{code}</code>
      </pre>
      {caption && <figcaption className="px-3 pb-2 text-xs text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}
