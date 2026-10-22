// js/api.js — accès aux données (Supabase ou données de démonstration)
import { CONFIG, isConfigured } from "./config.js";
import { DEMO } from "./demo-data.js";

const SUPABASE_ESM = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
let clientPromise = null;

export const isDemoMode = () => !isConfigured();

/** Client Supabase (clé publique uniquement). Retourne null en mode démo. */
export function getClient() {
  if (!isConfigured()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import(SUPABASE_ESM).then(({ createClient }) =>
      createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      })
    );
  }
  return clientPromise;
}

function startOfTodayIso() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
}

async function run(query, demoRows) {
  const sb = await getClient();
  if (!sb) return { data: demoRows, demo: true };
  const { data, error } = await query(sb);
  if (error) throw error;
  return { data: data ?? [], demo: false };
}

/** Concerts publiés à venir, du plus proche au plus lointain. */
export function fetchUpcomingConcerts(limit) {
  return run(
    (sb) => {
      let q = sb.from("concerts").select("*").eq("is_published", true).gte("event_date", startOfTodayIso()).order("event_date", { ascending: true });
      if (limit) q = q.limit(limit);
      return q;
    },
    DEMO.concerts.slice(0, limit || undefined)
  );
}

export function fetchSetlist() {
  return run((sb) => sb.from("setlist").select("*").eq("is_published", true).order("position", { ascending: true, nullsFirst: false }), DEMO.setlist);
}

export function fetchGear() {
  return run((sb) => sb.from("gear").select("*").eq("is_published", true).order("position", { ascending: true, nullsFirst: false }), DEMO.gear);
}

/** Envoi d'une demande de concert. Aucune lecture n'est autorisée côté public (RLS). */
export async function submitContactRequest(payload) {
  const sb = await getClient();
  if (!sb) {
    await new Promise((r) => setTimeout(r, 500));
    return { demo: true };
  }
  const { error } = await sb.from("contact_requests").insert(payload);
  if (error) throw error;
  return { demo: false };
}
