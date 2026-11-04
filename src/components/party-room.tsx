'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera, Dice5, Gift, Heart, Share2, Sparkles, Trophy, Upload } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { generateInvitationToken, hashInvitationToken, whatsappShareUrl } from '@/lib/invitations';

type Award={id:string;title:string;description:string;nominees:string[];is_open:boolean};
type Activity={id:string;message:string;created_at:string};
type Photo={id:string;storage_path:string;caption:string|null};
type ScheduleItem={id:string;title:string;starts_at:string;notes:string};
type Rsvp={id:string;display_name:string;response:string;guest_count:number;dietary_type:string|null;created_at:string};
const missions=['Get someone to teach you a dance move','Make a new friend laugh','Start a group selfie','Find two people with the same birthday month','Give someone a genuine compliment','Get the whole group to say “cheers”','Introduce two people who have not met','Convince someone to join the dance floor','Find the person with the most chaotic travel story','Start a 10-second dance battle'];
const bingoTiles=['Find someone who makes people feel welcome','Meet someone new','Get a group selfie','Find a fellow night owl','Learn a new dance move','Give a genuine compliment','Meet someone with a great playlist','Discover a shared hobby','Make someone laugh','Find a fellow pop-culture nerd','Meet someone from another city','Find a new chosen-family connection'];
const questions=['What is your most harmless controversial opinion?','What song instantly makes you feel iconic?','What is a green flag in a friendship?','What would your entrance music be?','What is the funniest thing you believed as a child?','What is your most chaotic travel story?','Which fictional world would you party in?','What is one tiny thing that makes your day?'];
const awardsSeed=['Main Character Energy','Best Dance Floor Entrance','Chosen Family MVP','Queer Eye for the Party','Most Likely to Start a Side Quest','Human Sunshine','Best Hype Person','Certified Chaos Coordinator'];
const stampEmoji:Record<string,string>={mission:'🕵️',bingo:'🎯',icebreaker:'💬',compliment:'💖',photo:'📸'};
const greenRedPrompts=['They remember your coffee order. Green flag or red flag?','They say “I know a shortcut” and open a 40-minute route. Green flag or red flag?','They hype up their friends in every room. Green flag or red flag?','They have a shared calendar for the friend group. Green flag or red flag?','They bring snacks for the journey. Green flag or red flag?'];

