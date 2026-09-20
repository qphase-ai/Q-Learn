import { Cpu, Bot, Zap, Brain, BarChart2, BookOpen } from "lucide-react";
import { SlideUp } from "@/components/motion/SlideUp";
import { StaggerContainer, StaggerItem } from "@/components/motion/StaggerChildren";
import { FeatureCard, type FeatureCardProps } from "./FeatureCard";

const FEATURES: FeatureCardProps[] = [
  {
    icon: Cpu,
    title: "Circuit Builder",
    description: "Drag-and-drop quantum gates onto a multi-qubit canvas with real-time feedback.",
    accentClass: "text-cyber-cyan",
    borderClass: "border-cyber-cyan/20",
  },
  {
    icon: Bot,
    title: "AI Tutor",
    description: "RAG-powered tutor explains every concept with cited sources and KaTeX math.",
    accentClass: "text-electric-purple",
    borderClass: "border-electric-purple/20",
  },
  {
    icon: Zap,
    title: "Real Simulator",
    description: "Execute circuits on Qiskit Aer — real probabilities, state vectors, QASM.",
    accentClass: "text-neon-green",
    borderClass: "border-neon-green/20",
  },
  {
    icon: Brain,
    title: "Adaptive Quizzes",
    description: "BKT mastery tracking adjusts difficulty to your exact knowledge level.",
    accentClass: "text-cyber-cyan",
    borderClass: "border-cyber-cyan/20",
  },
  {
    icon: BarChart2,
    title: "State Visualization",
    description: "Probability histograms, Bloch sphere, and QASM output in one panel.",
    accentClass: "text-electric-purple",
    borderClass: "border-electric-purple/20",
  },
  {
    icon: BookOpen,
    title: "Structured Curriculum",
    description: "40+ lessons from qubits and superposition to Grover's algorithm.",
    accentClass: "text-neon-green",
    borderClass: "border-neon-green/20",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <SlideUp>
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-semibold text-foreground">
              Everything You Need to Go from Zero to Quantum
            </h2>
            <p className="mt-3 text-muted-foreground">
              One platform. Six purpose-built tools.
            </p>
          </div>
        </SlideUp>

        <StaggerContainer inView staggerDelay={0.07} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <StaggerItem key={feature.title}>
              <FeatureCard {...feature} />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
