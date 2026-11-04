import { notFound,redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { PartyRoom } from '@/components/party-room';

export default async function PartyPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const supabase=await getSupabaseServerClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('display_name,phone_verified_at').eq('id',user.id).maybeSingle();
  if(!profile?.phone_verified_at) redirect('/onboarding/phone');
  const {data:party}=await supabase.from('parties').select('id,title,starts_at,description').eq('id',id).maybeSingle();
  if(!party)notFound();
  const {data:membership}=await supabase.from('party_members').select('id').eq('party_id',id).eq('user_id',user.id).eq('status','accepted').maybeSingle();
  if(!membership)notFound();
  return <PartyRoom party={party} userId={user.id} displayName={profile.display_name||'Party guest'} membershipId={membership.id}/>;
}
