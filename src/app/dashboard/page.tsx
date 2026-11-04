import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { PartyDashboard } from '@/components/party-dashboard';

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('display_name,phone_verified_at').eq('id',user.id).maybeSingle();
  if (!profile?.phone_verified_at) redirect('/onboarding/phone');
  const { data: parties } = await supabase.from('parties').select('id,title,starts_at,status,timezone').order('starts_at',{ascending:true}).limit(30);
  const { data: activities } = await supabase.from('party_activities').select('id,message,created_at').order('created_at',{ascending:false}).limit(8);
  return <main className="min-h-screen bg-[#fffaf4] px-5 py-10 text-[#171522]"><div className="mx-auto max-w-5xl">
    <nav className="flex items-center justify-between"><Link href="/" className="text-2xl font-black">partyhub<span className="text-violet-600">.</span></Link><form action="/auth/signout" method="post"><button className="text-sm text-black/45 underline">Sign out</button></form></nav>
    <div className="mt-12"><PartyDashboard initialParties={parties??[]} userId={user.id} displayName={profile.display_name||user.email?.split('@')[0]||'friend'}/></div>
    <section className="mt-12 rounded-3xl border border-black/10 bg-white p-6"><h2 className="text-xl font-black">The party feed</h2>{activities?.length?<ul className="mt-4 divide-y divide-black/5">{activities.map(a=><li key={a.id} className="py-3"><p className="text-sm">{a.message}</p><p className="mt-1 text-xs text-black/35">{new Date(a.created_at).toLocaleString()}</p></li>)}</ul>:<p className="mt-2 text-sm text-black/45">Your party moments will show up here.</p>}</section>
  </div></main>;
}
