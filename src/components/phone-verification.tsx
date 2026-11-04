'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const countries = [
  { name: 'India', iso: 'IN', dial: '+91' },
  { name: 'United Kingdom', iso: 'GB', dial: '+44' },
  { name: 'United States', iso: 'US', dial: '+1' },
  { name: 'Canada', iso: 'CA', dial: '+1' },
  { name: 'Australia', iso: 'AU', dial: '+61' },
  { name: 'Other', iso: 'ZZ', dial: '+' },
];

export function PhoneVerification() {
  const router = useRouter();
  const [country, setCountry] = useState('IN');
  const [number, setNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const selected = countries.find(item => item.iso === country) ?? countries[0];

  async function sendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError('');
    const normalized = selected.dial + number.replace(/[^0-9]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setError('Enter a valid international phone number, including area code.');
      setBusy(false); return;
    }
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ phone: normalized });
      if (updateError) throw updateError;
      setPhone(normalized);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send verification code.');
    } finally { setBusy(false); }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token: otp.trim(), type: 'phone_change' });
      if (verifyError) throw verifyError;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in again.');
      const { error: profileError } = await supabase.from('profiles').update({
        display_name: displayName.trim(),
        phone_country: selected.iso === 'ZZ' ? null : selected.iso,
        pronouns: pronouns.trim() || null,
      }).eq('id', user.id);
      if (profileError) throw profileError;
      router.replace('/dashboard');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Phone verification failed.');
    } finally { setBusy(false); }
  }

  return <div className="w-full max-w-lg rounded-3xl border border-black/10 bg-white p-8 shadow-xl">
    <p className="text-xs font-bold tracking-[.2em] text-violet-700">ONE QUICK SAFETY CHECK</p>
    <h1 className="mt-3 text-3xl font-black">Let’s get your number.</h1>
    <p className="mt-3 text-sm leading-6 text-black/55">We verify your mobile number so hosts can coordinate with real guests. Your number stays private and is never shown to other party members by default.</p>
    {!sent ? <form onSubmit={sendCode} className="mt-7 space-y-4">
      <label className="block text-sm font-semibold">Display name</label>
      <input required maxLength={60} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="What should friends call you?" className="w-full rounded-xl border border-black/15 px-4 py-3"/>
      <label className="block text-sm font-semibold">Mobile number</label>
      <div className="grid grid-cols-[minmax(130px,.8fr)_1.2fr] gap-2">
        <select value={country} onChange={e=>setCountry(e.target.value)} className="min-w-0 rounded-xl border border-black/15 px-3 py-3 text-sm">
          {countries.map(c=><option key={c.iso} value={c.iso}>{c.name} ({c.dial})</option>)}
        </select>
        <input required inputMode="tel" autoComplete="tel-national" value={number} onChange={e=>setNumber(e.target.value)} placeholder="Phone number" className="min-w-0 rounded-xl border border-black/15 px-4 py-3"/>
      </div>
      <label className="block text-sm font-semibold">Pronouns <span className="font-normal text-black/40">· optional</span></label>
      <input maxLength={40} value={pronouns} onChange={e=>setPronouns(e.target.value)} placeholder="e.g. she/her, he/they, they/them" className="w-full rounded-xl border border-black/15 px-4 py-3"/>
      <p className="text-xs leading-5 text-black/45">Pronouns are optional and private by default. You can choose to share them with party members later.</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-[#211a32] px-5 py-3.5 font-bold text-white disabled:opacity-50">{busy?'Sending code…':'Send verification code'}</button>
    </form> : <form onSubmit={verifyCode} className="mt-7 space-y-4">
      <p className="rounded-xl bg-violet-50 p-4 text-sm">We sent an SMS code to <strong>{phone}</strong>.</p>
      <label className="block text-sm font-semibold">6-digit verification code</label>
      <input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} placeholder="000000" className="w-full rounded-xl border border-black/15 px-4 py-3 text-center text-2xl tracking-[.4em]"/>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button disabled={busy || otp.length<6} className="w-full rounded-xl bg-violet-700 px-5 py-3.5 font-bold text-white disabled:opacity-50">{busy?'Verifying…':'Verify and continue'}</button>
      <button type="button" onClick={()=>{setSent(false);setOtp('');setError('');}} className="w-full text-sm text-black/50 underline">Change number</button>
    </form>}
  </div>;
}
