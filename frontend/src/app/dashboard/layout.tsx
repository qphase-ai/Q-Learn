import AuthHydrator from "@/components/shell/AuthHydrator";

/**
 * Bare layout for `/dashboard` — deliberately outside the `(shell)` route
 * group. The dashboard workspace renders its own header/activity-bar/tutor
 * panel (see `DashboardWorkspace`), which replace the global `AppShell`
 * chrome (`TitleBar`/`ActivityBar`/`BottomPanel`/`StatusBar`/`TutorFAB`) for
 * this route only. Every other workspace keeps that chrome unchanged via
 * `app/(shell)/layout.tsx`.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen bg-background text-foreground">
      <AuthHydrator />
      {children}
    </div>
  );
}
