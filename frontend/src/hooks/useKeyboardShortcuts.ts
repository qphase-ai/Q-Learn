"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useShellStore } from "@/stores/shellStore";
import { WORKSPACES } from "@/lib/workspaces";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

export function useKeyboardShortcuts(): void {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey || isTypingTarget(e.target)) return;

      const { toggleTutor, toggleBottomPanel } = useShellStore.getState();
      const key = e.key.toLowerCase();

      if (key === "b") {
        e.preventDefault();
        toggleTutor();
        return;
      }
      if (key === "j") {
        e.preventDefault();
        toggleBottomPanel();
        return;
      }

      const index = Number(e.key);
      if (Number.isInteger(index) && index >= 1 && index <= WORKSPACES.length) {
        e.preventDefault();
        router.push(WORKSPACES[index - 1].href);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);
}
