const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Selective encryption helper. Store key material only in an intentional key-management flow. */
export async function generateAesKey():Promise<CryptoKey> {
  return crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptText(plaintext:string,key:CryptoKey,context?:string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const params:AesGcmParams = {name:'AES-GCM',iv};
  if (context) params.additionalData = encoder.encode(context);
  const ciphertext = await crypto.subtle.encrypt(params,key,encoder.encode(plaintext));
  return {iv:toBase64(iv),ciphertext:toBase64(new Uint8Array(ciphertext)),version:1 as const};
}
export async function decryptText(payload:{iv:string,ciphertext:string},key:CryptoKey,context?:string) {
  const params:AesGcmParams = {name:'AES-GCM',iv:fromBase64(payload.iv)};
  if (context) params.additionalData = encoder.encode(context);
  return decoder.decode(await crypto.subtle.decrypt(params,key,fromBase64(payload.ciphertext)));
}
function toBase64(bytes:Uint8Array) { let raw=''; bytes.forEach(byte=>raw+=String.fromCharCode(byte)); return btoa(raw); }
function fromBase64(value:string) { const raw=atob(value); return Uint8Array.from(raw,char=>char.charCodeAt(0)); }
