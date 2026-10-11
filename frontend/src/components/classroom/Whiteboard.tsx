"use client";

import AIResponse from "@/components/markdown/AIResponse";
import CircuitPreview from "@/components/learn/CircuitPreview";
import { cn } from "@/lib/utils";
import { useClassroomStore } from "@/stores/classroomStore";
import type { AnnotationObject, BoardObject, BoardState } from "@/types/classroom";
import StepIndicator from "./StepIndicator";

/** Annotation as a safe SVG callout: text is a React text node, never markup. */
export function AnnotationNote({ id, note }: { id: string; note: AnnotationObject }) {
  const width = 320;
  const lines = wrap(note.text, 44);
  const height = 16 + lines.length * 16;
  return (
    <svg
      data-testid={`annotation-${id}`}
      role="note"
      aria-label={note.text}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ maxWidth: width }}
    >
      <rect x={1} y={1} width={width - 2} height={height - 2} rx={6} strokeWidth={1} className="fill-elevated stroke-cyber-cyan" />
      {lines.map((line, i) => (
        <text key={i} x={10} y={20 + i * 16} fontSize={12} className="fill-muted-foreground" aria-hidden>
          {line}
        </text>
      ))}
    </svg>
  );
}

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if ((line + " " + word).trim().length > max && line) {
      out.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) out.push(line);
  return out.slice(0, 6);
}

function ObjectCard({ id, obj, board }: { id: string; obj: Exclude<BoardObject, AnnotationObject>; board: BoardState }) {
  const highlighted = board.highlights.includes(id);
  const notes = board.order
    .map((oid) => [oid, board.objects[oid]] as const)
    .filter((e): e is readonly [string, AnnotationObject] => e[1]?.kind === "annotation" && e[1].target_id === id);
  return (
    <figure
      data-testid={`board-object-${id}`}
      data-highlighted={highlighted ? "true" : undefined}
      className={cn(
        "space-y-2 rounded-xl border bg-surface p-3",
        highlighted ? "border-cyber-cyan shadow-glow-cyan" : "border-overlay/10"
      )}
    >
      {obj.kind === "circuit" ? (
        <div className="overflow-x-auto">
          <CircuitPreview
            spec={{ qubits: obj.qubits, gates: obj.gates }}
            pack
            highlighted={highlighted}
            ariaLabel={`Quantum circuit on ${obj.qubits} qubit${obj.qubits === 1 ? "" : "s"}: ${
              obj.gates.map((g) => g.type).join(", ") || "no gates"
            }`}
          />
        </div>
      ) : (
        <div data-testid="equation" className="overflow-x-auto">
          <AIResponse content={`$$\n${obj.latex}\n$$`} variant="page" />
        </div>
      )}
      {notes.map(([nid, n]) => (
        <AnnotationNote key={nid} id={nid} note={n} />
      ))}
    </figure>
  );
}

export function BoardView({ board }: { board: BoardState }) {
  const free = board.order.filter((id) => {
    const o = board.objects[id];
    return o && (o.kind !== "annotation" || !o.target_id || !board.objects[o.target_id]);
  });
  if (free.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">The whiteboard is empty. Ask a question to see circuits and equations here.</p>;
  }
  return (
    <div className="space-y-3 p-4">
      {free.map((id) => {
        const o = board.objects[id];
        return o.kind === "annotation" ? (
          <AnnotationNote key={id} id={id} note={o} />
        ) : (
          <ObjectCard key={id} id={id} obj={o} board={board} />
        );
      })}
    </div>
  );
}

export default function Whiteboard({ className }: { className?: string }) {
  const board = useClassroomStore((s) => s.board);
  return (
    <section aria-label="Whiteboard" className={cn("flex min-h-0 flex-col bg-background", className)}>
      <StepIndicator className="border-b border-overlay/10 p-3 empty:hidden" />
      <div className="flex-1 overflow-y-auto" tabIndex={0} aria-live="polite" aria-relevant="additions">
        <BoardView board={board} />
      </div>
    </section>
  );
}
