// js/setlist.js — page setlist (filtre par album + recherche)
import { fetchSetlist } from "./api.js";
import { el, formatDuration, stateEmpty, stateError, stateLoading } from "./utils.js";

const list = document.getElementById("setlist");
const filters = document.getElementById("album-filters");
const search = document.getElementById("setlist-search");
const count = document.getElementById("setlist-count");

let songs = [];
let album = "";

function render() {
  const q = search.value.trim().toLowerCase();
  const rows = songs.filter((s) => (!album || s.album === album) && (!q || `${s.title} ${s.album || ""}`.toLowerCase().includes(q)));
  list.replaceChildren();
  if (!rows.length) {
    list.append(stateEmpty("Aucun morceau", "Aucun titre ne correspond à votre recherche."));
    count.textContent = "Aucun résultat";
    return;
  }
  rows.forEach((s, i) => {
    list.append(el("li", { class: "setlist__item" },
      el("span", { class: "setlist__pos", "aria-hidden": "true", text: String(s.position ?? i + 1).padStart(2, "0") }),
      el("div", {}, el("div", { class: "setlist__title", text: s.title }), s.album && el("div", { class: "setlist__album", text: s.album })),
      s.duration_seconds ? el("span", { class: "setlist__dur", text: formatDuration(s.duration_seconds) }) : null
    ));
  });
  count.textContent = `${rows.length} morceau${rows.length > 1 ? "x" : ""}`;
}

function renderFilters() {
  const albums = [...new Set(songs.map((s) => s.album).filter(Boolean))];
  filters.replaceChildren();
  if (albums.length < 2) return;
  [["", "Tous"], ...albums.map((a) => [a, a])].forEach(([value, label]) => {
    const b = el("button", { type: "button", class: "chip", "aria-pressed": String(value === album), text: label });
    b.addEventListener("click", () => {
      album = value;
      filters.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      render();
    });
    filters.append(b);
  });
}

list.replaceChildren(stateLoading("Chargement de la setlist…"));
try {
  const { data, demo } = await fetchSetlist();
  songs = data;
  if (demo) list.before(el("p", { class: "demo-banner", text: "Mode démo : titres d'exemple (Supabase non configuré)." }));
  if (!songs.length) list.replaceChildren(stateEmpty("Setlist à venir", "La setlist sera publiée prochainement."));
  else { renderFilters(); render(); }
  search.addEventListener("input", render);
} catch (err) {
  console.error(err);
  list.replaceChildren(stateError("Impossible de charger la setlist pour le moment."));
}
