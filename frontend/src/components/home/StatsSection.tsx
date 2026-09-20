import { SlideUp } from "@/components/motion/SlideUp";
import { MeshGradient } from "@/components/backgrounds";

const STATS = [
  { value: "10,000+", label: "Learners" },
  { value: "40+", label: "Lessons" },
  { value: "3", label: "Quantum algorithms" },
  { value: "1", label: "AI Tutor per student" },
];

export function StatsSection() {
  return (
    <section className="relative overflow-hidden py-20 px-6">
      <MeshGradient />
      <div className="relative z-10 mx-auto max-w-5xl">
        <SlideUp>
          <dl className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className={`flex flex-col items-center text-center ${
                  i < STATS.length - 1
                    ? "md:border-r md:border-white/10"
                    : ""
                }`}
              >
                <dt className="text-4xl font-bold text-cyber-cyan">{stat.value}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </SlideUp>
      </div>
    </section>
  );
}
