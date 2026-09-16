import BreadcrumbNav from "@/components/shell/BreadcrumbNav";
import XPProgressBar from "@/components/shell/XPProgressBar";
import UserMenu from "@/components/shell/UserMenu";

export default function TitleBar() {
  return (
    <header className="flex h-9 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] px-3">
      <BreadcrumbNav />
      <div className="flex items-center gap-4">
        <XPProgressBar />
        <UserMenu />
      </div>
    </header>
  );
}
