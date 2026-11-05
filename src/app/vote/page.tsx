"use client";
import "../vote.css";
import {useEffect,useState} from "react";
import {PartyPopper,Vote,Lock,CheckCircle2,ArrowLeft,BarChart3,Clock3} from "lucide-react";
import {castAnonymousAwardVote,getPublicAwardPoll} from "@/lib/partyhub";
type Poll=Awaited<ReturnType<typeof getPublicAwardPoll>>;
export default function PublicVotePage(){
 const [id,setId]=useState("");const [poll,setPoll]=useState<Poll|null>(null),[loading,setLoading]=useState(true),[selected,setSelected]=useState(""),[voted,setVoted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{const pollId=new URLSearchParams(location.search).get("id")??"";if(!pollId){setError("Poll link is missing its ID.");setLoading(false);return;}setId(pollId);getPublicAwardPoll(pollId).then(setPoll).catch(e=>setError(e instanceof Error?e.message:"This voting page is unavailable.")).finally(()=>setLoading(false));},[]);
 async function submit(){if(!poll||!selected)return;setBusy(true);setError("");try{const keyName="partyhub-voter-"+poll.id;let key=localStorage.getItem(keyName);if(!key){key=crypto.randomUUID();localStorage.setItem(keyName,key);}const result=await castAnonymousAwardVote(poll.id,selected,key);setPoll(result);setVoted(true);}catch(e){setError(e instanceof Error?e.message:"Your vote could not be saved.");}finally{setBusy(false);}}
 const total=poll?.options.reduce((n,o)=>n+Number(o.votes),0)??0;
 return <main className="public-vote-page"><div className="public-vote-card"><a href="/" className="vote-brand"><span className="brand-mark"><PartyPopper size={19}/></span> partyhub</a>{loading?<div className="vote-loading">Loading the award poll…</div>:!poll?<div className="vote-error"><h1>Voting page unavailable</h1><p>{error||"This poll may have been removed."}</p></div>:<>
 <div className="vote-event-label">A PARTYHUB AWARD · {poll.party_title}</div><div className="vote-illustration"><Vote size={30}/></div><h1>{poll.title}</h1><p className="vote-description">{poll.description||"Who deserves this award? Cast your vote!"}</p>
 {poll.status!=="open"?<div className="vote-closed"><Clock3 size={19}/> Voting is closed. Thanks for celebrating with us!</div>:voted?<div className="vote-success"><CheckCircle2 size={30}/><h2>Your vote is in!</h2><p>Thanks for taking part. Your choice was recorded anonymously.</p></div>:<><div className="vote-options">{poll.options.map(o=><button key={o.id} className={"vote-option "+(selected===o.id?"chosen":"")} onClick={()=>setSelected(o.id)}><span className="vote-radio">{selected===o.id?"✓":""}</span><strong>{o.label}</strong></button>)}</div><button className="primary-btn vote-submit" disabled={!selected||busy} onClick={()=>void submit()}><Vote size={17}/>{busy?"Submitting…":"Cast my anonymous vote"}</button></>}
 {poll.status==="closed"||voted?<section className="vote-results"><h2><BarChart3 size={17}/> Results</h2>{poll.options.map(o=><div className="vote-result-row" key={o.id}><div><span>{o.label}</span><strong>{o.votes}</strong></div><div className="vote-result-track"><i style={{width:(total?Number(o.votes)/total*100:0)+"%"}}/></div></div>)}<small>{total} vote{total===1?"":"s"} recorded</small></section>:null}
 {error&&<p className="vote-error-message" role="alert">{error}</p>}
 <div className="vote-privacy"><Lock size={14}/><span>Anonymous voting. No account or name required. One vote per browser for this poll.</span></div>
 </>}</div><a href="/" className="vote-home"><ArrowLeft size={14}/> PartyHub</a></main>;
}
