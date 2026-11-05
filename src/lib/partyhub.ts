import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type PartyRow = {
  id: string; title: string; description: string; party_type: string;
  starts_at: string; ends_at: string; arrival_from: string | null;
  arrival_until: string | null; timezone: string; currency: "INR" | "GBP";
  status: string; venue_ciphertext?: string | null;
  guest_rsvps?: { id: string; display_name: string; response: "yes" | "no" | "maybe"; guest_count: number; dietary_type: string | null }[];
};

const PARTY_TYPES = new Set(["house_party", "birthday", "dinner", "game_night", "celebration", "other"]);
const DIETARY_TYPES = new Set(["none", "vegetarian", "vegan", "jain", "non_vegetarian", "other"]);
const RESPONSES = new Set(["yes", "no", "maybe"]);

export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
export function supabase() { return getSupabaseBrowserClient(); }
export async function currentUser() {
  const { data, error } = await supabase().auth.getUser();
  if (error) throw error;
  return data.user;
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

function parseLocalDateTime(date: string, time: string, field: string): Date {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || !/^([01]\\d|2[0-3]):[0-5]\\d$/.test(time)) {
    throw new Error(`Enter a valid ${field} date and time.`);
  }
  const value = new Date(`${date}T${time}:00`);
  if (Number.isNaN(value.getTime())) throw new Error(`Enter a valid ${field} date and time.`);
  return value;
}

export async function createParty(input: {
  title: string; description: string; partyType: string; date: string;
  start: string; end: string; arrivalFrom: string; arrivalUntil: string;
  timezone: string; currency: "INR" | "GBP";
}) {
  const user = await currentUser();
  if (!user) throw new Error("Sign in to create a celebration.");
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title || title.length > 120) throw new Error("Give your celebration a title (1–120 characters).");
  if (description.length > 5000) throw new Error("Description must be 5,000 characters or fewer.");
  if (!PARTY_TYPES.has(input.partyType)) throw new Error("Choose a valid celebration type.");
  if (input.currency !== "INR" && input.currency !== "GBP") throw new Error("Choose INR or GBP.");
  try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format(); }
  catch { throw new Error("Choose a valid time zone."); }
  if (Boolean(input.arrivalFrom) !== Boolean(input.arrivalUntil)) {
    throw new Error("Set both arrival times, or leave both blank.");
  }

  const startDate = parseLocalDateTime(input.date, input.start, "start");
  const endDate = parseLocalDateTime(input.date, input.end, "end");
  if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
  if (endDate.getTime() - startDate.getTime() > 24 * 60 * 60 * 1000) {
    throw new Error("A celebration cannot last longer than 24 hours.");
  }

  const arrivalStartDate = input.arrivalFrom ? parseLocalDateTime(input.date, input.arrivalFrom, "arrival") : null;
  const arrivalEndDate = input.arrivalUntil ? parseLocalDateTime(input.date, input.arrivalUntil, "arrival") : null;
  if (arrivalStartDate && arrivalEndDate && arrivalEndDate < arrivalStartDate) {
    arrivalEndDate.setDate(arrivalEndDate.getDate() + 1);
  }
  if (arrivalStartDate && arrivalEndDate && arrivalEndDate.getTime() - arrivalStartDate.getTime() > 24 * 60 * 60 * 1000) {
    throw new Error("The arrival window cannot exceed 24 hours.");
  }

  const { data, error } = await supabase().from("parties").insert({
    host_id: user.id, title, description,
    party_type: input.partyType, starts_at: startDate.toISOString(), ends_at: endDate.toISOString(),
    arrival_from: arrivalStartDate?.toISOString() ?? null,
    arrival_until: arrivalEndDate?.toISOString() ?? null,
    timezone: input.timezone, currency: input.currency, status: "published"
  }).select("id").single();
  if (error) throw error;
  if (!data?.id) throw new Error("The celebration was not saved. Please try again.");
  return data.id as string;
}

export async function createInvite(partyId: string): Promise<string> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(partyId)) {
    throw new Error("Invalid celebration.");
  }
  const { data, error } = await supabase().rpc("create_party_invite", { p_party_id: partyId });
  if (error) throw error;
  if (typeof data !== "string" || !/^[0-9a-f]{64}$/i.test(data)) {
    throw new Error("The invitation could not be created. Please try again.");
  }
  return data;
}

export async function getInvite(token: string) {
  if (!/^[0-9a-f]{64}$/i.test(token)) return null;
  const { data, error } = await supabase().rpc("get_invitation_preview", { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return row as {
    party_id: string; title: string; description: string; party_type: string;
    starts_at: string; ends_at: string; arrival_from: string | null;
    arrival_until: string | null; timezone: string;
  };
}

export async function submitRsvp(input: {
  token: string; name: string; response: "yes" | "no" | "maybe";
  guestCount: number; dietaryType: string | null; editToken?: string | null;
}) {
  const name = input.name.trim();
  if (!/^[0-9a-f]{64}$/i.test(input.token)) throw new Error("This invitation link is invalid.");
  if (!name || name.length > 100) throw new Error("Enter your name (1–100 characters).");\n  if (/[\\u0000-\\u001f\\u007f]/.test(name)) throw new Error("Your name cannot contain control characters.");
  if (!RESPONSES.has(input.response)) throw new Error("Choose a valid RSVP response.");
  if (!Number.isInteger(input.guestCount) || input.guestCount < 1 || input.guestCount > 20) {
    throw new Error("Guest count must be between 1 and 20.");
  }
  if (input.dietaryType !== null && !DIETARY_TYPES.has(input.dietaryType)) {
    throw new Error("Choose a valid food preference.");
  }
  if (input.editToken && !/^[0-9a-f]{64}$/i.test(input.editToken)) {
    throw new Error("Your RSVP edit permission is invalid. Submit again to create a new response.");
  }
  const { data, error } = await supabase().rpc("submit_guest_rsvp", {
    p_token: input.token, p_display_name: name,
    p_response: input.response, p_guest_count: input.guestCount,
    p_dietary_type: input.dietaryType, p_edit_token: input.editToken ?? null
  });
  if (error) throw error;
  if (!data || typeof data.rsvp_id !== "string") throw new Error("Your response could not be confirmed. Please try again.");
  return data as { rsvp_id: string; edit_token: string | null };
}
