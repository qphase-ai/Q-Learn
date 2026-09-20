import Link from "next/link";
import { SlideUp } from "@/components/motion/SlideUp";
import { SpotlightCard, MagneticButton } from "@/components/effects";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Plan {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
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
    cta: "Get Started Free",
    href: "/auth/register",
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
    href: "/auth/register",
    highlighted: true,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 px-6">
      <div className="mx-auto max-w-4xl">
        <SlideUp>
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-semibold text-foreground">Simple Pricing</h2>
            <p className="mt-3 text-muted-foreground">
              Start free. Upgrade when you&apos;re ready for the AI Tutor and live circuit execution.
            </p>
          </div>
        </SlideUp>

        <SlideUp delay={0.1}>
          <div className="grid gap-6 sm:grid-cols-2">
            {PLANS.map((plan) => {
              const CardComponent = plan.highlighted ? SpotlightCard : Card;
              return (
                <CardComponent
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
                          <span className="mt-0.5 text-cyber-cyan" aria-hidden>✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    {plan.highlighted ? (
                      <MagneticButton asChild variant="primary" className="w-full">
                        <Link href={plan.href}>{plan.cta}</Link>
                      </MagneticButton>
                    ) : (
                      <Button asChild variant="outline" className="w-full">
                        <Link href={plan.href}>{plan.cta}</Link>
                      </Button>
                    )}
                  </CardFooter>
                </CardComponent>
              );
            })}
          </div>
        </SlideUp>

        {/* See full pricing link */}
        <SlideUp delay={0.2}>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            <Link
              href="/pricing"
              className="text-cyber-cyan underline-offset-4 hover:underline"
            >
              See full pricing details →
            </Link>
          </p>
        </SlideUp>

        {/* SIH2614 badge */}
        <SlideUp delay={0.3}>
          <div className="mt-12 flex justify-center">
            <span className="border border-electric-purple/30 bg-electric-purple/5 text-muted-foreground rounded-full px-5 py-2 text-xs font-medium">
              Built for Smart India Hackathon 2025 — SIH2614
            </span>
          </div>
        </SlideUp>
      </div>
    </section>
  );
}
