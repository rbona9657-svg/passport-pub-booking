"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useState } from "react";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            PP
          </div>
          <span className="text-lg font-bold tracking-tight hidden sm:inline">Passport Pub</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link href="/book">
            <Button variant="ghost" size="sm">Book a Table</Button>
          </Link>
          <Link href="/cancel">
            <Button variant="ghost" size="sm">My Bookings</Button>
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/book">
            <Button size="sm" className="hidden md:inline-flex">Reserve Now</Button>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border/40 bg-background px-4 py-3 space-y-1">
          <Link href="/book" onClick={() => setMobileOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full justify-start">Book a Table</Button>
          </Link>
          <Link href="/cancel" onClick={() => setMobileOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full justify-start">My Bookings</Button>
          </Link>
        </div>
      )}
    </header>
  );
}
