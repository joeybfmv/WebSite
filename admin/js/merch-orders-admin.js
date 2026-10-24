// admin/js/merch-orders-admin.js — demandes de commande du panier
import { requireAdmin, mountAdminBar } from "./auth.js";
import { getClient } from "../../js/api.js";
import { el, formatDate, formatTime, stateEmpty, stateError, stateLoading } from "../../js/utils.js";

document.documentElement.classList.remove("no-js");
const $ = (id) => document.getElementById(id);
const user = await requireAdmin();
if (!user) throw new Error("Non autorisé");
mountAdminBar($("admin-bar"), user, "merch-orders.html");
$("app").hidden = false;
const sb = await getClient();
const LABEL = { pending_payment: "En attente de paiement", paid: "Payée en ligne", new: "Nouvelle", confirmed: "Confirmée", ready: "Prête à remettre", done: "Terminée", cancelled: "Annulée" };
const eur = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n));
let rows = [], timer;
function notify(type, text) {
  $("admin-status").replaceChildren(el("p", { class: `alert alert--${type}`, text }));
  clearTimeout(timer); if (type === "ok") timer = setTimeout(() => $("admin-status").replaceChildren(), 4000);
}
async function load() {
  const list = $("o-list"); list.replaceChildren(stateLoading("Chargement…"));
  const { data, error } = await sb.from("merch_orders").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); list.replaceChildren(stateError("Impossible de charger les commandes : " + error.message)); return; }
  rows = data; render();
}
async function setStatus(o, status) {
  const { error } = await sb.from("merch_orders").update({ status }).eq("id", o.id);
  if (error) return notify("err", "Échec : " + error.message); await load();
}
async function remove(o) {
  if (!window.confirm(`Supprimer définitivement la commande de ${o.name} ?`)) return;
  const { error } = await sb.from("merch_orders").delete().eq("id", o.id);
  if (error) return notify("err", "Suppression impossible : " + error.message); notify("ok", "Commande supprimée."); await load();
}
function render() {
  const list = $("o-list"), shown = filtered(); list.replaceChildren();
  const sum = shown.filter((o) => o.status !== "cancelled").reduce((n, o) => n + Number(o.total || 0), 0);
  $("o-summary").textContent = `${shown.length} commande${shown.length > 1 ? "s" : ""} affichée${shown.length > 1 ? "s" : ""} · ${eur(sum)} (hors annulées)`;
  if (!shown.length) { list.append(stateEmpty("Aucune commande", "Rien à afficher pour ce filtre.")); return; }
  for (const o of shown) {
    const btn = (text, cls, fn) => { const b = el("button", { class: `btn btn--small ${cls}`, type: "button", text }); b.addEventListener("click", fn); return b; };
    const subject = encodeURIComponent("Votre commande merch");
    list.append(el("article", { class: `admin-item${["new", "paid"].includes(o.status) ? " admin-item--published" : ""}` },
      el("div", {}, el("span", { class: `badge${["new", "paid"].includes(o.status) ? " badge--accent" : ""}`, text: LABEL[o.status] }), el("span", { class: "badge", text: ` ${formatDate(o.created_at)} ${formatTime(o.created_at)}` })),
      el("h2", { text: `${o.name} — ${eur(o.total)}` }),
      el("p", { class: "admin-item__meta", text: `${o.email} · ${o.payment_method === "online" ? "paiement en ligne" : "réservation (paiement à la remise)"}` }),
      el("ul", {}, (o.items || []).map((i) => el("li", { text: `${i.qty} × ${i.name}${i.variant ? ` (${i.variant})` : ""} — ${eur(i.price)}` }))),
      o.message ? el("p", { class: "req-msg", text: o.message }) : null,
      el("div", { class: "admin-item__actions" },
        el("a", { class: "btn btn--small btn--primary", href: `mailto:${o.email}?subject=${subject}`, text: "Répondre par e-mail" }),
        o.status === "new" && btn("Confirmer", "btn--ghost", () => setStatus(o, "confirmed")),
        ["paid", "confirmed"].includes(o.status) && btn("Prête à remettre", "btn--ghost", () => setStatus(o, "ready")),
        ["new", "paid", "confirmed", "ready"].includes(o.status) && btn("Terminée", "btn--ghost", () => setStatus(o, "done")),
        !["cancelled", "done"].includes(o.status) && btn("Annuler", "btn--ghost", () => { if (o.status === "pending_payment" || o.payment_method !== "online" || window.confirm("Commande payée en ligne : pense à la rembourser dans Stripe. Annuler quand même ?")) setStatus(o, "cancelled"); }),
        btn("Supprimer", "btn--danger", () => remove(o)))));
  }
}
function filtered() {
  const f = $("o-filter").value, q = $("o-search").value.trim().toLowerCase();
  return rows.filter((o) => (f === "all" || o.status === f) && (!q || `${o.name} ${o.email}`.toLowerCase().includes(q)));
}
// Une cellule qui commence par = + - @ serait lue comme une formule par Excel : on la neutralise.
const cell = (v) => { let t = String(v ?? ""); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return `"${t.replace(/"/g, '""')}"`; };
function exportCsv() {
  const shown = filtered();
  if (!shown.length) return notify("err", "Rien à exporter pour ce filtre.");
  const head = ["Date", "Nom", "E-mail", "Statut", "Paiement", "Articles", "Total (€)", "Message"];
  const lines = shown.map((o) => [`${formatDate(o.created_at)} ${formatTime(o.created_at)}`, o.name, o.email, LABEL[o.status] || o.status, o.payment_method === "online" ? "en ligne" : "à la remise",
    (o.items || []).map((i) => `${i.qty} × ${i.name}${i.variant ? ` (${i.variant})` : ""}`).join(" + "), String(o.total ?? "").replace(".", ","), o.message || ""].map(cell).join(";"));
  const blob = new Blob(["\ufeff" + [head.map(cell).join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `commandes-merch-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$("o-filter").addEventListener("change", render);
$("o-search").addEventListener("input", render);
$("o-export").addEventListener("click", exportCsv);
await load();
