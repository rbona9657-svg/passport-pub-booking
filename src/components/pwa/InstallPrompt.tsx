"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsStandalone(true);
      return;
    }

    // Check if user previously dismissed
    if (localStorage.getItem("pwa-install-dismissed")) {
      setDismissed(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", "1");
  };

  // Don't show if already installed, dismissed, or no prompt available
  if (isStandalone || dismissed || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 animate-in slide-in-from-bottom-4 duration-300 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-card p-3 shadow-lg">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Install App</p>
          <p className="text-xs text-muted-foreground">Quick access from your home screen</p>
        </div>
        <Button size="sm" onClick={handleInstall} className="shrink-0">
          Install
        </Button>
        <button onClick={handleDismiss} className="shrink-0 p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
