import { type ReactNode } from "react";
import { SpotlightCard } from "@/components/effects";
import { CardContent } from "@/components/ui/card";
import { SlideUp } from "@/components/motion/SlideUp";
import { HeroCircuitSVG } from "./HeroCircuitSVG";
import { ProbabilityMockSVG } from "./ProbabilityMockSVG";

interface Step {
  number: string;
  numberClass: string;
  title: string;
  description: string;
  visual: ReactNode;
}

function LessonMockup() {
  return (
    <div className="flex flex-col gap-3 text-left">
      <p className="text-xs font-semibold uppercase tracking-wider text-cyber-cyan">Lesson 4</p>
      <p className="text-sm font-medium text-foreground">Quantum Superposition</p>
      <p className="rounded bg-surface/60 p-2 font-mono text-xs text-muted-foreground">
        |ψ⟩ = α|0⟩ + β|1⟩, where |α|² + |β|² = 1
      </p>
      <div className="flex items-start gap-2 rounded border border-electric-purple/20 bg-electric-purple/5 p-2">
        <span className="mt-0.5 text-xs text-electric-purple">AI</span>
        <p className="text-xs text-muted-foreground">
          The Hadamard gate maps |0⟩ to an equal superposition...
        </p>
      </div>
    </div>
  );
}

function MasteryMockup() {
  return (
    <div className="flex flex-col gap-4 text-left">
      <p className="text-xs font-semibold uppercase tracking-wider text-cyber-cyan">Your Progress</p>
      {[
        { topic: "Superposition", pct: 87, color: "bg-cyber-cyan" },
        { topic: "Entanglement", pct: 62, color: "bg-electric-purple" },
        { topic: "Grover's Algorithm", pct: 34, color: "bg-neon-green" },
      ].map(({ topic, pct, color }) => (
        <div key={topic} className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{topic}</span>
            <span className="text-foreground font-medium">{pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10">
            <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 rounded border border-cyber-cyan/20 bg-cyber-cyan/5 px-3 py-2">
        <span className="text-sm">🔥</span>
        <span className="text-xs text-muted-foreground">7-day streak · 340 XP</span>
      </div>
    </div>
  );
}

const STEPS: Step[] = [
  {
    number: "01",
    numberClass: "text-cyber-cyan",
    title: "Follow a Guided Curriculum",
    description:
      "Lessons walk you from superposition to quantum algorithms. The AI Tutor answers your questions inline with cited sources.",
    visual: <LessonMockup />,
  },
  {
    number: "02",
    numberClass: "text-electric-purple",
    title: "Design Circuits Visually",
    description:
      "Drop gates onto qubits, wire entanglement, add measurements. The canvas gives you instant gate-placement feedback.",
    visual: <HeroCircuitSVG />,
  },
  {
    number: "03",
    numberClass: "text-neon-green",
    title: "Run on a Real Simulator",
    description:
      "Q-Learn forks a sandboxed Qiskit Aer process and streams results back in seconds — probability bars, state vectors, QASM.",
    visual: <ProbabilityMockSVG />,
  },
  {
    number: "04",
    numberClass: "text-cyber-cyan",
    title: "Watch Your Mastery Grow",
    description:
      "Every quiz and circuit updates your BKT mastery model. The XP bar and streak tracker keep you coming back.",
    visual: <MasteryMockup />,
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <SlideUp>
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-semibold text-foreground">
              Four Steps to Quantum Mastery
            </h2>
          </div>
        </SlideUp>

        <div className="flex flex-col gap-20">
          {STEPS.map((step, i) => {
            const isEven = i % 2 === 0;
            return (
              <SlideUp key={step.number} delay={0.1}>
                <div
                  className={`flex flex-col gap-10 md:flex-row md:items-center ${
                    isEven ? "" : "md:flex-row-reverse"
                  }`}
                >
                  {/* Text side */}
                  <div className="flex flex-1 flex-col gap-4">
                    <span className={`text-5xl font-bold tabular-nums opacity-40 ${step.numberClass}`}>
                      {step.number}
                    </span>
                    <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>

                  {/* Visual side */}
                  <div className="flex flex-1 justify-center">
                    <SpotlightCard className="w-full max-w-sm">
                      <CardContent className="flex items-center justify-center p-6">
                        {step.visual}
                      </CardContent>
                    </SpotlightCard>
                  </div>
                </div>
              </SlideUp>
            );
          })}
        </div>
      </div>
    </section>
  );
}
