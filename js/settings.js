// js/settings.js — réglages publics du site (ouverture de la boutique), pilotés depuis l'admin
import { getClient } from "./api.js";

const KEY = "joey_settings_v1", TTL = 60000;

/** true si la boutique est ouverte. { fresh: true } ignore le cache (page boutique). */
export async function merchEnabled({ fresh = false } = {}) {
  if (!fresh) {
    try { const c = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (c && Date.now() - c.t < TTL) return c.merch === true; } catch { /* cache absent */ }
  }
  let on = false;
  try {
    const sb = await getClient();
    if (sb) { const { data, error } = await sb.from("site_settings").select("value").eq("key", "merch_enabled").maybeSingle(); on = !error && data?.value === true; }
  } catch { /* hors ligne : boutique considérée fermée */ }
  try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), merch: on })); } catch { /* stockage indisponible */ }
  return on;
}
