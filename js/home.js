// js/home.js — page d'accueil
import { CONTENT } from "./content.js";
import { fetchUpcomingConcerts, fetchSetlist } from "./api.js";
import { renderConcertCard } from "./concert-card.js";
import { CONFIG } from "./config.js";
import { el, safeUrl, stateEmpty, stateError, stateLoading } from "./utils.js";

const ORNAMENT = '<svg class="ornament" viewBox="0 0 180 18" aria-hidden="true"><path d="M0 9h70M110 9h70" stroke="currentColor" stroke-width="1.5"/><path d="M90 1l8 8-8 8-8-8z" fill="currentColor"/></svg>';

function renderTextBlock(target, { id, title, eyebrow, paragraphs, placeholder, extra }) {
  target.replaceChildren();
  if (eyebrow) target.append(el("p", { class: "eyebrow", text: eyebrow }));
  target.append(el("h2", { id, text: title }));
  target.insertAdjacentHTML("beforeend", ORNAMENT);
  const wrap = el("div", { class: "mt-4" });
  paragraphs.forEach((p) => wrap.append(el("p", { text: p })));
  target.append(wrap);
  if (placeholder) target.append(el("p", { class: "placeholder-note", text: "Ce texte sera remplacé par le texte définitif." }));
  if (extra) target.append(extra);
}

function renderPhoto(target, src, alt) {
  target.replaceChildren(el("img", { src, alt, loading: "lazy", decoding: "async", width: "800", height: "600" }));
}

function renderStatic() {
  const { about, bfmv, waywardShip, gearTeaser } = CONTENT;
  renderTextBlock(document.getElementById("about-text"), { id: "about-title", eyebrow: "Le guitariste", title: about.title, paragraphs: about.paragraphs, placeholder: about.placeholder });
  renderPhoto(document.getElementById("about-photo"), about.photo, about.photoAlt);

  const official = safeUrl(CONFIG.officialLinks.bfmvWebsite);
  const link = official ? el("p", { class: "mt-4" }, el("a", { class: "btn btn--ghost btn--small", href: official, target: "_blank", rel: "noopener noreferrer", text: "Site officiel du groupe" })) : null;
  renderTextBlock(document.getElementById("bfmv-text"), { id: "bfmv-title", eyebrow: "L'original", title: bfmv.title, paragraphs: bfmv.paragraphs, extra: link });
  renderPhoto(document.getElementById("bfmv-photo"), bfmv.photo, bfmv.photoAlt);

  document.getElementById("gear-teaser").textContent = gearTeaser;
  document.getElementById("ws-teaser").textContent = waywardShip.teaser;
}

async function renderConcerts() {
  const box = document.getElementById("home-concerts");
  box.replaceChildren(stateLoading("Chargement des concerts…"));
  try {
    const { data, demo } = await fetchUpcomingConcerts(2);
    box.replaceChildren();
    if (demo) box.before(el("p", { class: "demo-banner", text: "Mode démo : données fictives (Supabase non configuré)." }));
    if (!data.length) { box.append(stateEmpty("Prochaines dates à venir", "Aucun concert n'est annoncé pour le moment. Les prochaines dates seront annoncées prochainement.")); return; }
    data.forEach((c) => box.append(renderConcertCard(c)));
    window.__initReveal?.(box);
  } catch (err) {
    console.error(err);
    box.replaceChildren(stateError("Impossible de charger les concerts pour le moment. Réessayez plus tard."));
  }
}

async function renderSetlist() {
  const list = document.getElementById("home-setlist");
  try {
    const { data } = await fetchSetlist();
    list.replaceChildren();
    if (!data.length) { list.append(el("li", { text: "La setlist sera publiée prochainement." })); return; }
    data.slice(0, 6).forEach((s) => list.append(el("li", {}, el("span", { class: "t", text: s.title }), s.album && el("span", { class: "a", text: s.album }))));
  } catch (err) {
    console.error(err);
    list.replaceChildren(el("li", { text: "Setlist indisponible pour le moment." }));
  }
}

renderStatic();
window.__initReveal?.();
renderConcerts();
renderSetlist();
