"use client";

import { useEffect } from "react";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useElementWidth } from "@/hooks/useElementWidth";
import { cn } from "@/lib/utils";
import { useClassroomStore } from "@/stores/classroomStore";
import ConversationPane from "./ConversationPane";
import Whiteboard from "./Whiteboard";

/** Tailwind `md` — two columns at or above, tabs below. Measured on the container, not the viewport. */
export const TWO_COLUMN_MIN = 768;

export default function ClassroomWorkspace({ className }: { className?: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const narrow = width > 0 && width < TWO_COLUMN_MIN;
  const restoreSaved = useClassroomStore((s) => s.restoreSaved);
  const newSession = useClassroomStore((s) => s.newSession);
  const hasSession = useClassroomStore((s) => s.sessionId !== null);
  const connection = useClassroomStore((s) => s.connection);

  useEffect(() => {
    void restoreSaved();
    return () => useClassroomStore.getState().reset();
  }, [restoreSaved]);

  return (
    <main ref={ref} data-testid="classroom-workspace" className={cn("flex min-w-0 flex-1 flex-col overflow-hidden", className)}>
      <header className="flex items-center justify-between gap-2 border-b border-overlay/10 px-4 py-2">
        <h1 className="text-sm font-semibold text-foreground">AI Classroom</h1>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {hasSession && <span aria-live="polite">{connection === "live" ? "Live" : connection === "error" ? "Reconnecting…" : "Connecting…"}</span>}
          <button
            type="button"
            onClick={newSession}
            className="flex items-center gap-1 rounded-md px-2 py-1 outline-none hover:bg-overlay/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-cyber-cyan/60"
          >
            <Plus size={12} aria-hidden /> New session
          </button>
        </div>
      </header>
      {narrow ? (
        <Tabs defaultValue="conversation" className="flex min-h-0 flex-1 flex-col px-2">
          <TabsList className="mt-2 self-start" aria-label="Classroom view">
            <TabsTrigger value="conversation">Conversation</TabsTrigger>
            <TabsTrigger value="whiteboard">Whiteboard</TabsTrigger>
          </TabsList>
          <TabsContent value="conversation" forceMount className="min-h-0 flex-1 data-[state=inactive]:hidden">
            <ConversationPane className="h-full" />
          </TabsContent>
          <TabsContent value="whiteboard" forceMount className="min-h-0 flex-1 data-[state=inactive]:hidden">
            <Whiteboard className="h-full" />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-2">
          <ConversationPane className="border-r border-overlay/10" />
          <Whiteboard />
        </div>
      )}
    </main>
  );
}
