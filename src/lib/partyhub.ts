import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type PartyRow = {
  id: string; title: string; description: string; party_type: string;
  starts_at: string; ends_at: string; arrival_from: string | null;
  arrival_until: string | null; timezone: string; currency: "INR" | "GBP";
  status: string; venue_ciphertext?: string | null;
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
export async function listHostParties(): Promise<PartyRow[]> {
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await supabase().from("parties")
    .select("id,title,description,party_type,starts_at,ends_at,arrival_from,arrival_until,timezone,currency,status,guest_rsvps(id,display_name,response,guest_count,dietary_type)")
    .eq("host_id", user.id).order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PartyRow[];
}
export async function createParty(input: {
  title: string; description: string; partyType: string; date: string;
  start: string; end: string; arrivalFrom: string; arrivalUntil: string;
  timezone: string; currency: "INR" | "GBP";
}) {
  const user = await currentUser();
  if (!user) throw new Error("Sign in to create a celebration.");
  if (Boolean(input.arrivalFrom) !== Boolean(input.arrivalUntil)) {
    throw new Error("Set both arrival times, or leave both blank.");
  }
  const startDate = new Date(input.date + "T" + input.start);
  const endDate = new Date(input.date + "T" + input.end);
  if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
  const startsAt = startDate.toISOString();
  const endsAt = endDate.toISOString();
  const arrivalStartDate = input.arrivalFrom ? new Date(input.date + "T" + input.arrivalFrom) : null;
  const arrivalEndDate = input.arrivalUntil ? new Date(input.date + "T" + input.arrivalUntil) : null;
  if (arrivalStartDate && arrivalEndDate && arrivalEndDate < arrivalStartDate) arrivalEndDate.setDate(arrivalEndDate.getDate() + 1);
  const arrivalFrom = arrivalStartDate?.toISOString() ?? null;
  const arrivalUntil = arrivalEndDate?.toISOString() ?? null;
  const { data, error } = await supabase().from("parties").insert({
    host_id: user.id, title: input.title.trim(), description: input.description.trim(),
    party_type: input.partyType, starts_at: startsAt, ends_at: endsAt,
    arrival_from: arrivalFrom, arrival_until: arrivalUntil,
    timezone: input.timezone, currency: input.currency, status: "published"
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
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
    arrival_until: string | null; timezone: string;
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
