"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Clock3, Copy, MapPin, PartyPopper, Sparkles, Users } from "lucide-react";
import { createInvite, currentUser, supabase, type PartyRow } from "@/lib/partyhub";

export default function CelebrationPage() {
  const [party,setParty]=useState<PartyRow|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [inviteUrl,setInviteUrl]=useState("");
  const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState(false);\n  const [posterFailed,setPosterFailed]=useState(false);

  useEffect(()=>{
    let active=true;
    (async()=>{
      try {
        const params=new URLSearchParams(window.location.search);\n        setPosterFailed(params.get("poster")==="failed");\n        const id=params.get("id");
        if(!id) throw new Error("Celebration link is missing its ID.");
        const user=await currentUser();
        if(!user) { window.location.assign("/login/"); return; }
        const {data,error}=await supabase().from("parties")
          .select("id,title,description,party_type,starts_at,ends_at,arrival_from,arrival_until,timezone,currency,status,venue_map_url,poster_url,cost_amount,cost_basis,cost_negotiable")
          .eq("id",id).eq("host_id",user.id).single();
        if(error) throw error;
        if(active) setParty(data as PartyRow);
      } catch(e) { if(active) setError(e instanceof Error?e.message:"Could not load your celebration."); }
      finally { if(active) setLoading(false); }
    })();
    return ()=>{active=false;};
  },[]);

  async function makeInvite(){
    if(!party) return;
    setBusy(true);setError("");
    try {
      const token=await createInvite(party.id);
      const url=window.location.origin+"/invite/?token="+encodeURIComponent(token);
      setInviteUrl(url);
      try { await navigator.clipboard.writeText(url);setCopied(true); }
      catch { window.prompt("Copy your invitation link",url); }
    } catch(e) { setError(e instanceof Error?e.message:"Could not create invitation."); }
    finally { setBusy(false); }
  }

  const money=party?.cost_amount!==null&&party?.cost_amount!==undefined
    ? new Intl.NumberFormat("en-IN",{style:"currency",currency:party.currency,maximumFractionDigits:2}).format(party.cost_amount)
    : "";
  const basis=party?({per_person:"per person",per_venue:"per venue",per_hour:"per hour",total:"total budget"} as Record<string,string>)[party.cost_basis??"total"]:"";

  return <main className="shell">
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark"><PartyPopper size={20}/></span> partyhub</a><a className="login-link" href="/"><ArrowLeft size={15}/> Your celebrations</a></header>
    <section className="events-section" style={{maxWidth:720,margin:"48px auto"}}>
      {loading?<div className="empty-state">Loading your celebration…</div>:error?<div className="notice error-notice" role="alert">{error}</div>:party&&<>
        <div className="eyebrow"><Sparkles size={14}/> YOUR CELEBRATION IS READY</div>
        <h1 style={{fontSize:"clamp(32px,6vw,52px)",margin:"12px 0 8px"}}>{party.title}</h1>{posterFailed&&<div className="notice error-notice">Your party was created, but the poster upload failed. You can still invite guests; try uploading the poster again later.</div>}{party.poster_url&&<img className="celebration-poster" src={party.poster_url} alt={party.title+" poster"}/>}
        <p style={{color:"var(--muted,#777)"}}>Your celebration has been saved. Next, invite your people.</p>
        <article className="party-card" style={{marginTop:24}}>
          <div className="party-card-body">
            <div className="party-meta"><span><CalendarDays size={15}/>{new Date(party.starts_at).toLocaleString("en-IN",{dateStyle:"full",timeStyle:"short",timeZone:party.timezone})}</span></div>
            <div className="party-meta"><span><Clock3 size={15}/>{new Date(party.starts_at).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",timeZone:party.timezone})} – {new Date(party.ends_at).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",timeZone:party.timezone})}</span></div>
            {money&&<p><strong>{money}</strong> · {basis}{party.cost_negotiable?" · negotiable":""}</p>}
            {party.description&&<p>{party.description}</p>}
            {party.venue_map_url&&<p><MapPin size={15}/> <a href={party.venue_map_url} target="_blank" rel="noreferrer">View venue in Maps ↗</a></p>}
          </div>
        </article>
        <button className="primary-btn" style={{marginTop:20}} onClick={()=>void makeInvite()} disabled={busy}><Users size={17}/>{busy?"Creating invite…":"Create invitation link"}</button>
        {inviteUrl&&<div className="notice" style={{marginTop:16}}><p>Your invitation link is ready.</p><p style={{overflowWrap:"anywhere"}}>{inviteUrl}</p><button className="text-btn" onClick={()=>{void navigator.clipboard.writeText(inviteUrl);setCopied(true);}}><Copy size={15}/>{copied?"Copied!":"Copy link"}</button><a className="text-btn" style={{marginLeft:12}} href={"https://wa.me/?text="+encodeURIComponent("You're invited to "+party.title+"! "+inviteUrl)} target="_blank" rel="noreferrer">Share on WhatsApp ↗</a></div>}
        <p style={{marginTop:28}}><a href="/">← Back to your celebrations</a></p>
      </>}
    </section>
  </main>;
}
