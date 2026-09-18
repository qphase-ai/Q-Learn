import { AuroraBackground, GlowingOrbs } from "@/components/backgrounds";

export default function PricingPage() {
  // No pre-existing root wrapper — added a minimal `relative` div so the
  // background layers (fixed/absolute, pointer-events-none) have a
  // positioning context without altering the original content below.
  return (
    <div className="relative">
      <AuroraBackground />
      <GlowingOrbs />
      <div>Pricing</div>
    </div>
  );
}
