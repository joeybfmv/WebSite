// js/main.js — initialisation commune à toutes les pages publiques
import { mountNavigation } from "./navigation.js";
import { mountFooter } from "./footer.js";
import { mountEffects } from "./effects.js";

document.documentElement.classList.remove("no-js");

window.addEventListener("error", (e) => console.error("[site] Erreur JS :", e.message));
window.addEventListener("unhandledrejection", (e) => console.error("[site] Promesse rejetée :", e.reason));

mountNavigation(document.getElementById("site-header"));
mountFooter(document.getElementById("site-footer"));

/** Apparition progressive des éléments .reveal (désactivée si l'utilisateur réduit les animations). */
export function initReveal(scope = document) {
  const nodes = scope.querySelectorAll(".reveal:not(.is-visible)");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) { nodes.forEach((n) => n.classList.add("is-visible")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
  }, { threshold: 0.12 });
  nodes.forEach((n) => io.observe(n));
}

initReveal();
window.__initReveal = initReveal; // utilisé par les scripts de page après rendu dynamique

mountEffects();
