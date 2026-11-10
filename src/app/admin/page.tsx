"use client";
import {useCallback,useEffect,useState} from "react";
import {ArrowLeft,RefreshCw,Users,CalendarDays,UserRoundCheck,MessageCircle,Vote,TrendingUp,ShieldCheck,LockKeyhole} from "lucide-react";
import {supabase} from "@/lib/partyhub";

type SeriesPoint={day:string;count:number};
type Analytics={
 generated_at:string;users_total:number;users_new_30d:number;users_new_7d:number;users_active_30d:number;
 hosts_total:number;members_total:number;parties_total:number;parties_upcoming:number;parties_past:number;
 rsvp_responses:number;rsvp_attending_guests:number;polls_total:number;votes_total:number;
 signups_daily:SeriesPoint[];parties_daily:SeriesPoint[];party_types:{label:string;count:number}[];
};
const n=(v:number)=>new Intl.NumberFormat("en-IN").format(v??0);
function Metric({label,value,detail,icon:Icon}:{label:string;value:number;detail:string;icon:any}){
 return <article className="admin-metric"><div className="admin-metric-top"><span>{label}</span><Icon size={18}/></div><strong>{n(value)}</strong><small>{detail}</small></article>;
}
function Trend({title,points}:{title:string;points:SeriesPoint[]}){
 const max=Math.max(1,...points.map(p=>p.count));
 return <section className="admin-panel"><div className="admin-panel-heading"><h2>{title}</h2><span>Last 30 days</span></div><div className="admin-bars" role="img" aria-label={title+" over the last 30 days"}>{points.map((p,i)=><div className="admin-bar-col" key={p.day} title={new Date(p.day+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"})+": "+p.count}><div className="admin-bar-track"><span style={{height:Math.max(p.count?4:0,p.count/max*100)+"%"}}/></div>{(i%5===0||i===points.length-1)&&<small>{new Date(p.day+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</small>}</div>)}</div><div className="admin-chart-foot"><span>{n(points.reduce((s,p)=>s+p.count,0))} total</span><span>Daily activity</span></div></section>;
}
export default function AdminDashboard(){
 const [data,setData]=useState<Analytics|null>(null),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(""),[denied,setDenied]=useState(false),[email,setEmail]=useState("");
 const load=useCallback(async()=>{
  setError("");setDenied(false);setRefreshing(true);
  try{
   const client=supabase();const {data:auth,error:authError}=await client.auth.getUser();
   if(authError||!auth.user){window.location.assign("/login/");return;}
   setEmail(auth.user.email??"");
   const {data:admin,error:adminError}=await client.from("platform_admins").select("user_id").eq("user_id",auth.user.id).maybeSingle();
   if(adminError)throw adminError;
   if(!admin){setDenied(true);setData(null);return;}
   const {data:metrics,error:metricsError}=await client.rpc("get_platform_admin_analytics");
   if(metricsError)throw metricsError;
   setData(metrics as Analytics);
  }catch(e){setError(e instanceof Error?e.message:"Could not load platform analytics.");}
  finally{setLoading(false);setRefreshing(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 return <main className="admin-shell">
  <header className="admin-header"><a className="admin-brand" href="/"><span>✳</span> partyhub</a><a href="/" className="admin-back"><ArrowLeft size={15}/> Back to app</a></header>
  {loading?<div className="admin-state">Loading your platform overview…</div>:denied?<section className="admin-state admin-denied"><LockKeyhole size={28}/><h1>Admin access only</h1><p>This account does not have platform administrator permissions.</p><a href="/">Return to PartyHub</a></section>:error?<section className="admin-state"><h1>Analytics unavailable</h1><p>{error}</p><button onClick={()=>void load()}>Try again</button></section>:data&&<>
   <section className="admin-intro"><div><div className="admin-kicker"><ShieldCheck size={14}/> PLATFORM ADMINISTRATION</div><h1>Good morning.</h1><p>Your PartyHub platform at a glance.</p></div><button className="admin-refresh" onClick={()=>void load()} disabled={refreshing}><RefreshCw size={15} className={refreshing?"admin-spin":""}/>{refreshing?"Refreshing":"Refresh data"}</button></section>
   <div className="admin-account">Signed in as <strong>{email}</strong><span>·</span> Owner analytics</div>
   <section className="admin-group"><div className="admin-group-title"><span>01</span><div><h2>People</h2><p>One identity, many ways to participate.</p></div></div><div className="admin-metrics-grid">
    <Metric label="Registered users" value={data.users_total} detail={"+"+n(data.users_new_30d)+" in 30 days"} icon={Users}/>
    <Metric label="New this week" value={data.users_new_7d} detail="Accounts created · 7 days" icon={TrendingUp}/>
    <Metric label="Active users" value={data.users_active_30d} detail="Activity proxy · 30 days" icon={UserRoundCheck}/>
    <Metric label="Hosts" value={data.hosts_total} detail={n(data.members_total)+" distinct party members"} icon={ShieldCheck}/>
   </div></section>
   <section className="admin-group"><div className="admin-group-title"><span>02</span><div><h2>Celebrations</h2><p>What the community is organising.</p></div></div><div className="admin-metrics-grid">
    <Metric label="All celebrations" value={data.parties_total} detail="Created on PartyHub" icon={CalendarDays}/>
    <Metric label="Upcoming" value={data.parties_upcoming} detail="Starts in the future" icon={CalendarDays}/>
    <Metric label="Past celebrations" value={data.parties_past} detail="End time has passed" icon={CalendarDays}/>
    <Metric label="Party members" value={data.members_total} detail="Distinct registered members" icon={Users}/>
   </div></section>
   <section className="admin-group"><div className="admin-group-title"><span>03</span><div><h2>Participation</h2><p>Responses and moments shared.</p></div></div><div className="admin-metrics-grid">
    <Metric label="RSVP responses" value={data.rsvp_responses} detail="Submitted invitations" icon={MessageCircle}/>
    <Metric label="Guests attending" value={data.rsvp_attending_guests} detail="Sum of yes guest counts" icon={UserRoundCheck}/>
    <Metric label="Award polls" value={data.polls_total} detail="Created across parties" icon={Vote}/>
    <Metric label="Votes cast" value={data.votes_total} detail="Anonymous aggregate total" icon={Vote}/>
   </div></section>
   <section className="admin-charts"><Trend title="New account registrations" points={data.signups_daily??[]}/><Trend title="Celebrations created" points={data.parties_daily??[]}/></section>
   <section className="admin-panel admin-types"><div className="admin-panel-heading"><h2>Popular celebration types</h2><span>All time</span></div>{data.party_types.length?data.party_types.map(t=><div className="admin-type-row" key={t.label}><span>{t.label.replaceAll("_"," ")}</span><strong>{n(t.count)}</strong><div><i style={{width:(t.count/Math.max(1,...data.party_types.map(x=>x.count))*100)+"%"}}/></div></div>):<p>No celebrations yet.</p>}</section>
   <p className="admin-footnote">Metrics generated {new Date(data.generated_at).toLocaleString("en-IN")}. Active users are estimated from recent party creation and membership activity, not app sessions.</p>
  </>}
 </main>;
}
