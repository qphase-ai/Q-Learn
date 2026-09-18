import AppShell from "@/components/shell/AppShell";
import { GridBackground, NoiseOverlay } from "@/components/backgrounds";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Chrome-appropriate background layer — fixed, -z-10, pointer-events-none;
          sits behind AppShell and never intercepts its zones. */}
      <GridBackground />
      <NoiseOverlay />
      <AppShell>{children}</AppShell>
    </>
  );
}
