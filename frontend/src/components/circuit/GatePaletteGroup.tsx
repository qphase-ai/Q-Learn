"use client";

import { useState } from "react";

interface GatePaletteGroupProps {
  title: string;
  children: React.ReactNode;
}

export default function GatePaletteGroup({ title, children }: GatePaletteGroupProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border-none bg-transparent py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground outline-none cursor-pointer"
      >
        <span>{title}</span>
        <span className="text-[10px]">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="flex flex-wrap gap-1.5 pt-1.5">{children}</div>}
    </div>
  );
}
