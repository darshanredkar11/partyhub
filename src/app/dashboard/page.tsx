import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: parties } = await supabase.from('parties').select('id,title,starts_at,timezone,status').order('starts_at',{ascending:true}).limit(20);
  return <main className="min-h-screen bg-[#fffaf4] px-6 py-12 text-[#171522]"><div className="mx-auto max-w-4xl"><Link href="/" className="text-xl font-black">partyhub.</Link><p className="mt-12 text-sm font-bold tracking-widest text-violet-700">YOUR SPACE</p><h1 className="mt-2 text-4xl font-black">Welcome back.</h1><p className="mt-3 text-black/55">Signed in as {user.email}</p><section className="mt-8 rounded-2xl border border-black/10 bg-white p-7"><h2 className="text-xl font-bold">Your parties</h2>{parties?.length ? <ul className="mt-5 divide-y divide-black/10">{parties.map(p=><li key={p.id} className="py-4"><div className="font-semibold">{p.title}</div><div className="mt-1 text-sm text-black/50">{new Date(p.starts_at).toLocaleString()} · {p.status}</div></li>)}</ul> : <p className="mt-3 text-sm text-black/55">No parties yet. Party creation is the next feature slice.</p>}</section></div></main>;
}
