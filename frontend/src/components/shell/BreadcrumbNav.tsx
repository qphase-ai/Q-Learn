"use client";

import { usePathname } from "next/navigation";
import { WORKSPACES, workspaceFromPathname } from "@/lib/workspaces";

export default function BreadcrumbNav() {
  const pathname = usePathname();
  const id = workspaceFromPathname(pathname ?? "");
  const label = WORKSPACES.find((w) => w.id === id)?.label ?? "Q-Learn";

  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
      <span className="text-foreground">{label}</span>
    </nav>
  );
}
