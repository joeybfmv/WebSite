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
const LABEL = { new: "Nouvelle", confirmed: "Confirmée", ready: "Prête à remettre", done: "Terminée", cancelled: "Annulée" };
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
  const f = $("o-filter").value, list = $("o-list");
  const shown = rows.filter((o) => f === "all" || o.status === f); list.replaceChildren();
  if (!shown.length) { list.append(stateEmpty("Aucune commande", "Rien à afficher pour ce filtre.")); return; }
  for (const o of shown) {
    const btn = (text, cls, fn) => { const b = el("button", { class: `btn btn--small ${cls}`, type: "button", text }); b.addEventListener("click", fn); return b; };
    const subject = encodeURIComponent("Votre commande merch");
    list.append(el("article", { class: `admin-item${o.status === "new" ? " admin-item--published" : ""}` },
      el("div", {}, el("span", { class: `badge${o.status === "new" ? " badge--accent" : ""}`, text: LABEL[o.status] }), el("span", { class: "badge", text: ` ${formatDate(o.created_at)} ${formatTime(o.created_at)}` })),
      el("h2", { text: `${o.name} — ${eur(o.total)}` }),
      el("p", { class: "admin-item__meta", text: o.email }),
      el("ul", {}, (o.items || []).map((i) => el("li", { text: `${i.qty} × ${i.name} (${eur(i.price)})` }))),
      o.message ? el("p", { class: "req-msg", text: o.message }) : null,
      el("div", { class: "admin-item__actions" },
        el("a", { class: "btn btn--small btn--primary", href: `mailto:${o.email}?subject=${subject}`, text: "Répondre par e-mail" }),
        o.status === "new" && btn("Confirmer", "btn--ghost", () => setStatus(o, "confirmed")),
        o.status === "confirmed" && btn("Prête à remettre", "btn--ghost", () => setStatus(o, "ready")),
        ["new", "confirmed", "ready"].includes(o.status) && btn("Terminée", "btn--ghost", () => setStatus(o, "done")),
        o.status !== "cancelled" && o.status !== "done" && btn("Annuler", "btn--ghost", () => setStatus(o, "cancelled")),
        btn("Supprimer", "btn--danger", () => remove(o)))));
  }
}
$("o-filter").addEventListener("change", render);
await load();
