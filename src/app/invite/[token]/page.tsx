import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { GuestRsvp } from '@/components/guest-rsvp';

export default async function InvitationPage({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  const supabase=await getSupabaseServerClient();
  const {data,error}=await supabase.rpc('get_invitation_preview',{p_token:token});
  const party=Array.isArray(data)?data[0]:null;
  if(error||!party) notFound();
  return <main className="min-h-screen bg-[#fffaf4] px-5 py-10 text-[#171522]"><div className="mx-auto max-w-2xl">
    <Link href="/" className="text-2xl font-black">partyhub<span className="text-violet-600">.</span></Link>
    <div className="mt-10 rounded-3xl bg-gradient-to-br from-violet-700 via-fuchsia-600 to-orange-300 p-8 text-white"><p className="text-xs font-bold tracking-[.25em]">YOU’RE INVITED</p><h1 className="mt-5 text-4xl font-black">{party.title}</h1><p className="mt-4 text-white/85">{new Date(party.starts_at).toLocaleString(undefined,{dateStyle:'full',timeStyle:'short',timeZone:party.timezone})}</p>{party.description&&<p className="mt-5 max-w-xl text-sm leading-6 text-white/90">{party.description}</p>}</div>
    <div className="mt-6"><GuestRsvp token={token} partyTitle={party.title}/></div>
    <p className="mt-6 text-center text-xs text-black/40">A good time, with good people. Powered by PartyHub.</p>
  </div></main>;
}
