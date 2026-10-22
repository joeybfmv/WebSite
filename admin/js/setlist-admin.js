// admin/js/setlist-admin.js — gestion de la setlist (droits imposés par Supabase RLS)
import { requireAdmin, mountAdminBar } from "./auth.js";
import { getClient } from "../../js/api.js";
import { el, stateEmpty, stateError, stateLoading } from "../../js/utils.js";

document.documentElement.classList.remove("no-js");
const $ = (id) => document.getElementById(id);
const user = await requireAdmin();
if (!user) throw new Error("Non autorisé");
mountAdminBar($("admin-bar"), user, "setlist.html");
$("app").hidden = false;
const sb = await getClient();
const form = $("song-form");
let songs = [];
let editing = null;

let timer;
function notify(type, text) {
  $("admin-status").replaceChildren(el("p", { class: `alert alert--${type}`, text }));
  clearTimeout(timer);
  if (type === "ok") timer = setTimeout(() => $("admin-status").replaceChildren(), 4000);
}

async function load() {
  const list = $("song-list");
  list.replaceChildren(stateLoading("Chargement…"));
  const { data, error } = await sb.from("setlist").select("*").order("position", { ascending: true, nullsFirst: false });
  if (error) { console.error(error); list.replaceChildren(stateError("Impossible de charger la setlist : " + error.message)); return; }
  songs = data;
  render();
}

function render() {
  const list = $("song-list");
  list.replaceChildren();
  if (!songs.length) { list.append(stateEmpty("Setlist vide", "Ajoutez votre premier morceau avec le formulaire ci-dessus.")); return; }
  songs.forEach((s, i) => {
    const btn = (text, cls, fn, disabled = false) => { const b = el("button", { class: `btn btn--small ${cls}`, type: "button", text }); b.disabled = disabled; b.addEventListener("click", fn); return b; };
    list.append(el("article", { class: `admin-item${s.is_published ? " admin-item--published" : ""}` },
      el("div", {}, el("span", { class: `badge${s.is_published ? " badge--accent" : ""}`, text: `${i + 1} · ${s.is_published ? "Visible" : "Masqué"}` })),
      el("h2", { text: s.title }),
      s.album && el("p", { class: "admin-item__meta", text: s.album }),
      el("div", { class: "admin-item__actions" },
        btn("↑", "btn--ghost", () => move(i, -1), i === 0),
        btn("↓", "btn--ghost", () => move(i, 1), i === songs.length - 1),
        btn("Modifier", "", () => startEdit(s)),
        btn(s.is_published ? "Masquer" : "Afficher", "btn--ghost", () => update(s, { is_published: !s.is_published })),
        btn("Supprimer", "btn--danger", () => remove(s)))));
  });
}

async function update(s, patch) {
  const { error } = await sb.from("setlist").update(patch).eq("id", s.id);
  if (error) return notify("err", "Échec : " + error.message);
  await load();
}

async function move(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= songs.length) return;
  const arr = [...songs];
  [arr[i], arr[j]] = [arr[j], arr[i]];
  const changes = arr.map((s, k) => ({ s, pos: k + 1 })).filter(({ s, pos }) => s.position !== pos);
  const res = await Promise.all(changes.map(({ s, pos }) => sb.from("setlist").update({ position: pos }).eq("id", s.id)));
  const bad = res.find((r) => r.error);
  if (bad) notify("err", "Réordonnancement impossible : " + bad.error.message);
  await load();
}

async function remove(s) {
  if (!window.confirm(`Supprimer « ${s.title} » ? (Vous pouvez aussi simplement le masquer.)`)) return;
  const { error } = await sb.from("setlist").delete().eq("id", s.id);
  if (error) return notify("err", "Suppression impossible : " + error.message);
  notify("ok", "Morceau supprimé.");
  await load();
}

function startEdit(s) {
  editing = s;
  form.elements.title.value = s.title; form.elements.album.value = s.album || ""; form.elements.is_published.checked = !!s.is_published;
  $("song-legend").textContent = "Modifier le morceau"; $("s-save").textContent = "Enregistrer"; $("s-cancel").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" }); form.elements.title.focus();
}
function resetForm() {
  editing = null; form.reset(); form.elements.is_published.checked = true;
  $("song-legend").textContent = "Ajouter un morceau"; $("s-save").textContent = "Ajouter"; $("s-cancel").hidden = true;
}
$("s-cancel").addEventListener("click", resetForm);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = form.elements.title.value.trim();
  if (title.length < 1) return notify("err", "Le titre est obligatoire.");
  const row = { title, album: form.elements.album.value.trim() || null, is_published: form.elements.is_published.checked };
  const btn = $("s-save"); btn.disabled = true;
  const { error } = editing
    ? await sb.from("setlist").update(row).eq("id", editing.id)
    : await sb.from("setlist").insert({ ...row, position: songs.reduce((m, s) => Math.max(m, s.position || 0), 0) + 1 });
  btn.disabled = false;
  if (error) return notify("err", "Enregistrement impossible : " + error.message);
  notify("ok", editing ? "Morceau modifié." : "Morceau ajouté.");
  resetForm(); await load();
});

await load();
