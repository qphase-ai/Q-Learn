export type WorkspaceId =
  | "dashboard"
  | "learn"
  | "circuit"
  | "code"
  | "quiz"
  | "settings";

export interface WorkspaceMeta {
  id: WorkspaceId;
  label: string;
  href: string;
}

export const WORKSPACES: WorkspaceMeta[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "learn", label: "Learn", href: "/learn" },
  { id: "circuit", label: "Circuit", href: "/circuit" },
  { id: "code", label: "Code", href: "/code" },
  { id: "quiz", label: "Quiz", href: "/quiz" },
  { id: "settings", label: "Settings", href: "/settings/billing" },
];

export function workspaceFromPathname(pathname: string): WorkspaceId | null {
  const segment = pathname.split("/")[1] ?? "";
  const match = WORKSPACES.find((w) => w.id === segment);
  return match ? match.id : null;
}
