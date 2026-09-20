"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MagneticButton } from "@/components/effects";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/8 bg-background/60 backdrop-blur-md">
      <nav
        className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link
          href="/"
          className="text-lg font-semibold text-cyber-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan/60"
        >
          Q-Learn
        </Link>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-8" role="list">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan/60 rounded"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/auth/login">Sign In</Link>
          </Button>
          <MagneticButton asChild variant="primary" size="sm">
            <Link href="/auth/register">Get Started</Link>
          </MagneticButton>
        </div>

        {/* Mobile hamburger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex flex-col gap-6 pt-12">
            <ul className="flex flex-col gap-4" role="list">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="text-base text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3 mt-auto">
              <Button asChild variant="outline" className="w-full">
                <Link href="/auth/login" onClick={() => setOpen(false)}>
                  Sign In
                </Link>
              </Button>
              <Button asChild variant="primary" className="w-full">
                <Link href="/auth/register" onClick={() => setOpen(false)}>
                  Get Started
                </Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
