"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useLearningStore } from "@/stores/learningStore";
import { isModuleLocked, levelLabel, sortedModules } from "@/lib/curriculum";
import type { LessonSearchResult } from "@/types";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

/**
 * Header search box: finds lessons by title, content, or concept name
 * (GET /api/v1/search/lessons) and opens the chosen lesson, switching course
 * if needed. ⌘K / Ctrl+K focuses it.
 */
export default function LessonSearch() {
  const searchLessons = useLearningStore((s) => s.searchLessons);
  const loadCourse = useLearningStore((s) => s.loadCourse);
  const loadLesson = useLearningStore((s) => s.loadLesson);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LessonSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);
  const listboxId = useId();

  const trimmed = query.trim();
  const showPanel = open && trimmed.length >= MIN_QUERY_LENGTH;

  // Debounced search; responses for superseded queries are dropped.
  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) {
      requestRef.current += 1;
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    const requestId = ++requestRef.current;
    setLoading(true);
    const timer = setTimeout(() => {
      searchLessons(trimmed)
        .then((hits) => {
          if (requestId !== requestRef.current) return;
          setResults(hits);
          setActiveIndex(0);
          setError(null);
        })
        .catch((err) => {
          if (requestId !== requestRef.current) return;
          setResults([]);
          setError(err instanceof Error ? err.message : "Search failed");
        })
        .finally(() => {
          if (requestId === requestRef.current) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, searchLessons]);

  // ⌘K / Ctrl+K focuses the search box from anywhere.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close when clicking outside.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  async function openResult(result: LessonSearchResult) {
    try {
      if (useLearningStore.getState().activeCourse?.id !== result.course_id) {
        await loadCourse(result.course_id);
      }
      const { activeCourse, lessonProgress } = useLearningStore.getState();
      const modules = activeCourse ? sortedModules(activeCourse) : [];
      const index = modules.findIndex((m) => m.id === result.module_id);
      // Same level gating as the curriculum sidebar.
      if (index >= 0 && isModuleLocked(modules, index, lessonProgress)) {
        toast(`Complete ${levelLabel(index - 1)} to unlock ${levelLabel(index)}`);
        return;
      }
      await loadLesson(result.lesson_id);
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open lesson");
    }
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!showPanel || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      void openResult(results[activeIndex]);
    }
  }

  const optionId = (i: number) => `${listboxId}-option-${i}`;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-overlay/10 bg-overlay/[0.02] px-3 text-sm text-muted-foreground focus-within:border-cyber-cyan/40">
        {loading ? (
          <Loader2 size={15} className="animate-spin" aria-hidden />
        ) : (
          <Search size={15} aria-hidden />
        )}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search lessons"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && results.length > 0 ? optionId(activeIndex) : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          placeholder="Search lessons and concepts…"
          className="w-full flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        <kbd className="rounded border border-overlay/10 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border border-overlay/10 bg-elevated p-1 shadow-lg backdrop-blur-xl">
          {error ? (
            <p className="px-3 py-2 text-xs text-error">{error}</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {loading ? "Searching…" : `No lessons match “${trimmed}”`}
            </p>
          ) : (
            <ul id={listboxId} role="listbox" aria-label="Lesson results">
              {results.map((result, i) => (
                <li
                  key={result.lesson_id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === activeIndex}
                  onPointerEnter={() => setActiveIndex(i)}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => void openResult(result)}
                  className={`cursor-pointer rounded-md px-3 py-2 ${
                    i === activeIndex ? "bg-cyber-cyan/10" : ""
                  }`}
                >
                  <p
                    className={`truncate text-[13px] ${
                      i === activeIndex ? "text-cyber-cyan" : "text-foreground"
                    }`}
                  >
                    {result.lesson_title}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {result.course_title} · {result.module_title}
                  </p>
                  {result.snippet && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground/80">
                      {result.snippet}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
