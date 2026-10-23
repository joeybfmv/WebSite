// js/utils.js — fonctions utilitaires partagées
import { CONFIG } from "./config.js";

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Retourne l'URL si elle est http(s) valide, sinon "". Bloque javascript:, data:, etc. */
export function safeUrl(value) {
  if (!value || typeof value !== "string") return "";
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch { return ""; }
}

export function formatDate(iso) {
  return new Intl.DateTimeFormat(CONFIG.locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: CONFIG.timeZone }).format(new Date(iso));
}
export function formatDay(iso) {
  return new Intl.DateTimeFormat(CONFIG.locale, { day: "2-digit", timeZone: CONFIG.timeZone }).format(new Date(iso));
}
export function formatMonth(iso) {
  return new Intl.DateTimeFormat(CONFIG.locale, { month: "short", timeZone: CONFIG.timeZone }).format(new Date(iso)).replace(".", "");
}
export function formatTime(iso) {
  return new Intl.DateTimeFormat(CONFIG.locale, { hour: "2-digit", minute: "2-digit", timeZone: CONFIG.timeZone }).format(new Date(iso)).replace(":", "h");
}
export function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "";
  const m = Math.floor(seconds / 60), s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/** Lien Google Maps : coordonnées si disponibles, sinon adresse textuelle. */
export function mapsUrl(c) {
  const hasCoords = c.latitude != null && c.longitude != null && c.latitude !== "" && c.longitude !== "";
  const q = hasCoords ? `${c.latitude},${c.longitude}` : [c.venue_name, c.address, c.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false && c !== true) node.append(c.nodeType ? c : document.createTextNode(c));
  return node;
}

export const stateLoading = (msg = "Chargement…") =>
  el("div", { class: "state", role: "status" }, el("div", { class: "spinner", "aria-hidden": "true" }), el("p", { text: msg }));
export const stateEmpty = (title, msg) =>
  el("div", { class: "state" }, el("h3", { text: title }), el("p", { text: msg }));
export const stateError = (msg) =>
  el("div", { class: "state state--error", role: "alert" }, el("h3", { text: "Oups…" }), el("p", { text: msg }));

/** Texte du tarif : « Gratuit », « Entrée payante », « 10,00 € » ou chaîne vide si non précisé. */
export function formatPrice(c) {
  if (c.price_type === "free") return "Gratuit";
  if (c.price_type === "paid") return "Entrée payante";
  if (c.price_type === "amount" && c.price_amount !== null && c.price_amount !== undefined && c.price_amount !== "" && Number.isFinite(Number(c.price_amount))) {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(c.price_amount));
  }
  return "";
}
