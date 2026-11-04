'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CalendarDays, Plus, PartyPopper, ArrowUpRight } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { generateInvitationToken, hashInvitationToken, whatsappShareUrl } from '@/lib/invitations';

type Party = { id:string; title:string; starts_at:string; status:string; timezone:string };
export function PartyDashboard({ initialParties, userId, displayName }:{initialParties:Party[];userId:string;displayName:string}) {
  const [parties,setParties]=useState(initialParties);
  const [showForm,setShowForm]=useState(false);
  const [title,setTitle]=useState('');
  const [date,setDate]=useState('');
  const [time,setTime]=useState('19:00');
  const [partyType,setPartyType]=useState('house_party');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [share,setShare]=useState('');

  async function createParty(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setShare('');
    try {
      const supabase=getSupabaseBrowserClient();
      const startsAt=new Date(date+'T'+time).toISOString();
      const endsAt=new Date(new Date(startsAt).getTime()+5*60*60*1000).toISOString();
      const {data:party,error:partyError}=await supabase.from('parties').insert({
        host_id:userId,title:title.trim(),party_type:partyType,starts_at:startsAt,ends_at:endsAt,
        arrival_from:startsAt,arrival_until:new Date(new Date(startsAt).getTime()+60*60*1000).toISOString(),
        timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,status:'published'
      }).select('id,title,starts_at,status,timezone').single();
      if(partyError) throw partyError;
      const token=generateInvitationToken();
      const hash=await hashInvitationToken(token);
      const hashHex=Array.from(hash).map(b=>b.toString(16).padStart(2,'0')).join('');
      const {error:inviteError}=await supabase.from('invitations').insert({
        party_id:party.id,token_hash:'\\x'+hashHex,created_by:userId,max_uses:1000
      });
      if(inviteError) throw inviteError;
      await supabase.from('party_activities').insert({
        party_id:party.id,actor_user_id:userId,actor_label:displayName,activity_type:'party_created',
        message:displayName+' created the party'
      });
      const inviteUrl=window.location.origin+'/invite/'+token;
      setParties(current=>[party,...current]);
      setShare(whatsappShareUrl('You’re invited to '+party.title+'! RSVP here: '+inviteUrl));
      setTitle('');setShowForm(false);
    } catch(cause) { setError(cause instanceof Error?cause.message:'Could not create party.'); }
    finally {setBusy(false);}
  }

  return <div>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-bold tracking-widest text-violet-700">YOUR SPACE</p><h1 className="mt-2 text-4xl font-black">Hey {displayName || 'party person'}.</h1><p className="mt-2 text-black/55">Your next legendary night starts here.</p></div>
      <button onClick={()=>setShowForm(v=>!v)} className="inline-flex items-center gap-2 rounded-full bg-violet-700 px-5 py-3 font-bold text-white"><Plus size={18}/> Create a party</button>
    </div>
    {share && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="font-bold">Your party is live 🎉</p><a href={share} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#211a32] px-4 py-2.5 text-sm font-semibold text-white">Invite on WhatsApp <ArrowUpRight size={16}/></a></div>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {showForm && <form onSubmit={createParty} className="mt-7 rounded-3xl border border-black/10 bg-white p-6">
      <h2 className="text-xl font-black">Set the scene</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2 text-sm font-semibold">Party name<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Friday chaos, birthday bash…" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 font-normal"/></label>
        <label className="text-sm font-semibold">Date<input required type="date" min={new Date().toISOString().slice(0,10)} value={date} onChange={e=>setDate(e.target.value)} className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 font-normal"/></label>
        <label className="text-sm font-semibold">Start time<input required type="time" value={time} onChange={e=>setTime(e.target.value)} className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 font-normal"/></label>
        <label className="sm:col-span-2 text-sm font-semibold">Party vibe<select value={partyType} onChange={e=>setPartyType(e.target.value)} className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 font-normal"><option value="house_party">House party</option><option value="birthday">Birthday</option><option value="dinner">Dinner party</option><option value="game_night">Game night</option><option value="celebration">Celebration</option><option value="other">Something else</option></select></label>
      </div>
      <p className="mt-4 text-xs text-black/45">You can add venue details, co-hosts and a full schedule in the party room. Your first invite link supports up to 1,000 RSVPs.</p>
      <div className="mt-5 flex gap-3"><button disabled={busy} className="rounded-full bg-[#211a32] px-5 py-3 font-bold text-white disabled:opacity-50">{busy?'Creating…':'Create & invite'}</button><button type="button" onClick={()=>setShowForm(false)} className="rounded-full border border-black/15 px-5 py-3 text-sm">Cancel</button></div>
    </form>}
    <section className="mt-10"><h2 className="text-xl font-black">Your parties</h2>
      {parties.length===0?<div className="mt-4 rounded-3xl border border-dashed border-black/15 bg-white/70 p-10 text-center"><PartyPopper className="mx-auto h-8 w-8 text-violet-700"/><p className="mt-4 font-bold">It’s a little quiet in here.</p><p className="mt-1 text-sm text-black/50">Create your first party and invite your people.</p></div>:<div className="mt-4 grid gap-4 md:grid-cols-2">{parties.map(p=><Link href={'/party/'+p.id} key={p.id} className="rounded-2xl border border-black/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-center justify-between"><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{p.status}</span><ArrowUpRight size={18} className="text-black/30"/></div><h3 className="mt-4 text-xl font-black">{p.title}</h3><p className="mt-2 flex items-center gap-2 text-sm text-black/50"><CalendarDays size={15}/>{new Date(p.starts_at).toLocaleString()}</p></Link>)}</div>}
    </section>
  </div>;
}
