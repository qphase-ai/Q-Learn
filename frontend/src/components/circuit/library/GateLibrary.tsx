"use client";

import { useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GATE_LIST, searchGates, type GateCategory } from "@/lib/gates";
import { cn } from "@/lib/utils";
import GateCard from "@/components/circuit/library/GateCard";

export const GATE_SEARCH_ID = "circuit-gate-search";

const CATEGORIES: { value: GateCategory; label: string }[] = [
  { value: "single", label: "Single Qubit" },
  { value: "multi", label: "Multi Qubit" },
  { value: "measure", label: "Measurement" },
];

const MORE = GATE_LIST.filter((g) => g.more);

function GateGrid({ types, label }: { types: typeof GATE_LIST; label: string }) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-3 gap-1">
      {types.map((g) => (
        <GateCard key={g.type} type={g.type} />
      ))}
    </div>
  );
}

export default function GateLibrary({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<GateCategory>("single");
  const [moreOpen, setMoreOpen] = useState(true);
  const results = query.trim() ? searchGates(query) : null;

  return (
    <aside
      aria-label="Quantum gate library"
      style={style}
      className={cn("flex min-h-0 flex-col bg-surface", className)}
    >
      <div className="flex flex-col gap-2.5 border-b border-overlay/10 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Quantum Gates</h2>
          <span className="font-mono text-[10px] text-muted-foreground">{GATE_LIST.length}</span>
        </div>

        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id={GATE_SEARCH_ID}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                e.currentTarget.blur();
              }
            }}
            placeholder="Search gates..."
            aria-label="Search gates"
            className="h-8 w-full rounded-md border border-overlay/10 bg-overlay/[0.03] pl-8 pr-8 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-cyber-cyan/50 focus:bg-overlay/[0.05] [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-cyber-cyan/60"
            >
              <X size={12} />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-overlay/10 px-1 font-mono text-[10px] text-muted-foreground">
              /
            </kbd>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
        {results ? (
          results.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="px-1 text-[11px] text-muted-foreground" aria-live="polite">
                {results.length} {results.length === 1 ? "match" : "matches"}
              </p>
              <GateGrid types={results} label="Search results" />
            </div>
          ) : (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground" aria-live="polite">
              No gates match “{query}”.
            </p>
          )
        ) : (
          <>
            <Tabs value={tab} onValueChange={(v) => setTab(v as GateCategory)}>
              <TabsList className="flex h-auto w-full gap-0.5 rounded-lg p-0.5">
                {CATEGORIES.map((c) => (
                  <TabsTrigger
                    key={c.value}
                    value={c.value}
                    className="flex-1 whitespace-normal rounded-md px-1 py-1 text-[10.5px] leading-tight data-[state=active]:shadow-none"
                  >
                    {c.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {CATEGORIES.map((c) => (
                <TabsContent key={c.value} value={c.value} className="mt-2">
                  <GateGrid
                    types={GATE_LIST.filter((g) => g.category === c.value && !g.more)}
                    label={`${c.label} gates`}
                  />
                </TabsContent>
              ))}
            </Tabs>

            <div className="border-t border-overlay/10 pt-2">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                className="flex w-full items-center justify-between rounded px-1 py-1 text-[11px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-cyber-cyan/60"
              >
                More Gates
                <ChevronDown
                  size={13}
                  className={cn("transition-transform", moreOpen ? "rotate-0" : "-rotate-90")}
                  aria-hidden
                />
              </button>
              {moreOpen && (
                <div className="mt-1.5">
                  <GateGrid types={MORE} label="More gates" />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <p className="border-t border-overlay/10 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
        Drag a gate onto a qubit, or click it and then click a cell.
      </p>
    </aside>
  );
}
