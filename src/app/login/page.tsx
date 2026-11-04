'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email,setEmail] = useState('');
  const [busy,setBusy] = useState(false);
  const [sent,setSent] = useState(false);
  const [error,setError] = useState('');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({ email:email.trim(), options:{ emailRedirectTo:window.location.origin+'/auth/callback', shouldCreateUser:true } });
      if (error) throw error;
      setSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to send the sign-in link.'); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#fffaf4] px-5 text-[#171522]"><div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-8 shadow-xl"><Link href="/" className="text-sm text-black/50">← PartyHub home</Link><h1 className="mt-8 text-3xl font-black">Welcome to the party.</h1><p className="mt-2 text-sm text-black/55">Enter your email for a secure sign-in link. We’ll verify your mobile number the first time you sign in.</p>{sent ? <div className="mt-7 rounded-xl bg-emerald-50 p-5"><p className="font-semibold">Check your inbox</p><p className="mt-2 text-sm">We sent a link to {email}.</p><button className="mt-4 text-sm underline" onClick={()=>setSent(false)}>Try another email</button></div> : <form onSubmit={submit} className="mt-7 space-y-4"><label htmlFor="email" className="block text-sm font-semibold">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-black/15 px-4 py-3.5 outline-none focus:border-violet-500"/>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-[#211a32] px-5 py-3.5 font-bold text-white disabled:opacity-50">{busy?'Sending…':'Email me a sign-in link'}</button></form>}<p className="mt-7 border-t border-black/10 pt-5 text-xs leading-5 text-black/45">WhatsApp is available for sharing party invitations. Email magic link signs you in; a verified mobile number completes your account. Your number stays private.</p></div></main>;
}
