"use client";

import { useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Play } from "lucide-react";
import { toast } from "sonner";
import AIResponse from "@/components/markdown/AIResponse";
import CircuitPreview from "@/components/learn/CircuitPreview";
import { stashCircuitForBuilder } from "@/lib/circuit-handoff";
import { cn } from "@/lib/utils";
import { useClassroomStore } from "@/stores/classroomStore";
import type { AnnotationObject, BoardObject, BoardState, CircuitObject, ClassroomStep } from "@/types/classroom";
import StepIndicator from "./StepIndicator";

/**
 * Annotation as a safe callout card: `note.text` renders as a plain React
 * text node, never as markup, so it can't carry HTML or script content.
 */
export function AnnotationNote({ id, note }: { id: string; note: AnnotationObject }) {
  return (
    <div
      data-testid={`annotation-${id}`}
      role="note"
      aria-label={note.text}
      className="flex gap-2.5 rounded-lg border border-overlay/10 bg-overlay/[0.03] py-2.5 pl-2.5 pr-3"
    >
      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-cyber-cyan/15 text-cyber-cyan">
        <Lightbulb size={12} aria-hidden />
      </span>
      <p className="text-sm leading-relaxed text-muted-foreground">{note.text}</p>
    </div>
  );
}

/** Stash the drawn circuit and open it in the Circuit Builder for a real sandbox run. */
function RunInBuilderButton({ id, obj, stepTitle }: { id: string; obj: CircuitObject; stepTitle?: string }) {
  const router = useRouter();
  const handleClick = () => {
    if (!stashCircuitForBuilder({ qubits: obj.qubits, gates: obj.gates, name: stepTitle })) {
      toast.error("Couldn't open the Circuit Builder — browser storage is unavailable.");
      return;
    }
    toast.success("Opening in Circuit Builder…");
    router.push("/circuit");
  };
  return (
    <button
      type="button"
      data-testid={`run-in-builder-${id}`}
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 self-start rounded-md bg-cyber-cyan px-2.5 py-1.5 text-xs font-semibold text-background shadow-glow-cyan outline-none transition-all hover:brightness-110 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-cyber-cyan/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Play size={12} className="fill-current" aria-hidden />
      Run in Circuit Builder
    </button>
  );
}

function ObjectCard({
  id,
  obj,
  board,
  steps,
}: {
  id: string;
  obj: Exclude<BoardObject, AnnotationObject>;
  board: BoardState;
  steps: ClassroomStep[];
}) {
  const highlighted = board.highlights.includes(id);
  const notes = board.order
    .map((oid) => [oid, board.objects[oid]] as const)
    .filter((e): e is readonly [string, AnnotationObject] => e[1]?.kind === "annotation" && e[1].target_id === id);
  const stepTitle = steps.find((s) => s.id === obj.step_id)?.title;
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
      {obj.kind === "circuit" && obj.gates.length > 0 && (
        <RunInBuilderButton id={id} obj={obj} stepTitle={stepTitle} />
      )}
    </figure>
  );
}

export function BoardView({ board, steps = [] }: { board: BoardState; steps?: ClassroomStep[] }) {
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
          <ObjectCard key={id} id={id} obj={o} board={board} steps={steps} />
        );
      })}
    </div>
  );
}

export default function Whiteboard({ className }: { className?: string }) {
  const board = useClassroomStore((s) => s.board);
  const steps = useClassroomStore((s) => s.steps);

  const logRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const handleScroll = () => {
    const el = logRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  };

  useLayoutEffect(() => {
    const el = logRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [board, steps]);

  return (
    <section aria-label="Whiteboard" className={cn("flex min-h-0 flex-col bg-background", className)}>
      <StepIndicator className="border-b border-overlay/10 p-3 empty:hidden" />
      <div
        ref={logRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
        tabIndex={0}
        aria-live="polite"
        aria-relevant="additions"
      >
        <BoardView board={board} steps={steps} />
      </div>
    </section>
  );
}
