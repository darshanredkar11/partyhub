'use client';

import { useState, type FormEvent } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export function GuestRsvp({token,partyTitle}:{token:string;partyTitle:string}) {
  const [name,setName]=useState('');
  const [response,setResponse]=useState('yes');
  const [count,setCount]=useState('1');
  const [diet,setDiet]=useState('none');
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const [error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');
    try {
      const supabase=getSupabaseBrowserClient();
      const {error:rpcError}=await supabase.rpc('submit_guest_rsvp',{
        p_token:token,p_display_name:name.trim(),p_response:response,
        p_guest_count:Number(count),p_dietary_type:diet
      });
      if(rpcError) throw rpcError;
      setDone(true);
    } catch(cause) {setError(cause instanceof Error?cause.message:'Could not submit your RSVP.');}
    finally {setBusy(false);}
  }
  if(done) return <div className="rounded-2xl bg-emerald-50 p-6"><p className="text-2xl">🎉</p><h2 className="mt-2 text-xl font-black">You’re on the list!</h2><p className="mt-2 text-sm text-black/60">Your RSVP for {partyTitle} has been sent to the host.</p><a href={'/join/'+token} className="mt-5 inline-block rounded-full bg-violet-700 px-5 py-3 text-sm font-bold text-white">Join the party space (optional)</a><p className="mt-3 text-xs text-black/45">RSVP is complete. Joining the private gallery and games is optional and requires an account with a verified mobile number.</p></div>;
  return <form onSubmit={submit} className="rounded-3xl border border-black/10 bg-white p-6 shadow-xl">
    <h2 className="text-xl font-black">Are you coming?</h2>
    <label className="mt-5 block text-sm font-semibold">What should we call you?<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 font-normal"/></label>
    <div className="mt-5 grid grid-cols-3 gap-2">{[['yes','I’m in 🎉'],['maybe','Maybe 🤔'],['no','Can’t make it']].map(([value,label])=><button type="button" key={value} onClick={()=>setResponse(value)} className={'rounded-xl border px-2 py-3 text-sm font-semibold '+(response===value?'border-violet-600 bg-violet-50 text-violet-800':'border-black/10')}>{label}</button>)}</div>
    <label className="mt-5 block text-sm font-semibold">How many people, including you?<select value={count} onChange={e=>setCount(e.target.value)} className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 font-normal">{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
    <label className="mt-5 block text-sm font-semibold">Food preference<select value={diet} onChange={e=>setDiet(e.target.value)} className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 font-normal"><option value="none">No preference</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option><option value="jain">Jain</option><option value="non_vegetarian">Non-vegetarian</option><option value="other">Other / tell the host</option></select></label>
    {error&&<p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
    <button disabled={busy} className="mt-6 w-full rounded-xl bg-violet-700 px-5 py-3.5 font-bold text-white disabled:opacity-50">{busy?'Sending…':'Send my RSVP'}</button>
    <p className="mt-4 text-center text-xs text-black/40">No account or app download needed. Your host sees the RSVP details you submit.</p>
  </form>;
}
