import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { PhoneVerification } from '@/components/phone-verification';

export default async function PhoneOnboardingPage({searchParams}:{searchParams:Promise<{next?:string}>}) {
  const params=await searchParams;
  const requestedNext=params.next;
  const nextPath=requestedNext?.startsWith('/')&&!requestedNext.startsWith('//')?requestedNext:'/dashboard';
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('phone_verified_at').eq('id',user.id).maybeSingle();
  if (profile?.phone_verified_at) redirect(nextPath);
  return <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#fffaf4] px-5 py-10 text-[#171522]">
    <Link href="/" className="text-2xl font-black">partyhub<span className="text-violet-600">.</span></Link>
    <PhoneVerification nextPath={nextPath}/>
    <p className="max-w-lg text-center text-xs leading-5 text-black/40">We only use your verified number for account safety and party coordination. We do not sell phone numbers or expose them in the member directory.</p>
  </main>;
}
