"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function getDeviceInfo() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edge/.test(ua);
  return { isIOS, isAndroid, isSafari, isChrome };
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // default true to avoid flash
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [device, setDevice] = useState<{ isIOS: boolean; isAndroid: boolean; isSafari: boolean; isChrome: boolean } | null>(null);

  useEffect(() => {
    // Already installed as PWA
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsStandalone(standalone);
    if (standalone) return;

    // Check if user previously dismissed
    const dismissedAt = localStorage.getItem("pwa-install-dismissed");
    if (dismissedAt) {
      // Re-show after 7 days
      const days = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (days < 7) {
        setDismissed(true);
        return;
      }
      localStorage.removeItem("pwa-install-dismissed");
    }

    setDevice(getDeviceInfo());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setDismissed(true);
      }
      return;
    }

    // iOS / Safari — show guide
    if (device?.isIOS) {
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowIOSGuide(false);
    localStorage.setItem("pwa-install-dismissed", String(Date.now()));
  };

  if (isStandalone || dismissed || !device) return null;

  // Show for: Chromium (has beforeinstallprompt), iOS Safari (manual guide), or Android Chrome
  const canShow = deferredPrompt || device.isIOS || device.isAndroid;
  if (!canShow) return null;

  return (
    <>
      <div className="fixed bottom-20 left-3 right-3 z-50 animate-in slide-in-from-bottom-4 duration-300 sm:left-auto sm:right-4 sm:max-w-sm">
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-card p-3 shadow-lg">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            {device.isIOS ? (
              <Share className="h-5 w-5 text-primary" />
            ) : (
              <Download className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Install Admin App</p>
            <p className="text-xs text-muted-foreground">
              {device.isIOS
                ? "Add to Home Screen for quick access"
                : "Install for quick access & offline use"}
            </p>
          </div>
          <Button size="sm" onClick={handleInstall} className="shrink-0">
            {device.isIOS ? "How" : "Install"}
          </Button>
          <button onClick={handleDismiss} className="shrink-0 p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* iOS instruction overlay */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4" onClick={handleDismiss}>
          <div
            className="w-full max-w-sm animate-in slide-in-from-bottom-8 duration-300 rounded-2xl bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Install Passport Pub Admin</h3>
            <ol className="space-y-4 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                <span>
                  Tap the <strong className="text-foreground">Share</strong> button
                  <Share className="inline-block h-4 w-4 mx-1 text-primary" />
                  in the Safari toolbar
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                <span>
                  Scroll down and tap <strong className="text-foreground">&quot;Add to Home Screen&quot;</strong>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                <span>
                  Tap <strong className="text-foreground">&quot;Add&quot;</strong> to confirm
                </span>
              </li>
            </ol>
            <Button className="w-full mt-5" variant="outline" onClick={handleDismiss}>
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
