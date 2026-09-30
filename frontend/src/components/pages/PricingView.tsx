"use client";

import { Crown, Check } from "lucide-react";

interface PlanFeature {
  label: string;
  free: boolean;
  pro: boolean;
}

const FEATURES: PlanFeature[] = [
  { label: "Interactive lessons & circuit builder", free: true, pro: true },
  { label: "Real Qiskit simulation", free: true, pro: true },
  { label: "AI Tutor (chat, explain, hints)", free: true, pro: true },
  { label: "Full 12-level curriculum", free: false, pro: true },
  { label: "Advanced algorithms (Shor, QEC, VQE)", free: false, pro: true },
  { label: "Unlimited AI tutor usage", free: false, pro: true },
  { label: "Priority simulation queue", free: false, pro: true },
];

export default function PricingView() {
  return (
    <div className="space-y-8">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/15 text-warning">
          <Crown size={20} aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Upgrade your plan</h1>
          <p className="text-sm text-muted-foreground">
            Unlock the full curriculum and unlimited AI tutoring.
          </p>
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Free */}
        <PlanCard
          name="Free"
          price="₹0"
          cadence="forever"
          cta="Current plan"
          ctaDisabled
        >
          {FEATURES.map((f) => (
            <FeatureRow key={f.label} label={f.label} included={f.free} />
          ))}
        </PlanCard>

        {/* Pro */}
        <PlanCard
          name="Pro"
          price="₹499"
          cadence="per month"
          highlighted
          cta="Upgrade coming soon"
          ctaDisabled
        >
          {FEATURES.map((f) => (
            <FeatureRow key={f.label} label={f.label} included={f.pro} />
          ))}
        </PlanCard>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Billing isn&apos;t enabled yet — Pro checkout is coming soon.
      </p>
    </div>
  );
}

function PlanCard({
  name,
  price,
  cadence,
  highlighted,
  cta,
  ctaDisabled,
  children,
}: {
  name: string;
  price: string;
  cadence: string;
  highlighted?: boolean;
  cta: string;
  ctaDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 ${
        highlighted
          ? "border-electric-purple/50 bg-gradient-to-b from-electric-purple/10 to-transparent shadow-glow-purple"
          : "border-overlay/10 bg-surface"
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{name}</h2>
        {highlighted && (
          <span className="rounded-full bg-electric-purple/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-electric-purple">
            Most popular
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-foreground">{price}</span>
        <span className="text-sm text-muted-foreground">/ {cadence}</span>
      </div>
      <ul className="mt-5 flex-1 space-y-2.5">{children}</ul>
      <button
        type="button"
        disabled={ctaDisabled}
        className={`mt-6 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
          highlighted
            ? "bg-electric-purple text-background hover:brightness-110"
            : "border border-overlay/10 text-foreground"
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {cta}
      </button>
    </div>
  );
}

function FeatureRow({ label, included }: { label: string; included: boolean }) {
  return (
    <li className={`flex items-start gap-2 text-sm ${included ? "text-foreground" : "text-muted-foreground/50"}`}>
      <Check
        size={15}
        className={`mt-0.5 flex-shrink-0 ${included ? "text-success" : "text-muted-foreground/30"}`}
        aria-hidden
      />
      {label}
    </li>
  );
}
