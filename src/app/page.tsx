"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, MapPin, Plus, Sparkles, Users, PartyPopper, Copy, ArrowUpRight, X, LogOut, RefreshCw } from "lucide-react";
import { currentUser, createInvite, createParty, listHostParties, supabase, supabaseConfigured, type PartyRow } from "@/lib/partyhub";

const dateLabel = (value: string, timezone: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: timezone }).format(new Date(value));
const localDate = () => { const now = new Date(); const offset = now.getTimezoneOffset(); return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10); };
const timeLabel = (value: string, timezone: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(value));

export default function Home() {
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState("");
  const [form, setForm] = useState({ title: "", description: "", date: "", start: "19:00", end: "23:00", arrivalFrom: "18:30", arrivalUntil: "20:00", currency: "INR" as "INR" | "GBP", partyType: "house_party" });

  const refresh = useCallback(async () => {
    setError("");
    let authenticated = false;
    try {
      const user = await currentUser();
      if (!user) { setUserEmail(""); setParties([]); return; }
      authenticated = true;
      setUserEmail(user.email ?? "");
      const rows = await listHostParties(user.id);
      setParties(rows);
    } catch {
      // Never leave a previous account's private party data on screen after an
      // auth or database failure.
      setParties([]);
      if (!authenticated) setUserEmail("");
      setError("We couldn't load your celebrations. Check your connection and try again.");
    } finally { setLoaded(true); }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured()) { setLoaded(true); return; }
    const client = supabase();
    void refresh();
    const { data: listener } = client.auth.onAuthStateChange(() => { queueMicrotask(() => { void refresh(); }); });
    return () => listener.subscription.unsubscribe();
  }, [refresh]);

  const total = parties.reduce((n, p) => n + (p.guest_rsvps?.reduce((m, g) => m + g.guest_count, 0) ?? 0), 0);
  const yes = parties.reduce((n, p) => n + (p.guest_rsvps?.filter(g => g.response === "yes").reduce((m, g) => m + g.guest_count, 0) ?? 0), 0);
  const upcoming = useMemo(() => [...parties].sort((a,b) => a.starts_at.localeCompare(b.starts_at)), [parties]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      await createParty({ ...form, timezone });
      setShowCreate(false);
      setForm({ title: "", description: "", date: "", start: "19:00", end: "23:00", arrivalFrom: "18:30", arrivalUntil: "20:00", currency: "INR", partyType: "house_party" });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create the celebration."); }
    finally { setBusy(false); }
  }

  async function shareInvite(partyId: string) {
    setBusy(true); setError("");
    try {
      const token = await createInvite(partyId);
      const url = location.origin + "/invite/?token=" + encodeURIComponent(token);
      setInviteLinks(prev => ({ ...prev, [partyId]: url }));
      try { await navigator.clipboard.writeText(url); setCopied(partyId); }
      catch { window.prompt("Copy your invitation link", url); }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create invitation."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true); setError("");
    try { const { error } = await supabase().auth.signOut(); if (error) throw error; setParties([]); setUserEmail(""); }
    catch { setError("We could not sign you out. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  async function copyInviteLink(partyId: string) {
    const url = inviteLinks[partyId];
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(partyId); setError(""); }
    catch { setError("Clipboard access was blocked. Open the invitation link and copy it from the address bar."); }
  }
  useEffect(() => {
    if (!showCreate) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setShowCreate(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showCreate]);

  const configMissing = !supabaseConfigured();

  return <main className="shell">
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark"><PartyPopper size={20}/></span> partyhub</a><div className="top-actions">{userEmail ? <><span className="login-link">{userEmail}</span><button className="text-btn" onClick={signOut} disabled={busy}><LogOut size={15}/> Sign out</button></> : <a className="login-link" href="/login/">Host sign in <ArrowUpRight size={15}/></a>}</div></header>
    <section className="hero"><div className="hero-copy"><div className="eyebrow"><Sparkles size={14}/> GOOD TIMES, WELL PLANNED</div><h1>Bring your people<br/><em>together.</em></h1><p>One little place for the plans, the people and the memories that make a party.</p>{userEmail ? <button className="primary-btn" onClick={()=>setShowCreate(true)}><Plus size={18}/> Plan a celebration</button> : <a className="primary-btn link-btn" href="/login/">Sign in to get started <ArrowUpRight size={16}/></a>}</div><div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-center">✳</div><span className="floaty f1">🥂</span><span className="floaty f2">🎈</span><span className="floaty f3">🎂</span><span className="floaty f4">✦</span><div className="art-caption">MAKE IT A<br/>NIGHT TO REMEMBER</div></div></section>
    {configMissing && <div className="notice error-notice">Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to the deployment environment.</div>}
    {error && <div className="notice error-notice" role="alert">{error}</div>}
    <section className="stats"><div className="stat"><span>YOUR CELEBRATIONS</span><strong>{String(parties.length).padStart(2,"0")}</strong></div><div className="stat"><span>GUESTS RESPONDED</span><strong>{String(total).padStart(2,"0")}</strong></div><div className="stat"><span>CAN'T WAIT TO COME</span><strong>{String(yes).padStart(2,"0")}</strong></div></section>
    <section className="events-section"><div className="section-heading"><div><div className="eyebrow">THE GOOD STUFF</div><h2>Your celebrations</h2></div>{userEmail && <div className="top-actions"><button className="text-btn" aria-label="Refresh celebrations" onClick={()=>void refresh()}><RefreshCw size={15}/> Refresh</button><button className="text-btn" onClick={()=>setShowCreate(true)}><Plus size={16}/> New party</button></div>}</div>
    {!loaded ? <div className="empty-state">Getting things ready…</div> : !userEmail ? <div className="empty-state"><div className="empty-icon">✳</div><h3>Your celebrations, all in one place.</h3><p>Sign in with your email to create a party and invite your people.</p><a className="primary-btn link-btn" href="/login/">Host sign in</a></div> : upcoming.length===0 ? <div className="empty-state"><div className="empty-icon">✳</div><h3>Your next great story starts here.</h3><p>Create a celebration and invite your favourite people.</p><button className="primary-btn" onClick={()=>setShowCreate(true)}><Plus size={18}/> Create your first party</button></div> : <div className="party-grid">{upcoming.map((p,i)=>{const guests=p.guest_rsvps??[];const attending=guests.filter(g=>g.response==="yes").reduce((n,g)=>n+g.guest_count,0);return <article className="party-card" key={p.id}><div className={"card-band band-"+(i%4)}><span>{["✳","☼","✦","❋"][i%4]}</span><small>{guests.length} RSVP{guests.length===1?"":"S"}</small></div><div className="party-card-body"><div className="party-date">{dateLabel(p.starts_at,p.timezone)}</div><h3>{p.title}</h3><div className="party-meta"><span><Clock3 size={14}/>{timeLabel(p.starts_at,p.timezone)} – {timeLabel(p.ends_at,p.timezone)}</span></div><div className="card-footer"><span><Users size={15}/>{attending} attending</span><button onClick={()=>void shareInvite(p.id)} className="invite-btn" disabled={busy}><Copy size={14}/>{copied===p.id?"Copied!":"Create invite"}</button></div>{inviteLinks[p.id] && <div className="invite-share"><a href={"https://wa.me/?text="+encodeURIComponent("You're invited to "+p.title+"! "+inviteLinks[p.id])} target="_blank" rel="noreferrer">Share on WhatsApp ↗</a><button className="text-btn" onClick={()=>void copyInviteLink(p.id)}>Copy link</button></div>}<details className="rsvp-list"><summary>View guest responses ({guests.length})</summary>{guests.length===0?<p>No responses yet.</p>:guests.map(g=><div className="guest-row" key={g.id}><span>{g.display_name} · {g.guest_count}</span><span>{g.response} · {g.dietary_type??"No preference"}</span></div>)}</details></div></article>})}</div>}</section>
    <footer><span>partyhub ✳</span><span>Made for the moments that matter.</span><span>India · UK</span></footer>
    {showCreate && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowCreate(false)}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-party-title"><div className="modal-head"><div><div className="eyebrow">LET'S MAKE A PLAN</div><h2 id="create-party-title">New celebration</h2></div><button className="close-btn" onClick={()=>setShowCreate(false)} aria-label="Close"><X/></button></div><form onSubmit={onCreate} className="party-form"><label>What's the occasion?<input autoFocus required maxLength={120} placeholder="e.g. Rooftop birthday bash" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Type<select value={form.partyType} onChange={e=>setForm({...form,partyType:e.target.value})}><option value="house_party">House party</option><option value="birthday">Birthday</option><option value="dinner">Dinner</option><option value="game_night">Game night</option><option value="celebration">Celebration</option><option value="other">Other</option></select></label><label>Date<input required type="date" min={localDate()} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><div className="form-row"><label>Starts<input type="time" required value={form.start} onChange={e=>setForm({...form,start:e.target.value})}/></label><label>Ends<input type="time" required value={form.end} onChange={e=>setForm({...form,end:e.target.value})}/></label></div><div className="form-row"><label>Arrival from<input type="time" value={form.arrivalFrom} onChange={e=>setForm({...form,arrivalFrom:e.target.value})}/></label><label>Arrival until<input type="time" value={form.arrivalUntil} onChange={e=>setForm({...form,arrivalUntil:e.target.value})}/></label></div><label>Guest notes<textarea rows={3} maxLength={5000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Dress code, what to bring, and other notes for your guests. Avoid putting a private home address here."/></label><label>Currency<select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value as "INR"|"GBP"})}><option value="INR">INR · ₹</option><option value="GBP">GBP · £</option></select></label><button className="primary-btn full-btn" type="submit" disabled={busy}><Sparkles size={17}/>{busy?"Creating…":"Create celebration"}</button><p className="form-footnote">Your celebration is saved to your account. Invitation links can be forwarded, so only include details guests may see.</p></form></section></div>}
  </main>;
}
