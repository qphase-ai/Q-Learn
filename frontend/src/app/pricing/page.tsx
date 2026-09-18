import { AuroraBackground, GlowingOrbs } from "@/components/backgrounds";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

interface Plan {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Free",
    price: "$0",
    description: "Explore quantum computing fundamentals at your own pace.",
    features: [
      "Full lesson & curriculum access",
      "Circuit builder (view only)",
      "Community support",
    ],
    cta: "Current plan",
  },
  {
    name: "Pro",
    price: "$12",
    period: "/mo",
    description: "Unlock the AI Tutor and live circuit execution.",
    features: [
      "Everything in Free",
      "AI Tutor — unlimited sessions",
      "Circuit execution on real simulators",
      "Adaptive quizzes",
    ],
    cta: "Upgrade to Pro",
    highlighted: true,
  },
];

export default function PricingPage() {
  // No pre-existing root wrapper — added a minimal `relative` div so the
  // background layers (fixed/absolute, pointer-events-none) have a
  // positioning context without altering the original content below.
  return (
    <div className="relative">
      <AuroraBackground />
      <GlowingOrbs />
      <div className="relative mx-auto max-w-4xl px-6 py-16">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-semibold text-foreground">Pricing</h1>
          <p className="mt-2 text-muted-foreground">
            Start free. Upgrade when you&apos;re ready for the AI Tutor and live
            circuit execution.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={
                plan.highlighted ? "border-cyber-cyan/40 shadow-glow-cyan" : undefined
              }
            >
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-foreground">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-0.5 text-cyber-cyan" aria-hidden>
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  type="button"
                  variant={plan.highlighted ? "primary" : "outline"}
                  className="w-full"
                >
                  {plan.cta}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
