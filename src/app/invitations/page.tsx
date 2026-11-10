"use client";
import {useCallback,useEffect,useState} from "react";
import {ArrowLeft,CalendarDays,Clock3,MapPin,Check, X, RefreshCw, PartyPopper, Inbox} from "lucide-react";
import {currentUser,listMyInvitations,respondToInvitation,type MemberInvitation} from "@/lib/partyhub";

const dateLabel=(v:string,tz:string)=>new Intl.DateTimeFormat("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric",timeZone:tz}).format(new Date(v));
const timeLabel=(v:string,tz:string)=>new Intl.DateTimeFormat("en-IN",{hour:"numeric",minute:"2-digit",timeZone:tz}).format(new Date(v));
export default function InvitationsPage(){
 const [rows,setRows]=useState<MemberInvitation[]>([]),[filter,setFilter]=useState("pending"),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[error,setError]=useState("");
 const refresh=useCallback(async()=>{setError("");try{const user=await currentUser();if(!user){location.assign("/login/");return;}setRows(await listMyInvitations());}catch(e){setError(e instanceof Error?e.message:"Could not load invitations.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 async function respond(id:string,value:"accepted"|"declined"){setBusy(id);setError("");try{await respondToInvitation(id,value);await refresh();}catch(e){setError(e instanceof Error?e.message:"Could not update invitation.");}finally{setBusy("");}}
 const visible=rows.filter(r=>filter==="all"?true:r.status===filter);
 return <main className="shell invitations-shell">
  <header className="topbar"><a className="brand" href="/"><span className="brand-mark"><PartyPopper size={19}/></span> partyhub</a><nav className="inbox-nav"><a href="/">Home</a><a href="/#celebrations">My celebrations</a></nav></header>
  <section className="inbox-intro"><div><div className="eyebrow"><Inbox size={14}/> YOUR SOCIAL CALENDAR</div><h1>Invitations</h1><p>Every plan your people have invited you to, all in one place.</p></div><button className="secondary-btn" onClick={()=>void refresh()}><RefreshCw size={15}/> Refresh</button></section>
  <div className="inbox-tabs">{["pending","accepted","declined","all"].map(v=><button key={v} className={filter===v?"active":""} onClick={()=>setFilter(v)}>{v==="all"?"All":v[0].toUpperCase()+v.slice(1)} <span>{rows.filter(r=>v==="all"?true:r.status===v).length}</span></button>)}</div>
  {error&&<div className="notice error-notice">{error}</div>}
  {loading?<div className="empty-state">Loading your invitations…</div>:visible.length===0?<div className="empty-state"><div className="empty-icon">✳</div><h3>{filter==="pending"?"Nothing waiting for you.":"No invitations here yet."}</h3><p>When someone invites your PartyHub account, it will appear here.</p><a className="secondary-btn" href="/">Back to home</a></div>:
   <div className="invitation-list">{visible.map(row=>{const p=row.parties;return <article className="member-invite-card" key={row.id}>
    <div className="member-invite-poster">{p.poster_url?<img src={p.poster_url} alt={p.title}/>:<span>✳</span>}</div>
    <div className="member-invite-content"><div className="member-invite-status">{row.status.replace("_"," ")}</div><h2>{p.title}</h2><p>{p.description||"You have been invited to join this celebration."}</p>
     <div className="member-invite-meta"><span><CalendarDays size={15}/>{dateLabel(p.starts_at,p.timezone)}</span><span><Clock3 size={15}/>{timeLabel(p.starts_at,p.timezone)} – {timeLabel(p.ends_at,p.timezone)}</span>{p.venue_map_url&&<a href={p.venue_map_url} target="_blank" rel="noreferrer"><MapPin size={15}/> Venue map</a>}</div>
     {p.cost_amount!==null&&<div className="party-cost">{new Intl.NumberFormat("en-IN",{style:"currency",currency:p.currency,maximumFractionDigits:0}).format(p.cost_amount)} · {p.cost_basis.replaceAll("_"," ")}{p.cost_negotiable?" · negotiable":""}</div>}
     <div className="member-invite-actions">{row.status==="pending"?<><button className="primary-btn" disabled={busy===row.id} onClick={()=>void respond(row.id,"accepted")}><Check size={16}/>{busy===row.id?"Saving…":"Accept invitation"}</button><button className="secondary-btn" disabled={busy===row.id} onClick={()=>void respond(row.id,"declined")}><X size={16}/> Decline</button></>:row.status==="accepted"?<a className="primary-btn link-btn" href={"/celebration/?id="+encodeURIComponent(p.id)}>Open celebration <ArrowLeft size={15}/></a>:<span className="muted-note">You declined this invitation.</span>}</div>
    </div></article>})}</div>}
  <footer><span>partyhub ✳</span><span>Made for the moments that matter.</span><span>India · UK</span></footer>
 </main>;
}
