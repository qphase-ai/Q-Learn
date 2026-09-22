"use client";

import Link from "next/link";
import { FadeIn } from "@/components/motion/FadeIn";
import { SlideUp } from "@/components/motion/SlideUp";
import { ParticleNetwork } from "@/components/backgrounds";
import { GlowingBorder, ShimmerText, MagneticButton } from "@/components/effects";
import { Button } from "@/components/ui/button";
import { HeroCircuitSVG } from "./HeroCircuitSVG";

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 py-32">
      <ParticleNetwork />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-7 text-center">
        {/* Eyebrow badge */}
        <FadeIn delay={0.1}>
          <span className="inline-flex items-center rounded-full border border-cyber-cyan/30 bg-cyber-cyan/5 px-4 py-1.5 text-xs font-medium text-cyber-cyan shadow-glow-cyan">
            Adaptive · AI-Powered · Real Quantum Simulators
          </span>
        </FadeIn>

        {/* Headline */}
        <SlideUp delay={0.2}>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            The Most Powerful Way to Learn{" "}
            <ShimmerText>Quantum Computing</ShimmerText>
          </h1>
        </SlideUp>

        {/* Sub-copy */}
        <SlideUp delay={0.3}>
          <p className="max-w-xl text-lg text-muted-foreground">
            Q-Learn combines an AI tutor, live circuit execution, and adaptive
            assessments in one IDE-like workspace.
          </p>
        </SlideUp>

        {/* CTAs */}
        <SlideUp delay={0.4}>
          <div className="flex flex-col gap-4 sm:flex-row">
            <MagneticButton asChild variant="primary" size="lg">
              <Link href="/auth/register">Start Learning Free</Link>
            </MagneticButton>
            <Button asChild variant="outline" size="lg">
              <a href="#how-it-works">See How It Works</a>
            </Button>
          </div>
        </SlideUp>

        {/* Circuit visual — hidden on very small screens */}
        <SlideUp delay={0.55} className="hidden w-full sm:block">
          <GlowingBorder className="w-full">
            <div className="flex items-center justify-center p-6">
              <HeroCircuitSVG />
            </div>
          </GlowingBorder>
        </SlideUp>
      </div>
    </section>
  );
}
