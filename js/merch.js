// js/merch.js — boutique merch (masquée au public tant que CONFIG.features.merch est à false)
import { CONFIG } from "./config.js";
import { getClient } from "./api.js";
import { el, safeUrl, stateEmpty, stateError, stateLoading } from "./utils.js";

const root = document.getElementById("merch-root");
const cartBox = document.getElementById("merch-cart");
const bar = document.getElementById("merch-bar");
const toggle = document.getElementById("cart-toggle");
const eur = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n));
const KEY = "joey_merch_cart";
let sb = null;
let products = [];
let cart = readCart();

function readCart() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((i) => i && typeof i.id === "string" && Number.isInteger(i.qty) && i.qty > 0) : [];
  } catch { return []; }
}
function writeCart() { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch { /* stockage indisponible */ } }
const hasStock = (p) => Number.isInteger(p.stock);

function addToCart(p) {
  const line = cart.find((i) => i.id === p.id);
  const next = (line ? line.qty : 0) + 1;
  if (hasStock(p) && next > p.stock) return;
  if (next > 20) return;
  if (line) line.qty = next; else cart.push({ id: p.id, qty: 1 });
  writeCart(); renderCart(); cartBox.hidden = false;
  cartBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function setQty(id, qty) {
  const p = products.find((x) => x.id === id);
  if (qty < 1) cart = cart.filter((i) => i.id !== id);
  else { const line = cart.find((i) => i.id === id); if (line && !(p && hasStock(p) && qty > p.stock) && qty <= 20) line.qty = qty; }
  writeCart(); renderCart();
}

function card(p) {
  const imgs = (p.images || []).map((u) => safeUrl(u)).filter(Boolean);
  const main = el("img", { class: "merch-card__img", alt: p.name, loading: "lazy", decoding: "async", width: "600", height: "600" });
  main.src = imgs[0] || "assets/images/guitars/placeholder.svg";
  const thumbs = imgs.length > 1 ? el("div", { class: "merch-card__thumbs" }, imgs.map((u, i) => {
    const b = el("button", { class: "merch-thumb", type: "button", "aria-label": `Photo ${i + 1} de ${p.name}` }, el("img", { src: u, alt: "", loading: "lazy", width: "48", height: "48" }));
    b.addEventListener("click", () => { main.src = u; });
    return b;
  })) : null;
  const soldOut = hasStock(p) && p.stock === 0;
  const low = hasStock(p) && p.stock > 0 && p.stock <= 5;
  let action;
  if (soldOut) action = el("p", { class: "merch-card__note", text: "Épuisé" });
  else if (p.sale_mode === "external" && safeUrl(p.external_url)) action = el("a", { class: "btn btn--primary", href: safeUrl(p.external_url), target: "_blank", rel: "noopener noreferrer", text: "Acheter en ligne" });
  else if (p.sale_mode === "cart") { action = el("button", { class: "btn btn--primary", type: "button", text: "Ajouter au panier" }); action.addEventListener("click", () => addToCart(p)); }
  else action = el("p", { class: "merch-card__note", text: "À acheter sur place, au stand merch lors des concerts." });
  return el("article", { class: "card merch-card" }, main, thumbs,
    el("div", { class: "card__body" },
      el("h2", { class: "h-small", text: p.name }),
      el("p", { class: "merch-card__price", text: eur(p.price) }),
      soldOut ? el("span", { class: "merch-badge", text: "Épuisé" }) : null,
      low ? el("span", { class: "merch-badge", text: `Plus que ${p.stock}` }) : null,
      p.description ? el("p", { text: p.description }) : null,
      action));
}

function renderCart() {
  const count = cart.reduce((n, i) => n + i.qty, 0);
  toggle.textContent = `Panier (${count})`;
  cartBox.replaceChildren();
  if (!cart.length) { cartBox.append(el("h2", { class: "h-small", text: "Mon panier" }), el("p", { text: "Votre panier est vide." })); return; }
  cartBox.append(el("h2", { class: "h-small", text: "Mon panier" }));
  let total = 0;
  for (const item of cart) {
    const p = products.find((x) => x.id === item.id); if (!p) continue;
    total += Number(p.price) * item.qty;
    const btn = (text, label, fn) => { const b = el("button", { class: "btn btn--small btn--ghost", type: "button", "aria-label": label, text }); b.addEventListener("click", fn); return b; };
    cartBox.append(el("div", { class: "cart-line" },
      el("span", { text: `${p.name} — ${eur(p.price)}` }),
      el("span", { class: "cart-line__qty" }, btn("−", `Retirer un ${p.name}`, () => setQty(p.id, item.qty - 1)), el("strong", { text: String(item.qty) }), btn("+", `Ajouter un ${p.name}`, () => setQty(p.id, item.qty + 1)), btn("✕", `Supprimer ${p.name}`, () => setQty(p.id, 0)))));
  }
  cartBox.append(el("p", { class: "cart-total", text: `Total : ${eur(total)}` }));
  cartBox.append(orderForm());
}

function orderForm() {
  const f = (id, label, attrs) => el("div", { class: "field" }, el("label", { for: id, text: label }), el("input", { id, name: id, ...attrs }));
  const msg = el("textarea", { id: "o-message", name: "message", rows: "3", maxlength: "1000" });
  const hp = el("input", { type: "text", name: "website", tabindex: "-1", autocomplete: "off" });
  const status = el("p", { role: "status", "aria-live": "polite" });
  const submit = el("button", { class: "btn btn--primary", type: "submit", text: "Envoyer ma demande de commande" });
  const form = el("form", { novalidate: "" },
    el("p", { text: "Aucun paiement en ligne : votre demande est une réservation. Je vous recontacte pour la remise (par exemple au prochain concert) et le règlement." }),
    f("o-name", "Nom *", { type: "text", maxlength: "120", autocomplete: "name" }),
    f("o-email", "E-mail *", { type: "email", maxlength: "200", autocomplete: "email" }),
    el("div", { class: "field" }, el("label", { for: "o-message", text: "Message (facultatif)" }), msg),
    el("div", { class: "hp-field", "aria-hidden": "true" }, hp), submit, status);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.elements["o-name"].value.trim(), email = form.elements["o-email"].value.trim();
    if (hp.value) { status.textContent = "Merci !"; return; }
    if (name.length < 2) { status.textContent = "Indiquez votre nom."; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { status.textContent = "Indiquez une adresse e-mail valide."; return; }
    submit.disabled = true; status.textContent = "Envoi…";
    const { error } = await sb.from("merch_orders").insert({ name, email, message: msg.value.trim() || null, items: cart.map(({ id, qty }) => ({ id, qty })) });
    submit.disabled = false;
    if (error) { status.textContent = error.message || "Envoi impossible, réessayez plus tard."; return; }
    cart = []; writeCart();
    cartBox.replaceChildren(el("h2", { class: "h-small", text: "Merci !" }), el("p", { text: "Votre demande est bien enregistrée. Je vous recontacte très vite par e-mail." }));
    toggle.textContent = "Panier (0)";
  });
  return form;
}

