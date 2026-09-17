"use client";

import { useShellStore } from "@/stores/shellStore";
import ProbabilityChart from "@/components/visualization/ProbabilityChart";
import StateVectorTable from "@/components/visualization/StateVectorTable";
import QASMViewer from "@/components/visualization/QASMViewer";
import ConsoleOutput from "@/components/visualization/ConsoleOutput";

const TABS = [
  { id: "probabilities", label: "Probabilities" },
  { id: "statevector", label: "State Vector" },
  { id: "qasm", label: "QASM" },
  { id: "console", label: "Console" },
] as const;

export default function BottomPanel() {
  const open = useShellStore((s) => s.bottomPanelOpen);
  const activeTab = useShellStore((s) => s.bottomPanelTab);
  const setTab = useShellStore((s) => s.setBottomPanelTab);
  if (!open) return null;

  return (
    <section
      aria-label="Simulation results"
      className="shell-panel-transition flex h-[250px] flex-col border-t border-[var(--border)] bg-[var(--bg-surface)]"
    >
      <div role="tablist" className="flex border-b border-[var(--border)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs ${
              activeTab === t.id
                ? "border-b-2 border-[var(--quantum)] text-[var(--quantum)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-2 text-sm text-[var(--text-primary)]">
        {activeTab === "probabilities" && <ProbabilityChart />}
        {activeTab === "statevector" && <StateVectorTable />}
        {activeTab === "qasm" && <QASMViewer />}
        {activeTab === "console" && <ConsoleOutput />}
      </div>
    </section>
  );
}
