"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import CircuitPreview from "@/components/learn/CircuitPreview";
import ProbabilityChart from "@/components/visualization/ProbabilityChart";
import StateVectorTable from "@/components/visualization/StateVectorTable";
import { apiFetch } from "@/lib/api";
import { getAccessToken, subscribeToCircuitResult } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import type { SimulationResult } from "@/types";
import type { BlockProps } from "./types";

/**
 * Authored simulation: the CMS stores configuration only. Running it goes
 * frontend → FastAPI → QuantumExecutionService → sandbox, like any circuit,
 * with the result delivered over Supabase Realtime (never polled).
 */
export default function SimulationBlock({ circuit, shots, view, title, description }: BlockProps<"simulation">) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => () => unsubRef.current?.(), []);

  async function run() {
    unsubRef.current?.();
    const circuitId = crypto.randomUUID();
    setState("running");
    setError(null);
    // Subscribe before POSTing so a fast result is not missed.
    unsubRef.current = subscribeToCircuitResult<SimulationResult>(circuitId, (payload) => {
      setResult(payload);
      setState(payload.status === "failed" ? "error" : "done");
      if (payload.status === "failed") setError(payload.error_message ?? "Simulation failed");
      unsubRef.current?.();
      unsubRef.current = null;
    });
    try {
      await apiFetch(`/api/v1/circuits/${circuitId}/execute`, {
        method: "POST",
        body: JSON.stringify({ circuit, shots, name: title || "Lesson simulation" }),
        token: (await getAccessToken()) ?? useAuthStore.getState().jwt ?? undefined,
      });
    } catch (err) {
      unsubRef.current?.();
      unsubRef.current = null;
      setState("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section aria-label={title || "Simulation"} className="my-6 rounded-md border border-white/10 bg-surface p-4">
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {description && <p className="mb-3 text-sm text-muted-foreground">{description}</p>}
      <CircuitPreview spec={circuit} />
      <div className="mt-3 flex items-center gap-3">
        <Button type="button" size="sm" variant="outline" onClick={run} disabled={state === "running"}>
          {state === "running" ? "Running…" : "Run simulation"}
        </Button>
        <span className="text-xs text-muted-foreground">{shots} shots</span>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
      {state === "done" && result && (
        <div className="mt-4">
          {view === "statevector" ? <StateVectorTable results={result} /> : <ProbabilityChart results={result} />}
        </div>
      )}
    </section>
  );
}
