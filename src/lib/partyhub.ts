import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type PartyRow = {
  id: string; title: string; description: string; party_type: string;
  starts_at: string; ends_at: string; arrival_from: string | null;
  arrival_until: string | null; timezone: string; currency: "INR" | "GBP";
  status: string; venue_ciphertext?: string | null; venue_map_url?: string | null; poster_url?: string | null; cost_amount?: number | null; cost_basis?: "per_person" | "per_venue" | "per_hour" | "total" | null; cost_negotiable?: boolean;
  guest_rsvps?: { id: string; display_name: string; response: "yes" | "no" | "maybe"; guest_count: number; dietary_type: string | null }[];
};

export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
export function supabase() { return getSupabaseBrowserClient(); }
export async function currentUser() {
  // A visitor without a login session is a normal public landing-page state.
  // getUser() returns AuthSessionMissingError when there is no session; that
  // must not be surfaced as an application error to anonymous visitors.
  const { data, error } = await supabase().auth.getSession();
  if (error) throw new Error("We couldn't check your sign-in. Please refresh and try again.");
  return data.session?.user ?? null;
}
export async function listHostParties(page = 1, pageSize = 10): Promise<{ parties: PartyRow[]; total: number }> {
  const user = await currentUser();
  if (!user) return [];
  const { data, error, count } = await supabase().from("parties")
    .select("id,title,description,party_type,starts_at,ends_at,arrival_from,arrival_until,timezone,currency,status,venue_map_url,poster_url,cost_amount,cost_basis,cost_negotiable,guest_rsvps(id,display_name,response,guest_count,dietary_type)", { count: "exact" })
    .eq("host_id", user.id).order("starts_at", { ascending: true }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { parties: (data ?? []) as PartyRow[], total: count ?? 0 };
}
export async function createParty(input: {
  title: string; description: string; partyType: string; date: string;
  start: string; end: string; arrivalFrom: string; arrivalUntil: string;
  timezone: string; currency: "INR" | "GBP"; venueMapUrl: string | null;
  costAmount: number | null; costBasis: "per_person" | "per_venue" | "per_hour" | "total"; costNegotiable: boolean;
}) {
  const user = await currentUser();
  if (!user) throw new Error("Sign in to create a celebration.");
  if (Boolean(input.arrivalFrom) !== Boolean(input.arrivalUntil)) {
    throw new Error("Set both arrival times, or leave both blank.");
  }
  const startDate = new Date(input.date + "T" + input.start);
  const endDate = new Date(input.date + "T" + input.end);
  if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
  const arrivalStartDate = input.arrivalFrom ? new Date(input.date + "T" + input.arrivalFrom) : null;
  const arrivalEndDate = input.arrivalUntil ? new Date(input.date + "T" + input.arrivalUntil) : null;
  if (arrivalStartDate && arrivalEndDate && arrivalEndDate < arrivalStartDate) arrivalEndDate.setDate(arrivalEndDate.getDate() + 1);
  const { data, error } = await supabase().rpc("create_party", {
    p_title: input.title.trim(),
    p_description: input.description.trim(),
    p_party_type: input.partyType,
    p_starts_at: startDate.toISOString(),
    p_ends_at: endDate.toISOString(),
    p_arrival_from: arrivalStartDate?.toISOString() ?? null,
    p_arrival_until: arrivalEndDate?.toISOString() ?? null,
    p_timezone: input.timezone,
    p_currency: input.currency,
    p_cost_amount: input.costAmount,
    p_cost_basis: input.costBasis,
    p_cost_negotiable: input.costNegotiable,
    p_venue_map_url: input.venueMapUrl
  });
  if (error) throw new Error(error.message);
  if (typeof data !== "string") throw new Error("The celebration was not created. Please try again.");
  return data;
}

export async function uploadPartyPoster(partyId: string, file: File): Promise<string> {
  const user = await currentUser();
  if (!user) throw new Error("Sign in to upload a poster.");
  const extensions: Record<string,string> = { "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp" };
  const extension = extensions[file.type];
  if (!extension) throw new Error("Use a JPG, PNG or WebP poster.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Poster must be 5 MB or smaller.");
  const path = partyId + "/" + user.id + "/" + crypto.randomUUID() + "." + extension;
  const client = supabase();
  const { error: uploadError } = await client.storage.from("party-posters").upload(path,file,{contentType:file.type,upsert:false});
  if (uploadError) throw uploadError;
  const { data } = client.storage.from("party-posters").getPublicUrl(path);
  const { error: updateError } = await client.from("parties").update({poster_url:data.publicUrl}).eq("id",partyId).eq("host_id",user.id);
  if (updateError) throw updateError;
  return data.publicUrl;
}
export async function createInvite(partyId: string): Promise<string> {
  const { data, error } = await supabase().rpc("create_party_invite", { p_party_id: partyId });
  if (error) throw error;
  if (typeof data !== "string" || !data) throw new Error("The invitation could not be created.");
  return data;
}
export async function getInvite(token: string) {
  const { data, error } = await supabase().rpc("get_invitation_preview", { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("This invitation is invalid, expired or revoked.");
  return row as {
    party_id: string; title: string; description: string; party_type: string;
    starts_at: string; ends_at: string; arrival_from: string | null;
    arrival_until: string | null; timezone: string; venue_map_url: string | null;
  };
}
export async function submitRsvp(input: {
  token: string; name: string; response: "yes" | "no" | "maybe";
  guestCount: number; dietaryType: string | null;
}) {
  const { data, error } = await supabase().rpc("submit_guest_rsvp", {
    p_token: input.token, p_display_name: input.name.trim(),
    p_response: input.response, p_guest_count: input.guestCount,
    p_dietary_type: input.dietaryType
  });
  if (error) throw error;
  return data as string;
}
