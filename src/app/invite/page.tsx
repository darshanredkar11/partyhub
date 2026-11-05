"use client";
import { useEffect, useState } from "react";
import { CalendarDays, Clock3, PartyPopper, CheckCircle2, Users, ArrowLeft, MapPin } from "lucide-react";
import { getInvite, submitRsvp } from "@/lib/partyhub";

type Invite = Awaited<ReturnType<typeof getInvite>>;
const dateText = (value: string, timezone: string) => new Intl.DateTimeFormat("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric", timeZone:timezone }).format(new Date(value));
const timeText = (value: string, timezone: string) => new Intl.DateTimeFormat("en-IN", { hour:"numeric", minute:"2-digit", timeZone:timezone }).format(new Date(value));
const mapUrlFrom = (description: string) => description.split("\n\n").find(part => part.startsWith("VENUE_MAP_URL: "))?.slice(15) ?? "";
const cleanDescription = (description: string) => description.split("\n\n").filter(part => !part.startsWith("VENUE_MAP_URL: ")).join("\n\n").trim();

export default function InvitePage() {
  const [token,setToken]=useState("");
  const [party,setParty]=useState<Invite|null>(null);
  const [missing,setMissing]=useState(false);
  const [loading,setLoading]=useState(true);
  const [name,setName]=useState("");
  const [response,setResponse]=useState<"yes"|"maybe"|"no">("yes");
  const [count,setCount]=useState(1);
  const [diet,setDiet]=useState("none");
  const [sent,setSent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    const value=new URLSearchParams(location.search).get("token")??"";
    setToken(value);
    if(!value){setMissing(true);setLoading(false);return;}
    getInvite(value).then(setParty).catch(()=>setMissing(true)).finally(()=>setLoading(false));
  },[]);

  async function submit(e:React.FormEvent){
    e.preventDefault();if(!token||!name.trim())return;
    setBusy(true);setError("");
    try{await submitRsvp({token,name,response,guestCount:count,dietaryType:diet});setSent(true);}
    catch(e){setError(e instanceof Error?e.message:"We couldn't save your RSVP. Please try again.");}
    finally{setBusy(false);}
  }

  if(loading)return <main className="invite-page"><div className="invite-card">Loading your invitation…</div></main>;
  if(missing||!party)return <main className="invite-page"><div className="invite-card"><div className="brand"><span className="brand-mark"><PartyPopper size={20}/></span> partyhub</div><h1>This invitation isn't available.</h1><p>It may have expired, been revoked or reached its guest limit. Ask your host for a fresh link.</p><a href="/" className="secondary-btn"><ArrowLeft size={15}/> PartyHub home</a></div></main>;

  return <main className="invite-page"><div className="invite-card"><div className="brand"><span className="brand-mark"><PartyPopper size={20}/></span> partyhub</div><div className="invite-spark">✳</div><div className="eyebrow">YOU'RE INVITED</div><h1>{party.title}</h1><p className="invite-intro">{cleanDescription(party.description)||"A little get-together, a lot of memories. We'd love to have you there."}</p>{mapUrlFrom(party.description)&&<a className="secondary-btn" href={mapUrlFrom(party.description)} target="_blank" rel="noreferrer"><MapPin size={16}/> View venue map</a>}<div className="invite-details"><span><CalendarDays size={17}/>{dateText(party.starts_at,party.timezone)}</span><span><Clock3 size={17}/>{timeText(party.starts_at,party.timezone)} – {timeText(party.ends_at,party.timezone)}</span>{party.arrival_from&&party.arrival_until&&<span><Clock3 size={17}/>Arrival {timeText(party.arrival_from,party.timezone)} – {timeText(party.arrival_until,party.timezone)}</span>}</div>
  {sent?<div className="success-state"><CheckCircle2 size={34}/><h2>Thanks, {name}!</h2><p>Your response has been saved. If you need to change it, submit the same name again using this invite link.</p><button className="secondary-btn" onClick={()=>setSent(false)}>Update my RSVP</button></div>:<form className="rsvp-form" onSubmit={submit}><h2>Are you coming?</h2><label>Your name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="First and last name"/></label><div className="rsvp-options"><button type="button" className={response==="yes"?"selected":""} onClick={()=>setResponse("yes")}>🙌 Count me in</button><button type="button" className={response==="maybe"?"selected":""} onClick={()=>setResponse("maybe")}>🤔 Maybe</button><button type="button" className={response==="no"?"selected":""} onClick={()=>setResponse("no")}>💌 Can't make it</button></div><label><Users size={15}/> Number of guests including you<select value={count} onChange={e=>setCount(Number(e.target.value))}>{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label><label>Food preference<select value={diet} onChange={e=>setDiet(e.target.value)}><option value="none">No preference</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option><option value="jain">Jain</option><option value="non_vegetarian">Non-vegetarian</option><option value="other">Other / I'll message the host</option></select></label>{error&&<div className="notice error-notice" role="alert">{error}</div>}<button className="primary-btn full-btn" type="submit" disabled={busy}>{busy?"Saving…":"Send my RSVP →"}</button></form>}<p className="invite-foot">A private celebration, shared with your people. ✦</p></div></main>;
}