async function main() {
  if (!CONFIG.features?.merch) { root.replaceChildren(stateEmpty("Bientôt disponible", "La boutique merch ouvrira prochainement.")); return; }
  root.replaceChildren(stateLoading("Chargement…"));
  try {
    sb = await getClient();
    if (!sb) { root.replaceChildren(stateEmpty("Boutique indisponible", "Le site n'est pas encore relié à sa base de données.")); return; }
    const { data, error } = await sb.from("merch_products").select("*").eq("is_published", true).order("position", { ascending: true, nullsFirst: false });
    if (error) throw error;
    products = data;
  } catch (err) { console.error(err); root.replaceChildren(stateError("Impossible de charger la boutique pour le moment.")); return; }
  if (!products.length) { root.replaceChildren(stateEmpty("Rien en vente pour l'instant", "Les premiers produits arrivent bientôt.")); return; }
  root.replaceChildren(el("div", { class: "merch-grid" }, products.map(card)));
  cart = cart.filter((i) => products.some((p) => p.id === i.id && p.sale_mode === "cart"));
  if (products.some((p) => p.sale_mode === "cart")) {
    bar.hidden = false;
    toggle.addEventListener("click", () => { cartBox.hidden = !cartBox.hidden; });
    renderCart();
  }
}
main();
