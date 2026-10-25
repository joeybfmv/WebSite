// admin/js/promos-admin.js — codes promo du merch (droits imposés par Supabase RLS ; calcul de la remise fait par la base)
import { requireAdmin, mountAdminBar } from "./auth.js";
import { getClient } from "../../js/api.js";
import { el, stateEmpty, stateError, stateLoading } from "../../js/utils.js";

document.documentElement.classList.remove("no-js");
const $ = (id) => document.getElementById(id);
const user = await requireAdmin();
if (!user) throw new Error("Non autorisé");
mountAdminBar($("admin-bar"), user, "merch.html");
$("app").hidden = false;
const sb = await getClient();
const form = $("p-form");
const eur = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n));
const num = (n) => String(Number(n)).replace(".", ",");
const money = (t) => { const v = t.trim(); return v === "" ? null : Number(v.replace(",", ".")); };
let codes = [], uses = {}, timer;

function notify(type, text) {
  $("admin-status").replaceChildren(el("p", { class: `alert alert--${type}`, text }));
  clearTimeout(timer); if (type === "ok") timer = setTimeout(() => $("admin-status").replaceChildren(), 4000);
}

/* Lettres et chiffres sans ambiguïté (ni 0/O, ni 1/I) ; 8 caractères tirés au hasard par le navigateur. */
function randomCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", buf = new Uint32Array(8); crypto.getRandomValues(buf);
  return [...buf].map((n) => A[n % A.length]).join("");
}
function syncKind() {
  const pct = form.elements.kind.value === "percent";
  $("p-value-label").textContent = pct ? "Réduction (%) *" : "Réduction (€) *";
  form.elements.value.placeholder = pct ? "ex : 10" : "ex : 5";
}
form.elements.kind.addEventListener("change", syncKind);
$("p-gen").addEventListener("click", () => { form.elements.code.value = randomCode(); form.elements.value.focus(); });

async function load() {
  const list = $("p-list"); list.replaceChildren(stateLoading("Chargement…"));
  const [c, o] = await Promise.all([
    sb.from("merch_promo_codes").select("*").order("created_at", { ascending: false }),
    sb.from("merch_orders").select("promo_code,status").not("promo_code", "is", null)
  ]);
  if (c.error) { console.error(c.error); list.replaceChildren(stateError("Impossible de charger les codes : " + c.error.message + " (migration-merch-v4.sql exécutée ?)")); return; }
  codes = c.data; uses = {};
  for (const r of o.data || []) if (r.status !== "cancelled") uses[r.promo_code] = (uses[r.promo_code] || 0) + 1;
  render();
}

function state(c) {
  const used = uses[c.code] || 0;
  if (!c.is_active) return { text: "Désactivé", accent: false };
  if (c.expires_at && new Date(c.expires_at) < new Date()) return { text: "Expiré", accent: false };
  if (c.max_uses && used >= c.max_uses) return { text: "Épuisé", accent: false };
  return { text: "Actif", accent: true };
}
function render() {
  const list = $("p-list"); list.replaceChildren();
  if (!codes.length) { list.append(stateEmpty("Aucun code promo", "Crée ton premier code avec le formulaire ci-dessus.")); return; }
  for (const c of codes) {
    const st = state(c), used = uses[c.code] || 0;
    const btn = (text, cls, fn) => { const b = el("button", { class: `btn btn--small ${cls}`, type: "button", text }); b.addEventListener("click", fn); return b; };
    const bits = [c.kind === "percent" ? `−${num(c.value)} %` : `−${eur(c.value)}`];
    if (Number(c.min_total) > 0) bits.push(`dès ${eur(c.min_total)} d'achats`);
    bits.push(c.max_uses ? `${used} / ${c.max_uses} utilisations` : `${used} utilisation${used > 1 ? "s" : ""}`);
    if (c.expires_at) bits.push(`jusqu'au ${new Date(c.expires_at).toLocaleDateString("fr-FR")}`);
    list.append(el("article", { class: `admin-item${st.accent ? " admin-item--published" : ""}` },
      el("div", {}, el("span", { class: `badge${st.accent ? " badge--accent" : ""}`, text: st.text })),
      el("h2", { text: c.code }),
      el("p", { class: "admin-item__meta", text: bits.join(" · ") }),
      el("div", { class: "admin-item__actions" },
        btn("Copier le code", "btn--ghost", async () => { try { await navigator.clipboard.writeText(c.code); notify("ok", `Code ${c.code} copié.`); } catch { notify("err", "Copie impossible : sélectionne le code à la main."); } }),
        btn(c.is_active ? "Désactiver" : "Réactiver", "btn--ghost", () => patch(c, { is_active: !c.is_active })),
        btn("Supprimer", "btn--danger", () => remove(c)))));
  }
}
async function patch(c, values) {
  const { error } = await sb.from("merch_promo_codes").update(values).eq("code", c.code);
  if (error) return notify("err", "Échec : " + error.message);
  await load();
}
async function remove(c) {
  if (!window.confirm(`Supprimer le code ${c.code} ? (Les commandes déjà passées gardent leur remise. Tu peux aussi simplement le désactiver.)`)) return;
  const { error } = await sb.from("merch_promo_codes").delete().eq("code", c.code);
  if (error) return notify("err", "Suppression impossible : " + error.message);
  notify("ok", "Code supprimé."); await load();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const F = form.elements, err = $("p-error"); err.textContent = "";
  const code = F.code.value.trim().toUpperCase(), kind = F.kind.value, value = money(F.value.value);
  const min = money(F.min_total.value), maxRaw = F.max_uses.value.trim(), max = maxRaw === "" ? null : Number(maxRaw);
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return void (err.textContent = "Le code doit faire 3 à 30 caractères : lettres, chiffres, tiret ou souligné (sans espace ni accent).");
  if (value === null || !Number.isFinite(value) || value <= 0 || value > 99999) return void (err.textContent = "Indique une réduction valide.");
  if (kind === "percent" && value > 100) return void (err.textContent = "Un pourcentage ne peut pas dépasser 100.");
  if (min !== null && (!Number.isFinite(min) || min < 0)) return void (err.textContent = "Achat minimum invalide.");
  if (max !== null && (!Number.isInteger(max) || max < 1)) return void (err.textContent = "Le nombre d'utilisations doit être un entier d'au moins 1 (ou vide).");
  const expires_at = F.expires.value ? new Date(`${F.expires.value}T23:59:59`).toISOString() : null;
  const btn = $("p-save"); btn.disabled = true;
  const { error } = await sb.from("merch_promo_codes").insert({ code, kind, value, min_total: min ?? 0, max_uses: max, expires_at, is_active: true });
  btn.disabled = false;
  if (error) { err.textContent = /duplicate|unique/i.test(error.message) ? "Ce code existe déjà." : "Création impossible : " + error.message; return; }
  form.reset(); syncKind(); notify("ok", `Code ${code} créé.`); await load();
});

syncKind(); await load();
