// admin/js/team-admin.js — fichiers privés et accès de l'équipe technique
import { requireAdmin, mountAdminBar } from "./auth.js";
import { getClient } from "../../js/api.js";
import { el, formatDate, stateEmpty, stateError, stateLoading } from "../../js/utils.js";

document.documentElement.classList.remove("no-js");
const $ = (id) => document.getElementById(id);
const user = await requireAdmin();
if (!user) throw new Error("Non autorisé");
mountAdminBar($("admin-bar"), user, "team.html");
$("app").hidden = false;
const sb = await getClient();
const BUCKET = "team-files", MAX = 50 * 1024 * 1024;
const OK = [/\.png$/i, /\.jpe?g$/i, /\.pdf$/i, /\.zip$/i];
const size = (n) => (!Number.isFinite(n) ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);
let timer;
function notify(type, text) {
  $("admin-status").replaceChildren(el("p", { class: `alert alert--${type}`, text }));
  clearTimeout(timer); if (type === "ok") timer = setTimeout(() => $("admin-status").replaceChildren(), 4000);
}
const btn = (text, cls, fn) => { const b = el("button", { class: `btn btn--small ${cls}`, type: "button", text }); b.addEventListener("click", fn); return b; };

async function loadFiles() {
  const list = $("t-list"); list.replaceChildren(stateLoading("Chargement…"));
  const { data, error } = await sb.storage.from(BUCKET).list("", { limit: 200, sortBy: { column: "name", order: "asc" } });
  if (error) { list.replaceChildren(stateError("Impossible de charger les fichiers : " + error.message + " (migration-team.sql exécutée ?)")); return; }
  const files = (data || []).filter((f) => f.id && !f.name.startsWith("."));
  list.replaceChildren();
  if (!files.length) { list.append(stateEmpty("Aucun fichier", "Ajoute le ZIP des fiches avec le champ ci-dessus.")); return; }
  for (const f of files) {
    list.append(el("article", { class: "admin-item" }, el("h2", { text: f.name }), el("p", { class: "admin-item__meta", text: size(f.metadata?.size) }),
      el("div", { class: "admin-item__actions" },
        btn("Supprimer", "btn--danger", async () => {
          if (!window.confirm(`Supprimer « ${f.name} » ?`)) return;
          const { error: e } = await sb.storage.from(BUCKET).remove([f.name]);
          if (e) return notify("err", "Suppression impossible : " + e.message);
          notify("ok", "Fichier supprimé."); await loadFiles();
        }))));
  }
}
$("t-files").addEventListener("change", async (e) => {
  for (const file of e.target.files) {
    const ext = (file.name.match(/\.[^.]+$/) || [""])[0].toLowerCase();
    const name = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!OK.some((r) => r.test(file.name)) || file.size > MAX || !name || name.startsWith(".")) { notify("err", `« ${file.name} » refusé (format non pris en charge ou plus de 50 Mo).`); continue; }
    const type = ext === ".zip" ? "application/zip" : ext === ".pdf" ? "application/pdf" : ext === ".png" ? "image/png" : "image/jpeg";
    const { error } = await sb.storage.from(BUCKET).upload(name, file, { upsert: true, contentType: type, cacheControl: "60" });
    notify(error ? "err" : "ok", error ? `Envoi de « ${name} » impossible : ${error.message}` : `« ${name} » envoyé.`);
  }
  e.target.value = ""; await loadFiles();
});

async function loadMembers() {
  const list = $("t-members"); list.replaceChildren(stateLoading("Chargement…"));
  const { data, error } = await sb.from("team_members").select("*").order("created_at", { ascending: false });
  if (error) { list.replaceChildren(stateError("Impossible de charger les membres : " + error.message)); return; }
  list.replaceChildren();
  if (!data.length) { list.append(stateEmpty("Aucun membre", "Ajoute l'e-mail d'un technicien ci-dessus.")); return; }
  for (const m of data) {
    list.append(el("article", { class: "admin-item" }, el("h2", { text: m.email }), el("p", { class: "admin-item__meta", text: `Accès depuis le ${formatDate(m.created_at)}` }),
      el("div", { class: "admin-item__actions" }, btn("Retirer l'accès", "btn--danger", async () => {
        if (!window.confirm(`Retirer l'accès de ${m.email} ?`)) return;
        const { error: e } = await sb.rpc("team_remove_member", { p_user: m.user_id });
        if (e) return notify("err", e.message); notify("ok", "Accès retiré."); await loadMembers();
      }))));
  }
}
$("t-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("t-email").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return notify("err", "Adresse e-mail invalide.");
  const { error } = await sb.rpc("team_add_member", { p_email: email });
  if (error) return notify("err", error.message);
  $("t-email").value = ""; notify("ok", "Accès accordé."); await loadMembers();
});
await Promise.all([loadFiles(), loadMembers()]);