export function PartyRoom({party,userId,displayName,membershipId,isAdmin}:{party:{id:string;title:string;starts_at:string;description:string|null;venue_label:string|null;venue_address:string|null;ends_at:string;arrival_from:string|null;arrival_until:string|null;timezone:string};userId:string;displayName:string;membershipId:string;isAdmin:boolean}) {
  const [tab,setTab]=useState('games');
  const [mission,setMission]=useState('');
  const [missionDone,setMissionDone]=useState(false);
  const [bingoDone,setBingoDone]=useState<string[]>([]);
  const [greenRed,setGreenRed]=useState('');
  const [compliment,setCompliment]=useState('');
  const [stamps,setStamps]=useState<{id:string;stamp_key:string;stamp_label:string;created_at:string}[]>([]);
  const [bingo,setBingo]=useState<string[]>([]);
  const [question,setQuestion]=useState('');
  const [answer,setAnswer]=useState('');
  const [awards,setAwards]=useState<Award[]>([]);
  const [activities,setActivities]=useState<Activity[]>([]);
  const [schedule,setSchedule]=useState<ScheduleItem[]>([]);
  const [rsvps,setRsvps]=useState<Rsvp[]>([]);
  const [scheduleTitle,setScheduleTitle]=useState('');
  const [scheduleTime,setScheduleTime]=useState('');
  const [scheduleNotes,setScheduleNotes]=useState('');
  const [photos,setPhotos]=useState<Photo[]>([]);
  const [photoUrls,setPhotoUrls]=useState<Record<string,string>>({});
  const [newAward,setNewAward]=useState('Main Character Energy');
  const [nominees,setNominees]=useState('');
  const [shareUrl,setShareUrl]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const supabase=useMemo(()=>getSupabaseBrowserClient(),[]);

  const load = useCallback(async () => {
    const [a,b,c,d,e,g]=await Promise.all([
      supabase.from('party_activities').select('id,message,created_at').eq('party_id',party.id).order('created_at',{ascending:false}).limit(20),
      supabase.from('party_awards').select('id,title,description,nominees,is_open').eq('party_id',party.id).order('created_at',{ascending:false}),
      supabase.from('media_assets').select('id,storage_path,caption').eq('party_id',party.id).is('deleted_at',null).order('created_at',{ascending:false}),
      supabase.from('party_passport_stamps').select('id,stamp_key,stamp_label,created_at').eq('party_id',party.id).eq('user_id',userId).order('created_at',{ascending:false}),
      supabase.from('party_schedule_items').select('id,title,starts_at,notes').eq('party_id',party.id).order('starts_at',{ascending:true}),
      supabase.from('party_game_entries').select('entry_type,content,created_at').eq('party_id',party.id).eq('user_id',userId).in('entry_type',['mission_assigned','mission_completed','bingo_progress']).order('created_at',{ascending:false}).limit(20)
    ]);
    setStamps(d.data??[]);setSchedule(e.data??[]);
    setActivities(a.data??[]);setAwards((b.data??[]).map((x:any)=>({...x,nominees:Array.isArray(x.nominees)?x.nominees:[]})));setPhotos(c.data??[]);
    const urls:Record<string,string>={};
    for(const p of c.data??[]) {const {data}=await supabase.storage.from('party-media').createSignedUrl(p.storage_path,900);if(data?.signedUrl)urls[p.id]=data.signedUrl;}
    setPhotoUrls(urls);
    const gameEntries=g.data??[];
    const lastMission=gameEntries.find((entry:any)=>entry.entry_type==='mission_assigned'||entry.entry_type==='mission_completed');
    if(lastMission){setMission(lastMission.content?.mission??'');setMissionDone(lastMission.entry_type==='mission_completed');}
    const lastBingo=gameEntries.find((entry:any)=>entry.entry_type==='bingo_progress');
    if(lastBingo){setBingo(lastBingo.content?.tiles??[]);setBingoDone(lastBingo.content?.completedTiles??[]);}
    if(isAdmin){const {data}=await supabase.from('guest_rsvps').select('id,display_name,response,guest_count,dietary_type,created_at').eq('party_id',party.id).order('created_at',{ascending:false});setRsvps(data??[]);}
  },[supabase,party.id,userId,isAdmin]);
  useEffect(()=>{
    void load();
    let channel=supabase.channel('party-room-'+party.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'party_activities',filter:'party_id=eq.'+party.id},()=>{void load();})
      .on('postgres_changes',{event:'*',schema:'public',table:'party_awards',filter:'party_id=eq.'+party.id},()=>{void load();})
      .on('postgres_changes',{event:'*',schema:'public',table:'party_schedule_items',filter:'party_id=eq.'+party.id},()=>{void load();})
      .on('postgres_changes',{event:'*',schema:'public',table:'party_passport_stamps',filter:'party_id=eq.'+party.id},()=>{void load();})
      .on('postgres_changes',{event:'*',schema:'public',table:'media_assets',filter:'party_id=eq.'+party.id},()=>{void load();});
    if(isAdmin)channel=channel.on('postgres_changes',{event:'*',schema:'public',table:'guest_rsvps',filter:'party_id=eq.'+party.id},()=>{void load();});
    channel.subscribe();
    return ()=>{void supabase.removeChannel(channel);};
  },[load,supabase,party.id,isAdmin]);

  async function activity(type:string,text:string) {
    await supabase.from('party_activities').insert({party_id:party.id,actor_user_id:userId,actor_label:displayName,activity_type:type,message:text});
    await load();
  }
  async function earnStamp(key:string,label:string) {
    await supabase.from('party_passport_stamps').insert({party_id:party.id,user_id:userId,stamp_key:key,stamp_label:label});
  }
  async function drawMission() {
    const value=missions[Math.floor(Math.random()*missions.length)];setMission(value);setMissionDone(false);
    const {error}=await supabase.from('party_game_entries').insert({party_id:party.id,user_id:userId,entry_type:'mission_assigned',content:{mission:value,status:'assigned'}});
    if(error){setMessage(error.message);return;}
    await activity('game_started',displayName+' picked a secret mission');
  }
  function drawBingo(){setBingo([...bingoTiles].sort(()=>Math.random()-.5).slice(0,9));setBingoDone([]);}
  async function completeBingo(){
    const {error}=await supabase.from('party_game_entries').insert({party_id:party.id,user_id:userId,entry_type:'bingo_progress',content:{tiles:bingo,completedTiles:bingoDone,completed:bingoDone.length===bingo.length}});
    if(error){setMessage(error.message);return;} await earnStamp('bingo','Bingo starter');await activity('stamp_earned',displayName+' earned a Bingo passport stamp');
    setMessage('Bingo card saved to your party passport!');
  }
  function drawQuestion(){setQuestion(questions[Math.floor(Math.random()*questions.length)]);setAnswer('');}
  async function saveAnswer(){
    if(!answer.trim())return;
    const {error}=await supabase.from('party_game_entries').insert({party_id:party.id,user_id:userId,entry_type:'icebreaker_answer',content:{question,answer:answer.trim()}});
    if(error){setMessage(error.message);return;}await earnStamp('icebreaker','Conversation starter');await activity('stamp_earned',displayName+' earned a Conversation Starter stamp');setMessage('Saved! Go start that conversation.');
  }
  async function shareInvite(){
    setBusy(true);setMessage('');
    try{
      const token=generateInvitationToken();const bytes=await hashInvitationToken(token);
      const hex=Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('');
      const {error}=await supabase.from('invitations').insert({party_id:party.id,token_hash:'\\x'+hex,created_by:userId,max_uses:1000});
      if(error)throw error;
      const url=window.location.origin+'/invite/'+token;setShareUrl(whatsappShareUrl('You’re invited to '+party.title+'! RSVP here: '+url));
      await activity('invite_shared',displayName+' shared a fresh invitation link');
    }catch(e){setMessage(e instanceof Error?e.message:'Could not create invitation.');}finally{setBusy(false);}
  }
  async function completeMission(){
    if(!mission||missionDone)return;
    const {error}=await supabase.from('party_game_entries').insert({party_id:party.id,user_id:userId,entry_type:'mission_completed',content:{mission,status:'completed'}});
    if(error){setMessage(error.message);return;}
    setMissionDone(true);await earnStamp('mission','Secret Agent');await activity('mission_completed',displayName+' completed a secret mission');
    setMessage('Mission completed. Your Secret Agent stamp is in your passport.');
  }
  async function dropCompliment(){
    if(!compliment.trim())return;
    const {error}=await supabase.from('party_game_entries').insert({party_id:party.id,user_id:userId,entry_type:'compliment',content:{message:compliment.trim()}});
    if(error){setMessage(error.message);return;}
    setCompliment('');await earnStamp('compliment','Hype person');await activity('stamp_earned',displayName+' dropped some party love');setMessage('Compliment dropped. Keep the good energy going.');
  }
  async function addScheduleItem(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!scheduleTitle.trim()||!scheduleTime)return;
    const {error}=await supabase.from('party_schedule_items').insert({party_id:party.id,title:scheduleTitle.trim(),starts_at:new Date(scheduleTime).toISOString(),notes:scheduleNotes.trim(),created_by:userId});
    if(error){setMessage(error.message);return;}setScheduleTitle('');setScheduleNotes('');await activity('schedule_updated',displayName+' updated the party schedule');
  }
  async function createAward(){
    const names=nominees.split(',').map(x=>x.trim()).filter(Boolean);
    if(!names.length){setMessage('Add at least one nominee.');return;}
    const {error}=await supabase.from('party_awards').insert({party_id:party.id,title:newAward,description:'A little love from the party crew.',nominees:names,created_by:userId});
    if(error){setMessage(error.message);return;}setNominees('');await activity('award_created',displayName+' opened a party award: '+newAward);
  }
  async function vote(awardId:string,nominee:string){
    const {error}=await supabase.from('party_award_votes').insert({award_id:awardId,voter_user_id:userId,nominee_label:nominee});
    if(error){setMessage(error.code==='23505'?'You have already voted in this award.':'Could not record your vote: '+error.message);return;}
    await activity('vote_cast',displayName+' cast an anonymous award vote');
    setMessage('Vote locked in. Your identity is not shown with the results.');
  }
  async function results(awardId:string){
    const {data,error}=await supabase.rpc('get_party_award_results',{p_award_id:awardId});
    if(error){setMessage(error.message);return;}
    setMessage((data??[]).map((x:any)=>x.nominee_label+': '+x.vote_count+' votes').join(' · ')||'No votes yet.');
  }
  async function uploadPhoto(file?:File){
    if(!file)return;
    if(file.size>10*1024*1024){setMessage('Please choose a photo under 10 MB.');return;}
    setBusy(true);setMessage('');
    try{
      const ext=file.name.split('.').pop()?.toLowerCase()||'jpg';const assetId=crypto.randomUUID();
      const path=party.id+'/'+userId+'/'+assetId+'.'+ext;
      const {error:uploadError}=await supabase.storage.from('party-media').upload(path,file,{contentType:file.type,upsert:false});
      if(uploadError)throw uploadError;
      const {error:rowError}=await supabase.from('media_assets').insert({id:assetId,party_id:party.id,uploader_member_id:membershipId,storage_path:path,mime_type:file.type,file_size_bytes:file.size,caption:null});
      if(rowError)throw rowError;
      await earnStamp('photo','Memory maker');await activity('photo_added',displayName+' added a memory to the private gallery');await load();setMessage('Photo added to the members-only gallery.');
    }catch(e){setMessage(e instanceof Error?e.message:'Photo upload failed.');}finally{setBusy(false);}
  }

  return <main className="min-h-screen bg-[#fffaf4] px-5 py-8 text-[#171522]"><div className="mx-auto max-w-5xl">
    <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-black/50"><ArrowLeft size={16}/> Dashboard</Link>
    <header className="mt-6 rounded-3xl bg-gradient-to-br from-violet-800 via-fuchsia-600 to-orange-300 p-7 text-white"><p className="text-xs font-bold tracking-[.2em]">PARTY ROOM</p><h1 className="mt-3 text-4xl font-black">{party.title}</h1><p className="mt-3 text-sm text-white/85">{new Date(party.starts_at).toLocaleString()} – {new Date(party.ends_at).toLocaleTimeString()}</p>{party.venue_label&&<p className="mt-3 text-sm font-semibold">{party.venue_label}</p>}{party.venue_address&&<p className="mt-1 text-sm text-white/85">{party.venue_address}</p>}{party.description&&<p className="mt-3 max-w-2xl text-sm text-white/85">{party.description}</p>}<div className="mt-6 flex flex-wrap gap-3"><button onClick={shareInvite} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-violet-800"><Share2 size={16}/> Create WhatsApp invite</button>{shareUrl&&<a href={shareUrl} target="_blank" rel="noreferrer" className="rounded-full bg-black/20 px-4 py-2.5 text-sm font-bold">Share now ↗</a>}</div></header>
    <nav className="mt-6 flex gap-2 overflow-x-auto pb-2">{[['games','Party games'],['schedule','Schedule'],...(isAdmin?[['rsvps','Guest RSVPs']]:[]),['awards','Awards'],['gallery','Gallery'],['feed','Activity']].map(([key,label])=><button key={key} onClick={()=>setTab(key)} className={'shrink-0 rounded-full px-4 py-2.5 text-sm font-bold '+(tab===key?'bg-[#211a32] text-white':'border border-black/10 bg-white')}>{label}</button>)}</nav>
    {message&&<div className="mt-4 rounded-xl bg-violet-50 p-4 text-sm text-violet-900">{message}</div>}
    {tab==='games'&&<div className="mt-6 grid gap-4 md:grid-cols-2">
      <section className="rounded-3xl border border-black/10 bg-white p-6"><div className="flex items-center gap-2 text-violet-700"><Sparkles/><span className="text-xs font-bold tracking-widest">SECRET MISSION</span></div><h2 className="mt-3 text-2xl font-black">Your undercover era.</h2><p className="mt-2 text-sm text-black/55">Draw a private mission. Complete it without giving the game away.</p>{mission&&<><p className="mt-5 rounded-2xl bg-violet-50 p-4 font-semibold">{mission}</p><button onClick={completeMission} disabled={missionDone} className="mt-3 rounded-full border border-violet-200 px-4 py-2 text-sm font-bold text-violet-800 disabled:opacity-50">{missionDone?'Mission complete ✓':'Mark mission complete'}</button></>}<button onClick={drawMission} className="mt-5 rounded-full bg-violet-700 px-5 py-3 text-sm font-bold text-white">Draw my mission</button></section>
      <section className="rounded-3xl border border-black/10 bg-white p-6"><div className="flex items-center gap-2 text-fuchsia-700"><Dice5/><span className="text-xs font-bold tracking-widest">PARTY BINGO</span></div><h2 className="mt-3 text-2xl font-black">Find your people.</h2><p className="mt-2 text-sm text-black/55">Tap the squares as you complete them. No awkward ice-cold intros required.</p>{bingo.length===0?<button onClick={drawBingo} className="mt-5 rounded-full bg-[#211a32] px-5 py-3 text-sm font-bold text-white">Deal my bingo card</button>:<><div className="mt-5 grid grid-cols-3 gap-2">{bingo.map((tile,i)=><button key={i} onClick={()=>setBingoDone(old=>old.includes(tile)?old.filter(x=>x!==tile):[...old,tile])} className={'min-h-20 rounded-xl border p-2 text-xs font-medium '+(bingoDone.includes(tile)?'border-emerald-300 bg-emerald-100':'border-black/10 bg-[#fffaf4]')}>{tile}</button>)}</div><p className="mt-2 text-xs text-black/45">{bingoDone.length} of {bingo.length} squares checked</p><button onClick={completeBingo} className="mt-4 rounded-full bg-violet-700 px-5 py-3 text-sm font-bold text-white">Save bingo progress</button></>}</section>
      <section className="rounded-3xl border border-black/10 bg-white p-6 md:col-span-2"><div className="flex items-center gap-2 text-orange-600"><Heart/><span className="text-xs font-bold tracking-widest">ICEBREAKER ROULETTE</span></div><h2 className="mt-3 text-2xl font-black">Skip the small talk.</h2>{question?<><p className="mt-4 rounded-2xl bg-orange-50 p-5 text-lg font-bold">{question}</p><textarea value={answer} onChange={e=>setAnswer(e.target.value)} maxLength={500} placeholder="Your answer (optional to share with the party)…" className="mt-4 min-h-24 w-full rounded-xl border border-black/10 p-4 text-sm"/><button onClick={saveAnswer} className="mt-3 rounded-full bg-orange-600 px-5 py-3 text-sm font-bold text-white">Save answer</button></>:null}<button onClick={drawQuestion} className="mt-4 rounded-full border border-black/15 px-5 py-3 text-sm font-bold">Spin for a question ↻</button></section>
      <section className="rounded-3xl border border-black/10 bg-white p-6"><div className="flex items-center gap-2 text-emerald-700"><Heart/><span className="text-xs font-bold tracking-widest">GREEN FLAG / RED FLAG</span></div><h2 className="mt-3 text-2xl font-black">The group chat court is in session.</h2>{greenRed&&<p className="mt-4 rounded-2xl bg-emerald-50 p-4 font-semibold">{greenRed}</p>}<button onClick={()=>setGreenRed(greenRedPrompts[Math.floor(Math.random()*greenRedPrompts.length)])} className="mt-4 rounded-full bg-emerald-700 px-5 py-3 text-sm font-bold text-white">Judge a scenario</button></section>
      <section className="rounded-3xl border border-black/10 bg-white p-6"><div className="flex items-center gap-2 text-pink-700"><Heart/><span className="text-xs font-bold tracking-widest">COMPLIMENT DROP</span></div><h2 className="mt-3 text-2xl font-black">Be the reason someone smiles.</h2><p className="mt-2 text-sm text-black/55">Leave a kind note for the party. Keep it genuine, keep it respectful.</p><textarea value={compliment} onChange={e=>setCompliment(e.target.value)} maxLength={300} placeholder="You bring the best energy to every room…" className="mt-4 min-h-20 w-full rounded-xl border border-black/10 p-4 text-sm"/><button onClick={dropCompliment} className="mt-3 rounded-full bg-pink-700 px-5 py-3 text-sm font-bold text-white">Drop some love</button></section>
      <section className="rounded-3xl border border-black/10 bg-white p-6 md:col-span-2"><div className="flex items-center gap-2 text-pink-700"><Gift/><span className="text-xs font-bold tracking-widest">QUEER JOY, EVERYONE WELCOME</span></div><h2 className="mt-3 text-2xl font-black">A little extra fabulous.</h2><p className="mt-2 text-sm text-black/55">Optional prompts and awards inspired by chosen family, self-expression and excellent chaos. No one has to disclose anything personal.</p><div className="mt-4 flex flex-wrap gap-2">{['Chosen Family Bingo','Main Character Energy','Queer Eye for the Party','Green Flag / Red Flag','Compliment Drop','Best Dance Floor Entrance'].map(x=><span key={x} className="rounded-full bg-pink-50 px-3 py-2 text-xs font-semibold text-pink-800">{x}</span>)}</div></section>
    </div>}
    {tab==='schedule'&&<section className="mt-6 rounded-3xl border border-black/10 bg-white p-6"><h2 className="text-2xl font-black">Party schedule</h2><p className="mt-1 text-sm text-black/50">A simple timeline so everyone knows what’s happening.</p>{isAdmin&&<form onSubmit={addScheduleItem} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr]"><input required value={scheduleTitle} onChange={e=>setScheduleTitle(e.target.value)} placeholder="e.g. Dinner, cake, games" className="rounded-xl border border-black/10 px-3 py-3 text-sm"/><input required type="datetime-local" value={scheduleTime} onChange={e=>setScheduleTime(e.target.value)} className="rounded-xl border border-black/10 px-3 py-3 text-sm"/><input value={scheduleNotes} onChange={e=>setScheduleNotes(e.target.value)} placeholder="Optional note" className="rounded-xl border border-black/10 px-3 py-3 text-sm sm:col-span-2"/><button className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white sm:col-span-2">Add to schedule</button></form>}<ol className="mt-6 space-y-4">{schedule.map(item=><li key={item.id} className="flex gap-4 rounded-2xl bg-[#fffaf4] p-4"><div className="min-w-24 text-sm font-bold text-violet-700">{new Date(item.starts_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</div><div><p className="font-bold">{item.title}</p>{item.notes&&<p className="mt-1 text-sm text-black/50">{item.notes}</p>}</div></li>)}</ol>{schedule.length===0&&<p className="mt-5 text-sm text-black/45">No schedule items yet.</p>}</section>}
    {tab==='rsvps'&&isAdmin&&<section className="mt-6 rounded-3xl border border-black/10 bg-white p-6"><h2 className="text-2xl font-black">Guest RSVPs</h2><p className="mt-1 text-sm text-black/50">{rsvps.length} responses so far · visible to the host team only.</p><div className="mt-5 space-y-3">{rsvps.map(r=><article key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#fffaf4] p-4"><div><p className="font-bold">{r.display_name}</p><p className="mt-1 text-xs text-black/45">{r.guest_count} guest(s) · {r.dietary_type||'No food preference'}</p></div><span className="rounded-full bg-white px-3 py-2 text-xs font-bold uppercase">{r.response}</span></article>)}</div>{rsvps.length===0&&<p className="mt-5 text-sm text-black/45">No guest responses yet. Share your invitation link.</p>}</section>}
    {tab==='awards'&&<section className="mt-6 rounded-3xl border border-black/10 bg-white p-6"><div className="flex items-center gap-2"><Trophy className="text-amber-600"/><h2 className="text-2xl font-black">The unofficial awards.</h2></div><p className="mt-2 text-sm text-black/55">Celebrate the people who made the night. Votes are private; only totals are shown.</p><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]"><select value={newAward} onChange={e=>setNewAward(e.target.value)} className="rounded-xl border border-black/10 px-3 py-3 text-sm">{awardsSeed.map(x=><option key={x}>{x}</option>)}</select><input value={nominees} onChange={e=>setNominees(e.target.value)} placeholder="Nominees, separated by commas" className="rounded-xl border border-black/10 px-3 py-3 text-sm"/><button onClick={createAward} className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white">Open award</button></div><div className="mt-6 space-y-4">{awards.map(a=><article key={a.id} className="rounded-2xl bg-[#fffaf4] p-5"><h3 className="font-black">{a.title}</h3><p className="mt-1 text-xs text-black/45">{a.is_open?'Voting open':'Voting closed'} · anonymous voting</p><div className="mt-4 flex flex-wrap gap-2">{a.nominees.map(n=><button key={n} onClick={()=>vote(a.id,n)} className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm">{n} ♡</button>)}</div><button onClick={()=>results(a.id)} className="mt-4 text-xs font-bold text-violet-700 underline">Show vote totals</button></article>)}{awards.length===0&&<p className="text-sm text-black/45">No awards yet. Open one and let the friendly chaos begin.</p>}</div></section>}
    {tab==='gallery'&&<section className="mt-6 rounded-3xl border border-black/10 bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">Private party gallery</h2><p className="mt-1 text-sm text-black/50">Only accepted party members can view these memories.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-violet-700 px-4 py-3 text-sm font-bold text-white"><Upload size={16}/> Add photo<input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={e=>void uploadPhoto(e.target.files?.[0])}/></label></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map(p=><figure key={p.id} className="overflow-hidden rounded-2xl bg-[#fffaf4]">{photoUrls[p.id]?<img src={photoUrls[p.id]} alt="Private party memory" className="aspect-square w-full object-cover"/>:<div className="flex aspect-square items-center justify-center"><Camera/></div>}{p.caption&&<figcaption className="p-2 text-xs">{p.caption}</figcaption>}</figure>)}</div>{photos.length===0&&<div className="rounded-2xl border border-dashed border-black/15 p-10 text-center"><Camera className="mx-auto text-black/30"/><p className="mt-3 text-sm text-black/50">The gallery is waiting for its first memory.</p></div>}</section>}
    {tab==='feed'&&<section className="mt-6 rounded-3xl border border-black/10 bg-white p-6"><h2 className="text-2xl font-black">Party activity</h2><ul className="mt-4 divide-y divide-black/5">{activities.map(a=><li key={a.id} className="py-4"><p className="text-sm">{a.message}</p><p className="mt-1 text-xs text-black/35">{new Date(a.created_at).toLocaleString()}</p></li>)}</ul>{activities.length===0&&<p className="mt-3 text-sm text-black/50">The first party moment is yet to happen.</p>}</section>}
    <section className="mt-6 rounded-3xl border border-violet-100 bg-violet-50 p-5"><p className="font-black">Your Party Passport</p><p className="mt-1 text-sm text-black/55">Mission, bingo, conversation and photo stamps are earned as you join in. Your passport belongs to this party.</p><div className="mt-3 flex flex-wrap gap-2">{stamps.length?stamps.map(stamp=><span key={stamp.id} className="rounded-full bg-white px-3 py-2 text-sm">{stampEmoji[stamp.stamp_key]||'✨'} {stamp.stamp_label}</span>):<span className="text-sm text-black/45">No stamps yet — try a game to earn your first one.</span>}</div></section>
  </div></main>;
}
