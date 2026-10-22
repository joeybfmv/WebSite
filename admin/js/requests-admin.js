// admin/js/requests-admin.js — demandes « Proposer un concert » (lecture réservée aux admins par RLS)
import { requireAdmin, mountAdminBar } from "./auth.js";
import { getClient } from "../../js/api.js";
import { el, formatDate, formatTime, stateEmpty, stateError, stateLoading } from "../../js/utils.js";

document.documentElement.classList.remove("no-js");
const $ = (id) => document.getElementById(id);
const user = await requireAdmin();
if (!user) throw new Error("Non autorisé");
mountAdminBar($("admin-bar"), user, "requests.html");
$("app").hidden = false;
const sb = await getClient();
const LABEL = { new: "Nouvelle", read: "Lue", replied: "Répondue", archived: "Archivée" };
let rows = [];

let timer;
function notify(type, text) {
  $("admin-status").replaceChildren(el("p", { class: `alert alert--${type}`, text }));
  clearTimeout(timer);
  if (type === "ok") timer = setTimeout(() => $("admin-status").replaceChildren(), 4000);
}

async function load() {
  const list = $("req-list");
  list.replaceChildren(stateLoading("Chargement…"));
  const { data, error } = await sb.from("contact_requests").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); list.replaceChildren(stateError("Impossible de charger les demandes : " + error.message)); return; }
  rows = data;
  render();
}

async function setStatus(r, status) {
  const { error } = await sb.from("contact_requests").update({ status }).eq("id", r.id);
  if (error) return notify("err", "Échec : " + error.message);
  await load();
}

async function remove(r) {
  if (!window.confirm(`Supprimer définitivement la demande de ${r.name} ? (Vous pouvez aussi l'archiver.)`)) return;
  const { error } = await sb.from("contact_requests").delete().eq("id", r.id);
  if (error) return notify("err", "Suppression impossible : " + error.message);
  notify("ok", "Demande supprimée.");
  await load();
}

function render() {
  const f = $("r-filter").value;
  const list = $("req-list");
  const shown = rows.filter((r) => f === "all" || r.status === f);
  list.replaceChildren();
  if (!shown.length) { list.append(stateEmpty("Aucune demande", "Rien à afficher pour ce filtre.")); return; }
  shown.forEach((r) => {
    const btn = (text, cls, fn) => { const b = el("button", { class: `btn btn--small ${cls}`, type: "button", text }); b.addEventListener("click", fn); return b; };
    const subject = encodeURIComponent("Re : votre demande de concert");
    const meta = [r.organization, r.city, r.event_date && `date souhaitée : ${formatDate(r.event_date)}`].filter(Boolean).join(" · ");
    list.append(el("article", { class: `admin-item${r.status === "new" ? " admin-item--published" : ""}` },
      el("div", {}, el("span", { class: `badge${r.status === "new" ? " badge--accent" : ""}`, text: LABEL[r.status] || r.status }), el("span", { class: "badge", text: ` ${formatDate(r.created_at)} ${formatTime(r.created_at)}` })),
      el("h2", { text: r.name }),
      el("p", { class: "admin-item__meta", text: r.email }),
      meta && el("p", { class: "admin-item__meta", text: meta }),
      el("p", { class: "req-msg", text: r.message }),
      el("div", { class: "admin-item__actions" },
        el("a", { class: "btn btn--small btn--primary", href: `mailto:${r.email}?subject=${subject}`, text: "Répondre par e-mail" }),
        r.status !== "replied" && btn("Marquer répondue", "btn--ghost", () => setStatus(r, "replied")),
        r.status === "new" && btn("Marquer lue", "btn--ghost", () => setStatus(r, "read")),
        r.status !== "archived" ? btn("Archiver", "btn--ghost", () => setStatus(r, "archived")) : btn("Remettre en nouvelle", "btn--ghost", () => setStatus(r, "new")),
        btn("Supprimer", "btn--danger", () => remove(r)))));
  });
}

$("r-filter").addEventListener("change", render);
await load();
