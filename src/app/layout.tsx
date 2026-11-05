import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "PartyHub — Private celebrations",
  description: "Plan your party, invite your people and keep the memories together.",
  applicationName: "PartyHub",
  manifest: "/manifest.webmanifest",\n  referrer: "no-referrer",\n  icons: { icon: "/icons/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#fffaf4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}