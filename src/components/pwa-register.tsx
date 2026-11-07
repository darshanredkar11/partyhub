"use client";

import { useEffect, useState } from "react";
import { Download, Share, X, Smartphone } from "lucide-react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }> };

export function PwaRegister() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => console.error("PartyHub service worker registration failed", error));
    }
    const ua = window.navigator.userAgent;
    const isIosDevice = /iphone|ipad|ipod/i.test(ua) && !(window.navigator as Navigator & { standalone?: boolean }).standalone;
    setIos(isIosDevice);
    const onBeforeInstall = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); setShowIosHelp(false); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onBeforeInstall); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }

  if (installed || (!prompt && !ios)) return null;
  return <>
    <aside className="pwa-install-bar" aria-label="Install PartyHub">
      <span className="pwa-install-icon"><Smartphone size={19}/></span>
      <span className="pwa-install-copy"><strong>Take PartyHub with you</strong><small>Install the app for a smoother experience</small></span>
      {prompt ? <button type="button" onClick={() => void install()}><Download size={15}/> Install</button> : <button type="button" onClick={() => setShowIosHelp(true)}><Share size={15}/> How to install</button>}
      <button type="button" className="pwa-dismiss" aria-label="Dismiss install prompt" onClick={() => { setInstalled(true); setShowIosHelp(false); }}><X size={16}/></button>
    </aside>
    {showIosHelp && <div className="pwa-help-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowIosHelp(false); }}><section className="pwa-help-card" role="dialog" aria-modal="true" aria-labelledby="pwa-help-title"><button type="button" className="pwa-help-close" onClick={() => setShowIosHelp(false)} aria-label="Close"><X size={18}/></button><div className="pwa-help-symbol"><Share size={24}/></div><h2 id="pwa-help-title">Add PartyHub to your Home Screen</h2><ol><li>Tap the <strong>Share</strong> button in Safari.</li><li>Scroll down and choose <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong> to finish.</li></ol><p>PartyHub will open like an app, without the browser toolbar.</p></section></div>}
  </>;
}
