// js/concert-card.js — rendu d'une carte de concert (accueil + page concerts)
import { el, formatDate, formatDay, formatMonth, formatTime, formatPrice, mapsUrl, safeUrl } from "./utils.js";

export function renderConcertCard(c, { detailed = false, preview = false } = {}) {
  // blob: n'est accepté que dans l'aperçu de l'administration (image locale non encore téléversée)
  const poster = preview && typeof c.poster_url === "string" && c.poster_url.startsWith("blob:") ? c.poster_url : safeUrl(c.poster_url);
  const booking = safeUrl(c.reservation_url);

  const date = el("div", { class: "concert__date", "aria-hidden": "true" },
    el("span", { class: "concert__day", text: formatDay(c.event_date) }),
    el("span", { class: "concert__month", text: formatMonth(c.event_date) })
  );

  const actions = el("div", { class: "btn-row" },
    el("a", { class: "btn btn--ghost btn--small", href: mapsUrl(c), target: "_blank", rel: "noopener noreferrer", "aria-label": `Voir ${c.venue_name || c.title} sur Google Maps (nouvel onglet)`, text: "Voir sur Google Maps" }),
    booking && el("a", { class: "btn btn--primary btn--small", href: booking, target: "_blank", rel: "noopener noreferrer", "aria-label": `Réserver pour ${c.title} (nouvel onglet)`, text: "Réserver" })
  );

  const body = el("div", { class: "card__body concert__body" },
    el("time", { class: "concert__when", datetime: c.event_date, text: `${formatDate(c.event_date)} · ${formatTime(c.event_date)}` }),
    el("h3", { class: "concert__title", text: c.title }),
    formatPrice(c) && el("p", { class: "concert__price", text: formatPrice(c) }),
    el("p", { class: "concert__place", text: [c.venue_name, c.city].filter(Boolean).join(" — ") }),
    detailed && c.address && el("p", { class: "concert__address", text: c.address }),
    detailed && c.description && el("p", { class: "concert__desc", text: c.description }),
    detailed && !booking && el("p", { class: "concert__nobooking", text: "Réservation non disponible ou non nécessaire pour cette date." }),
    actions
  );

  const media = poster
    ? el("div", { class: "concert__poster" }, el("img", { src: poster, alt: `Affiche : ${c.title}`, loading: "lazy", decoding: "async" }))
    : null;

  return el("article", { class: `card concert reveal${media ? " concert--with-poster" : ""}` }, date, media, body);
}
