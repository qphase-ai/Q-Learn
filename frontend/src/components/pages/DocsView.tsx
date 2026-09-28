"use client";

import Link from "next/link";
import { FileText, BookOpen, CircuitBoard, ExternalLink, Code2 } from "lucide-react";

interface DocLink {
  title: string;
  description: string;
  href: string;
  external?: boolean;
  icon: typeof FileText;
}

const IN_APP: DocLink[] = [
  {
    title: "Start learning",
    description: "Work through the adaptive quantum-computing curriculum, level by level.",
    href: "/learn",
    icon: BookOpen,
  },
  {
    title: "Circuit builder",
    description: "Drag gates onto qubit wires and run real simulations.",
    href: "/circuit",
    icon: CircuitBoard,
  },
  {
    title: "Code workspace",
    description: "Write and run Qiskit against your circuits.",
    href: "/code",
    icon: Code2,
  },
];

const EXTERNAL: DocLink[] = [
  {
    title: "IBM Quantum Documentation",
    description: "Official Qiskit and IBM Quantum platform docs.",
    href: "https://docs.quantum.ibm.com/",
    external: true,
    icon: ExternalLink,
  },
  {
    title: "Qiskit API reference",
    description: "The full Qiskit SDK API used by the code workspace.",
    href: "https://docs.quantum.ibm.com/api/qiskit",
    external: true,
    icon: ExternalLink,
  },
];

export default function DocsView() {
  return (
    <div className="space-y-8">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyber-cyan/15 text-cyber-cyan">
          <FileText size={20} aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Documentation</h1>
          <p className="text-sm text-muted-foreground">
            Guides for using Q-Learn and references for quantum computing.
          </p>
        </div>
      </header>

      <Section title="Get started in Q-Learn" items={IN_APP} />
      <Section title="External references" items={EXTERNAL} />
    </div>
  );
}

function Section({ title, items }: { title: string; items: DocLink[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          const inner = (
            <div className="group h-full rounded-xl border border-white/10 bg-surface p-4 transition-colors hover:border-cyber-cyan/40 hover:bg-white/[0.02]">
              <Icon size={18} className="text-cyber-cyan" aria-hidden />
              <div className="mt-2 flex items-center gap-1 text-sm font-medium text-foreground">
                {item.title}
                {item.external && <ExternalLink size={12} className="text-muted-foreground" aria-hidden />}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
            </div>
          );
          return item.external ? (
            <a key={item.title} href={item.href} target="_blank" rel="noopener noreferrer">
              {inner}
            </a>
          ) : (
            <Link key={item.title} href={item.href}>
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
