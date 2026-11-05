"use client";
import { useEffect, useState } from "react";
import { CalendarDays, Clock3, PartyPopper, CheckCircle2, Users, ArrowLeft, RefreshCw } from "lucide-react";
import { getInvite, submitRsvp } from "@/lib/partyhub";

type Invite = NonNullable<Awaited<ReturnType<typeof getInvite>>>;
const dateText = (value: string, timezone: string) => new Intl.DateTimeFormat("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric", timeZone:timezone }).format(new Date(value));
const timeText = (value: string, timezone: string) => new Intl.DateTimeFormat("en-IN", { hour:"numeric", minute:"2-digit", timeZone:timezone }).format(new Date(value));
const editKey = (token: string, name: string) => `partyhub:rsvp-edit:${token}:${name.trim().toLowerCase()}`;

export default function InvitePage() {
  const [token,setToken]=useState("");
  const [party,setParty]=useState<Invite|null>(null);
  const [missing,setMissing]=useState(false);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState("");
  const [name,setName]=useState("");
  const [response,setResponse]=useState<"yes"|"maybe"|"no">("yes");
  const [count,setCount]=useState(1);
  const [diet,setDiet]=useState("none");
  const [sent,setSent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [editToken,setEditToken]=useState<string|null>(null);
  const [storageWarning,setStorageWarning]=useState(false);

  async function loadInvite(value: string) {
    setLoading(true); setLoadError(""); setMissing(false);
    try {
      const result = await getInvite(value);
      setParty(result);
      setMissing(!result);
    } catch {
      setLoadError("We couldn't load this invitation. Check your connection and try again.");
    } finally { setLoading(false); }
  }

  useEffect(()=>{
    const value=new URLSearchParams(location.search).get("token")??"";
    setToken(value);
    if(!value){setMissing(true);setLoading(false);return;}
    void loadInvite(value);
  },[]);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    if (!token || busy) return;
    if (!name.trim()) { setError("Enter your name before sending your RSVP."); return; }
    setBusy(true);setError("");setStorageWarning(false);
    let savedEditToken = editToken;
    if (!savedEditToken) {
      try { savedEditToken = localStorage.getItem(editKey(token,name)) || null; } catch { /* Storage may be disabled. */ }
    }
    try {
      const result = await submitRsvp({token,name,response,guestCount:count,dietaryType:diet,editToken:savedEditToken});
      const nextEditToken = result.edit_token || savedEditToken;
      setEditToken(nextEditToken);
      if (result.edit_token) {
        try { localStorage.setItem(editKey(token,name),result.edit_token); }
        catch { setStorageWarning(true); }
      }
      setSent(true);
    } catch {
      setError("We couldn't save your RSVP. If you've already responded with this name, use the same browser and device you used before.");
    } finally {setBusy(false);}
  }

  if(loading)return <main className="invite-page"><div className="invite-card" role="status">Loading your invitation…</div></main>;
  if(loadError)return <main className="invite-page"><div className="invite-card"><div className="brand"><span className="brand-mark"><PartyPopper size={20}/></span> partyhub</div><h1>Couldn't load this invitation.</h1><p>{loadError}</p><button className="secondary-btn" onClick={()=>void loadInvite(token)}><RefreshCw size={15}/> Try again</button></div></main>;
  if(missing||!party)return <main className="invite-page"><div className="invite-card"><div className="brand"><span className="brand-mark"><PartyPopper size={20}/></span> partyhub</div><h1>This invitation isn't available.</h1><p>It may have expired or been revoked. Ask your host for a fresh link.</p><a href="/" className="secondary-btn"><ArrowLeft size={15}/> PartyHub home</a></div></main>;

  return <main className="invite-page"><div className="invite-card"><div className="brand"><span className="brand-mark"><PartyPopper size={20}/></span> partyhub</div><div className="invite-spark">✳</div><div className="eyebrow">YOU'RE INVITED</div><h1>{party.title}</h1><p className="invite-intro">{party.description||"A little get-together, a lot of memories. We'd love to have you there."}</p><div className="invite-details"><span><CalendarDays size={17}/>{dateText(party.starts_at,party.timezone)}</span><span><Clock3 size={17}/>{timeText(party.starts_at,party.timezone)} – {timeText(party.ends_at,party.timezone)}</span>{party.arrival_from&&party.arrival_until&&<span><Clock3 size={17}/>Arrival {timeText(party.arrival_from,party.timezone)} – {timeText(party.arrival_until,party.timezone)}</span>}</div>
  {sent?<div className="success-state"><CheckCircle2 size={34}/><h2>Thanks, {name}!</h2><p>Your response has been saved. You can update it from this browser using your private RSVP edit permission.</p>{storageWarning&&<p className="notice error-notice" role="alert">Your browser blocked local storage. You can update this response until you close this page, but it may not be available after you leave.</p>}<button className="secondary-btn" onClick={()=>setSent(false)}>Update my RSVP</button></div>:<form className="rsvp-form" onSubmit={submit}><h2>Are you coming?</h2><label>Your name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="First and last name"/></label><div className="rsvp-options"><button type="button" className={response==="yes"?"selected":""} aria-pressed={response==="yes"} onClick={()=>setResponse("yes")}>🙌 Count me in</button><button type="button" className={response==="maybe"?"selected":""} aria-pressed={response==="maybe"} onClick={()=>setResponse("maybe")}>🤔 Maybe</button><button type="button" className={response==="no"?"selected":""} aria-pressed={response==="no"} onClick={()=>setResponse("no")}>💌 Can't make it</button></div><label><Users size={15}/> Number of guests including you<select value={count} onChange={e=>setCount(Number(e.target.value))}>{Array.from({length:20},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label><label>Food preference<select value={diet} onChange={e=>setDiet(e.target.value)}><option value="none">No preference</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option><option value="jain">Jain</option><option value="non_vegetarian">Non-vegetarian</option><option value="other">Other / I'll message the host</option></select></label>{error&&<div className="notice error-notice" role="alert">{error}</div>}<button className="primary-btn full-btn" type="submit" disabled={busy}>{busy?"Saving…":"Send my RSVP →"}</button></form>}<p className="invite-foot">A private celebration, shared with your people. ✦</p></div></main>;
}
