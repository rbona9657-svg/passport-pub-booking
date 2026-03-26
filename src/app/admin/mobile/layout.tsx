"use client";

import { useEffect, useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Map,
  CalendarDays,
  Phone,
  Mic,
  LogOut,
  Bell,
  BellRing,
} from "lucide-react";
import { signOut } from "next-auth/react";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const tabs = [
  { href: "/admin/mobile/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/mobile/quick-book", label: "Quick Book", icon: Phone },
  { href: "/admin/mobile/floor-plan", label: "Floor Plan", icon: Map },
  { href: "/admin/mobile/voice-book", label: "Voice", icon: Mic },
];

export default function MobileAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { permission, isSubscribed, subscribe } = usePushNotifications();
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings/pending-count");
      if (!res.ok) return;
      const { count } = await res.json();
      setPendingCount(count);
      // Also try native badge API for Android
      if ("setAppBadge" in navigator) {
        if (count > 0) {
          await (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(count);
        } else {
          await (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge();
        }
      }
    } catch {
      // Ignore errors
    }
  }, []);

  useEffect(() => {
    if (!session || session.user?.role !== "admin") return;
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30_000);
    return () => clearInterval(interval);
  }, [session, fetchPendingCount]);

  if (!session || session.user?.role !== "admin") {
    return null;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
            PP
          </div>
          <span className="text-sm font-semibold">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          {permission !== "granted" || !isSubscribed ? (
            <button
              onClick={subscribe}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Enable push notifications"
            >
              <Bell className="h-3.5 w-3.5" />
              Notifications
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-primary" title="Notifications enabled">
              <BellRing className="h-3.5 w-3.5" />
              On
            </span>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        {children}
      </main>

      {/* Bottom tab navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex h-16 items-center justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 transition-colors min-w-[64px]",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground"
                )}
              >
                <span className="relative">
                  <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                  {tab.href === "/admin/mobile/bookings" && pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                      {pendingCount > 99 ? "99+" : pendingCount}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <InstallPrompt />
    </div>
  );
}
