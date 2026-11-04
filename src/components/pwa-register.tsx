"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.error("PartyHub service worker registration failed", error);
      });
    }
  }, []);

  return null;
}