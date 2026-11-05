"use client";
import "./vote.css";
import {useEffect,useState} from "react";
import {PartyPopper,Vote,Lock,CheckCircle2,ArrowLeft,BarChart3,Clock3,Mail} from "lucide-react";
import {castGuestLinkAwardVote,castMemberAwardVoteByCode,getPublicAwardPoll} from "@/lib/partyhub";
type Poll=Awaited<ReturnType<typeof getPublicAwardPoll>>;
export default function PublicVotePage(){
 const [id,setId]=useState("");const [token,setToken]=useState("");const [poll,setPoll]=useState<Poll|null>(null),[loading,setLoading]=useState(true),[selected,setSelected]=useState(""),[voted,setVoted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [code,setCode]=useState("");
 useEffect(()=>{const params=new URLSearchParams(location.search);const pollId=params.get("id")??"";const guestToken=params.get("token")??"";if(!pollId){setError("Poll link is missing its ID.");setLoading(false);return;}setId(pollId);setToken(guestToken);getPublicAwardPoll(pollId).then(setPoll).catch(e=>setError(e instanceof Error?e.message:"This voting page is unavailable.")).finally(()=>setLoading(false));},[]);
 async function submit(){if(!poll||!selected)return;if(!token&&!code.trim())return;setBusy(true);setError("");try{const result=token?await castGuestLinkAwardVote(poll.id,selected,token):await castMemberAwardVoteByCode(poll.id,selected,code.trim().toUpperCase());setPoll(result);setVoted(true);}catch(e){setError(e instanceof Error?e.message:"Your vote could not be saved.");}finally{setBusy(false);}}
 const total=poll?.options.reduce((n,o)=>n+Number(o.votes),0)??0;
 return <main className="public-vote-page"><div className="public-vote-card"><a href="/" className="vote-brand"><span className="brand-mark"><PartyPopper size={19}/></span> partyhub</a>{loading?<div className="vote-loading">Loading the award poll…</div>:!poll?<div className="vote-error"><h1>Voting page unavailable</h1><p>{error||"This poll may have been removed."}</p></div>:<>
 <div className="vote-event-label">A PARTYHUB AWARD · {poll.party_title}</div><div className="vote-illustration"><Vote size={30}/></div><h1>{poll.title}</h1><p className="vote-description">{poll.description||"Who deserves this award? Cast your vote!"}</p>
 {poll.status!=="open"?<div className="vote-closed"><Clock3 size={19}/> Voting is closed. Thanks for celebrating with us!</div>:voted?<div className="vote-success"><CheckCircle2 size={30}/><h2>Your vote is in!</h2><p>Thanks for taking part. Your choice was recorded.</p></div>:<>
 {!token&&<section className="vote-identity"><h2>Enter your personal voting code</h2><p>Your host shared this one-time code with you. It can be used once only.</p><input className="vote-contact-input" type="text" value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g,"").slice(0,10))} placeholder="10-character code" autoComplete="off" maxLength={10} /></section>}
 <div className="vote-options">{poll.options.map(o=><button key={o.id} className={"vote-option "+(selected===o.id?"chosen":"")} onClick={()=>setSelected(o.id)}><span className="vote-radio">{selected===o.id?"✓":""}</span><strong>{o.label}</strong></button>)}</div>
 <button className="primary-btn vote-submit" disabled={!selected||busy||(!token&&code.trim().length!==10)} onClick={()=>void submit()}><Vote size={17}/>{busy?"Submitting…":"Cast my vote"}</button>
 </>}
 {poll.status==="closed"||voted?<section className="vote-results"><h2><BarChart3 size={17}/> Results</h2>{poll.options.map(o=><div className="vote-result-row" key={o.id}><div><span>{o.label}</span><strong>{o.votes}</strong></div><div className="vote-result-track"><i style={{width:(total?Number(o.votes)/total*100:0)+"%"}}/></div></div>)}<small>{total} vote{total===1?"":"s"} recorded</small></section>:null}
 {error&&<p className="vote-error-message" role="alert">{error}</p>}
 <div className="vote-privacy"><Lock size={14}/><span>{token?"This personal guest link can cast one vote only, even across browsers.":"This personal member code can cast one vote only, even across browsers."}</span></div>
 </>}</div><a href="/" className="vote-home"><ArrowLeft size={14}/> PartyHub</a></main>;
}
