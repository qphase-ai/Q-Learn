"use client";

import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Recursively collect the plain text of React children (highlight spans included). */
export function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return Children.toArray(node.props.children).map(extractText).join("");
  }
  return "";
}

interface CodeBlockProps {
  /** Language from the fence (`python`), without the `language-` prefix. */
  language?: string;
  /** Class names for the inner <code> (hljs output), e.g. "hljs language-python". */
  codeClassName?: string;
  /** Possibly highlighted children; the Copy button copies their raw text. */
  children: ReactNode;
  className?: string;
}

export default function CodeBlock({ language, codeClassName, children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canCopy, setCanCopy] = useState(false);

  useEffect(() => {
    setCanCopy(typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function");
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const raw = extractText(children).replace(/\n$/, "");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={cn("ai-codeblock my-3 overflow-hidden rounded-md border border-overlay/10 bg-overlay/5", className)}>
      <div className="flex items-center justify-between border-b border-overlay/10 px-3 py-1">
        <span className="font-code text-xs lowercase text-muted-foreground">{language || "text"}</span>
        {canCopy && (
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Copied" : "Copy code"}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        )}
      </div>
      <pre className="overflow-x-auto p-3 font-code text-[0.85em] leading-relaxed">
        <code className={codeClassName}>{children}</code>
      </pre>
    </div>
  );
}
