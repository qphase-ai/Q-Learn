import Link from "next/link";

export function HomeFooter() {
  return (
    <footer className="border-t border-white/8 px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <span>© 2025 Q-Learn</span>

        <nav aria-label="Footer navigation">
          <ul className="flex items-center gap-6" role="list">
            <li>
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms
              </Link>
            </li>
            <li>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                GitHub
              </a>
            </li>
          </ul>
        </nav>

        <span>Made with ♥ for quantum learners</span>
      </div>
    </footer>
  );
}
