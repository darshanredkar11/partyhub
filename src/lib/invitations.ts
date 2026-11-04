/** 256-bit URL-safe invitation secret. Persist only its SHA-256 hash in Supabase. */
export function generateInvitationToken() {
  const bytes=crypto.getRandomValues(new Uint8Array(32)); let raw=''; bytes.forEach(byte=>raw+=String.fromCharCode(byte));
  return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
}
export async function hashInvitationToken(token:string) { return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))); }
export function whatsappShareUrl(message:string) { return 'https://wa.me/?text='+encodeURIComponent(message); }
