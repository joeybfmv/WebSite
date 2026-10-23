// js/materiel.js — matériel (Supabase) + Wayward Ship (content.js)
import { CONTENT } from "./content.js";
import { CONFIG, isFilled } from "./config.js";
import { fetchGear } from "./api.js";
import { el, safeUrl, stateEmpty, stateError, stateLoading } from "./utils.js";

const ORNAMENT = '<svg class="ornament" viewBox="0 0 180 18" aria-hidden="true"><path d="M0 9h70M110 9h70" stroke="currentColor" stroke-width="1.5"/><path d="M90 1l8 8-8 8-8-8z" fill="currentColor"/></svg>';

/* ---------- Matériel ---------- */
const gearBox = document.getElementById("gear");
gearBox.replaceChildren(stateLoading("Chargement du matériel…"));

function gearCard(g) {
  const key = `${g.name} ${g.model || ""}`.toLowerCase();
  const local = (CONTENT.gearImages.find(([k]) => key.includes(k)) || [])[1];
  const img = safeUrl(g.image_url) || local || "assets/images/guitars/placeholder.svg";
  const meta = [g.brand, g.model].filter((v) => isFilled(v)).join(" · ");
  return el("article", { class: "card gear-card reveal" },
    el("div", { class: "card__media" }, el("img", { src: img, alt: g.name, loading: "lazy", decoding: "async", width: "800", height: "600" })),
    el("div", { class: "card__body" },
      el("h4", { text: g.name }),
      meta && el("p", { class: "gear-meta", text: meta }),
      g.description && el("p", { text: g.description })
    )
  );
}

try {
  const { data, demo } = await fetchGear();
  gearBox.replaceChildren();
  if (demo) gearBox.append(el("p", { class: "demo-banner", text: "Mode démo : matériel d'exemple à compléter (Supabase non configuré)." }));
  if (!data.length) {
    gearBox.append(stateEmpty("Matériel à venir", "La présentation du matériel sera publiée prochainement."));
  } else {
    const groups = new Map();
    data.forEach((g) => { const k = g.category || "Autre"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(g); });
    groups.forEach((items, cat) => {
      const grid = el("div", { class: "grid grid--3" }, items.map(gearCard));
      gearBox.append(el("div", { class: "gear-group" }, el("h3", { text: cat }), grid));
    });
  }
  window.__initReveal?.(gearBox);
} catch (err) {
  console.error(err);
  gearBox.replaceChildren(stateError("Impossible de charger le matériel pour le moment."));
}

/* ---------- Wayward Ship ---------- */
const ws = CONTENT.waywardShip;
const text = document.getElementById("ws-text");
text.append(el("p", { class: "eyebrow", text: "Mon groupe" }), el("h2", { id: "ws-title", text: ws.title }));
text.insertAdjacentHTML("beforeend", ORNAMENT);
text.append(el("p", { class: "mt-4", text: ws.bio }));
if (ws.placeholder) text.append(el("p", { class: "placeholder-note", text: "Présentation à compléter (biographie, membres, liens)." }));
if (ws.members.length) text.append(el("ul", { class: "members", "aria-label": "Membres" }, ws.members.map((m) => el("li", { text: `${m.name} — ${m.role}` }))));

const LABELS = { website: "Site web", instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", spotify: "Spotify" };
const links = Object.entries(CONFIG.officialLinks.waywardShip).map(([k, u]) => [k, safeUrl(u)]).filter(([, u]) => u);
if (links.length) {
  text.append(el("div", { class: "btn-row mt-6" }, links.map(([k, u]) => el("a", { class: "btn btn--small", href: u, target: "_blank", rel: "noopener noreferrer", text: `Wayward Ship sur ${LABELS[k]}` }))));
} else {
  text.append(el("p", { class: "mt-4", text: "Les liens du groupe (réseaux sociaux, musique) seront ajoutés prochainement." }));
}
document.getElementById("ws-photo").replaceChildren(el("img", { src: ws.photo, alt: ws.photoAlt, loading: "lazy", decoding: "async", width: "800", height: "600" }));
window.__initReveal?.();
