"use client";
import {useState} from "react";
import {PartyPopper,ArrowLeft,UserPlus,LogIn,LockKeyhole} from "lucide-react";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";

export default function LoginPage(){
 const [mode,setMode]=useState<"signup"|"signin">("signup");
 const [name,setName]=useState("");
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);

 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setMessage("");setError("");
  try{
   const supabase=getSupabaseBrowserClient();
   if(mode==="signup"){
    const {data,error}=await supabase.auth.signUp({
     email:email.trim(),
     password,
     options:{data:{display_name:name.trim()}}
    });
    if(error)throw error;
    if(data.session) setMessage("Your account is ready. You're signed in!");
    else setMessage("Account created. Email confirmation is still enabled in Supabase; it must be turned off to use password-only signup.");
   }else{
    const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(error)throw error;
    window.location.assign("/");
   }
  }catch(err){
   setError(err instanceof Error?err.message:"We couldn't complete your request. Please try again.");
  }finally{setBusy(false)}
 }

 return <main className="invite-page"><div className="invite-card login-card">
  <a className="back-link" href="/"><ArrowLeft size={15}/> Back to PartyHub</a>
  <div className="brand"><span className="brand-mark"><PartyPopper size={20}/></span> partyhub</div>
  <div className="eyebrow">HOST ACCESS</div>
  <h1>{mode==="signup"?"Create your account.":"Welcome back."}</h1>
  <p>{mode==="signup"?"Create an account to plan celebrations and manage guest responses.":"Sign in to manage your celebrations."}</p>
  <div className="auth-switch" role="group" aria-label="Account access">
   <button type="button" className={mode==="signup"?"auth-tab active":"auth-tab"} onClick={()=>{setMode("signup");setMessage("");setError("");}}>Create account</button>
   <button type="button" className={mode==="signin"?"auth-tab active":"auth-tab"} onClick={()=>{setMode("signin");setMessage("");setError("");}}>Sign in</button>
  </div>
  <form className="rsvp-form" onSubmit={submit}>
   {mode==="signup"&&<label>Your name<input required autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>}
   <label>Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
   <label>Password<input required type="password" minLength={12} autoComplete={mode==="signup"?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 12 characters"/></label>
   <button className="primary-btn full-btn" disabled={busy}>{busy?"Please wait…":mode==="signup"?<><UserPlus size={17}/> Create account</>:<><LogIn size={17}/> Sign in</>}</button>
  </form>
  {message&&<div className="notice success-notice">{message}</div>}
  {error&&<div className="notice error-notice">{error}</div>}
  <p className="form-footnote"><LockKeyhole size={13}/> Passwords are handled securely by Supabase. No magic links.</p>
 </div></main>;
}
