import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function JoinPartyPage({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  const supabase=await getSupabaseServerClient();
  const nextPath='/join/'+token;
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login?next='+encodeURIComponent(nextPath));
  const {data:profile}=await supabase.from('profiles').select('phone_verified_at').eq('id',user.id).maybeSingle();
  if(!profile?.phone_verified_at)redirect('/onboarding/phone?next='+encodeURIComponent(nextPath));
  const {data:partyId,error}=await supabase.rpc('accept_party_invitation',{p_token:token});
  if(error) return <main className="flex min-h-screen items-center justify-center bg-[#fffaf4] px-5 text-[#171522]"><div className="max-w-md rounded-3xl border border-black/10 bg-white p-8"><h1 className="text-2xl font-black">Couldn’t join this party.</h1><p className="mt-3 text-sm text-black/55">{error.message}</p><Link href="/dashboard" className="mt-6 inline-block rounded-full bg-violet-700 px-5 py-3 text-sm font-bold text-white">Go to dashboard</Link></div></main>;
  redirect('/party/'+partyId);
}
