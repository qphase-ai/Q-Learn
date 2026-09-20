"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuroraBackground } from "@/components/backgrounds";
import { Navbar } from "@/components/home/Navbar";
import { HeroSection } from "@/components/home/HeroSection";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { HowItWorksSection } from "@/components/home/HowItWorksSection";
import { StatsSection } from "@/components/home/StatsSection";
import { PricingSection } from "@/components/home/PricingSection";
import { HomeFooter } from "@/components/home/HomeFooter";

export default function RootPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const devNoAuth =
      process.env.NODE_ENV !== "production" &&
      process.env.NEXT_PUBLIC_DEV_NO_AUTH === "1";
    const authed = document.cookie.includes("qlearn-auth=1");
    if (authed || devNoAuth) {
      router.replace("/dashboard");
    } else {
      setShow(true);
    }
  }, [router]);

  if (!show) return null;

  return (
    <>
      <AuroraBackground />
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <StatsSection />
        <PricingSection />
      </main>
      <HomeFooter />
    </>
  );
}
