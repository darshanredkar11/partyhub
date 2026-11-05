"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Clock3, Copy, MapPin, PartyPopper, Sparkles, Users, Wallet, CheckCircle2, Share2 } from "lucide-react";
import { createInvite, currentUser, supabase, type PartyRow } from "@/lib/partyhub";

export default function CelebrationPage() {
  const [party,setParty]=useState<PartyRow|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [inviteUrl,setInviteUrl]=useState("");
  const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState(false);
  const [posterFailed,setPosterFailed]=useState(false);

  useEffect(()=>{
    let active=true;
    (async()=>{
      try {
        const params=new URLSearchParams(window.location.search);
        setPosterFailed(params.get("poster")==="failed");
        const id=params.get("id");
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
  const basis=party?({per_person:"Per person",per_venue:"Per venue",per_hour:"Per hour",total:"Total budget"} as Record<string,string>)[party.cost_basis??"total"]:"";
  const date=party?new Intl.DateTimeFormat("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:party.timezone}).format(new Date(party.starts_at)):"";
  const start=party?new Intl.DateTimeFormat("en-IN",{hour:"numeric",minute:"2-digit",timeZone:party.timezone}).format(new Date(party.starts_at)):"";
  const end=party?new Intl.DateTimeFormat("en-IN",{hour:"numeric",minute:"2-digit",timeZone:party.timezone}).format(new Date(party.ends_at)):"";

  return <main className="shell celebration-shell">
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark"><PartyPopper size={20}/></span> partyhub</a><a className="login-link" href="/"><ArrowLeft size={15}/> Your celebrations</a></header>
    <section className="celebration-page">
      {loading?<div className="empty-state">Loading your celebration…</div>:error?<div className="notice error-notice" role="alert">{error}</div>:party&&<>
        <div className="celebration-success"><span className="celebration-success-icon"><CheckCircle2 size={18}/></span><span>CELEBRATION CREATED</span></div>
        <div className="celebration-heading">
          <div><div className="eyebrow"><Sparkles size={14}/> THE GOOD TIMES START HERE</div><h1>{party.title}</h1><p>Your celebration is saved. Now let's get your people together.</p></div>
        </div>
        <article className="celebration-feature">
          <div className="celebration-art">
            {party.poster_url?<img src={party.poster_url} alt={party.title+" poster"}/>:<div className="celebration-art-fallback"><span>✳</span><strong>{party.title}</strong><small>YOU'RE INVITED TO CELEBRATE</small><i>✦　✧　✦</i></div>}
          </div>
          <div className="celebration-details">
            <div className="celebration-detail-grid">
              <div className="celebration-detail"><span className="detail-icon"><CalendarDays size={18}/></span><div><small>DATE</small><strong>{date}</strong></div></div>
              <div className="celebration-detail"><span className="detail-icon"><Clock3 size={18}/></span><div><small>TIME</small><strong>{start} – {end}</strong></div></div>
              {money&&<div className="celebration-detail"><span className="detail-icon"><Wallet size={18}/></span><div><small>COST · {basis.toUpperCase()}</small><strong>{money}{party.cost_negotiable?" · Negotiable":""}</strong></div></div>}
              {party.venue_map_url&&<div className="celebration-detail"><span className="detail-icon"><MapPin size={18}/></span><div><small>VENUE</small><a href={party.venue_map_url} target="_blank" rel="noreferrer">View venue in Maps ↗</a></div></div>}
            </div>
            {party.description&&<div className="celebration-host-note"><small>A NOTE FROM THE HOST</small><p>{party.description}</p></div>}
          </div>
        </article>
        {posterFailed&&<div className="notice error-notice">Your party was created, but the poster upload failed. You can still invite guests; try uploading the poster again later.</div>}
        <section className="celebration-invite-panel"><div className="invite-panel-icon"><Users size={22}/></div><div className="invite-panel-copy"><h2>Make it a party.</h2><p>Create a private invitation link and send it to your guests.</p></div><button className="primary-btn" onClick={()=>void makeInvite()} disabled={busy}><Share2 size={17}/>{busy?"Creating invitation…":"Create invitation link"}</button></section>
        {inviteUrl&&<div className="celebration-share-result"><div><CheckCircle2 size={18}/><strong>Your invitation link is ready!</strong></div><p>{inviteUrl}</p><div className="celebration-share-actions"><button className="secondary-btn" onClick={()=>{void navigator.clipboard.writeText(inviteUrl);setCopied(true);}}><Copy size={15}/>{copied?"Copied!":"Copy link"}</button><a className="primary-btn" href={"https://wa.me/?text="+encodeURIComponent("You're invited to "+party.title+"! "+inviteUrl)} target="_blank" rel="noreferrer">Share on WhatsApp ↗</a></div></div>}
        <a className="celebration-back" href="/"><ArrowLeft size={15}/> Back to your celebrations</a>
      </>}
    </section>
    <footer><span>partyhub ✳</span><span>Made for the moments that matter.</span><span>India · UK</span></footer>
  </main>;
}
