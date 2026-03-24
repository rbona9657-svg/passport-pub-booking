import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/providers";
import { Toaster } from "@/components/ui/toaster";
import ServiceWorkerRegistration from "@/components/pwa/ServiceWorkerRegistration";

const inter = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "Passport Pub - Table Booking",
  description: "Book your table at Passport Pub, Budapest",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Passport Pub",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1a1a2e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster />
          <ServiceWorkerRegistration />
        </Providers>
      </body>
    </html>
  );
}
