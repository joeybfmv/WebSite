// js/concerts.js — page concerts
import { fetchUpcomingConcerts } from "./api.js";
import { renderConcertCard } from "./concert-card.js";
import { el, stateEmpty, stateError, stateLoading } from "./utils.js";

const box = document.getElementById("concerts-list");
box.replaceChildren(stateLoading("Chargement des concerts…"));

try {
  const { data, demo } = await fetchUpcomingConcerts();
  box.replaceChildren();
  if (demo) box.append(el("p", { class: "demo-banner", text: "Mode démo : données fictives (Supabase non configuré)." }));
  if (!data.length) {
    box.append(stateEmpty("Prochaines dates à venir", "Aucun concert n'est annoncé pour le moment. Les prochaines dates seront annoncées prochainement."));
  } else {
    data.forEach((c) => box.append(renderConcertCard(c, { detailed: true })));
  }
  window.__initReveal?.(box);
} catch (err) {
  console.error(err);
  box.replaceChildren(stateError("Impossible de charger les concerts pour le moment. Réessayez plus tard."));
}
