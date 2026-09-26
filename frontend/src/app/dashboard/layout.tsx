/**
 * Bare layout for `/dashboard`. The route mounts its own `LabShell` chrome
 * (header/activity-bar/sidebar/tutor panel), which now also renders
 * `AuthHydrator` itself — every `LabShell`-mounting route hydrates the auth
 * session on mount, so this layout doesn't need to do it separately.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen bg-background text-foreground">{children}</div>;
}
