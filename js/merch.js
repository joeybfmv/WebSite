// js/merch.js — boutique merch (masquée au public tant que CONFIG.features.merch est à false)
import { CONFIG } from "./config.js";
import { getClient } from "./api.js";
import { merchEnabled } from "./settings.js";
import { el, safeUrl, stateEmpty, stateError, stateLoading } from "./utils.js";

const root = document.getElementById("merch-root");
const cartBox = document.getElementById("merch-cart");
const bar = document.getElementById("merch-bar");
const toggle = document.getElementById("cart-toggle");
const eur = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n));
const KEY = "joey_merch_cart";
let sb = null, products = [], cart = readCart();

function readCart() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((i) => i && typeof i.id === "string" && Number.isInteger(i.qty) && i.qty > 0).map((i) => ({ id: i.id, qty: i.qty, variant: typeof i.variant === "string" ? i.variant : "" })) : [];
  } catch { return []; }
}
const writeCart = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch { /* stockage indisponible */ } };
const opts = (p) => (Array.isArray(p.options) ? p.options : []);
const same = (i, id, v) => i.id === id && i.variant === (v || "");

/** Stock disponible pour un produit (et une variante) ; null = non suivi. */
function stockOf(p, variant) {
  if (opts(p).length) { const o = opts(p).find((x) => x.label === variant); return o && Number.isInteger(o.stock) ? o.stock : null; }
  return Number.isInteger(p.stock) ? p.stock : null;
}
function totalStock(p) {
  if (!opts(p).length) return Number.isInteger(p.stock) ? p.stock : null;
  return opts(p).every((o) => Number.isInteger(o.stock)) ? opts(p).reduce((n, o) => n + o.stock, 0) : null;
}
function badgeText(p) {
  const mode = p.badge || "auto", ts = totalStock(p);
  if (mode === "none") return null;
  if (mode === "new") return "Nouveau";
  if (mode === "last") return "Dernières pièces";
  if (ts !== null && ts > 0 && ts <= 5) return "Dernières pièces";
  if (p.created_at && Date.now() - new Date(p.created_at).getTime() < 21 * 864e5) return "Nouveau";
  return null;
}

function addToCart(p, variant) {
  const max = stockOf(p, variant);
  const line = cart.find((i) => same(i, p.id, variant));
  const next = (line ? line.qty : 0) + 1;
  if ((max !== null && next > max) || next > 20) return;
  if (line) line.qty = next; else cart.push({ id: p.id, qty: 1, variant: variant || "" });
  writeCart(); renderCart(); cartBox.hidden = false;
  cartBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function setQty(item, qty) {
  const p = products.find((x) => x.id === item.id), max = p ? stockOf(p, item.variant) : null;
  if (qty < 1) cart = cart.filter((i) => i !== item);
  else if (qty <= 20 && (max === null || qty <= max)) item.qty = qty;
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
  const o = opts(p), ts = totalStock(p);
  const soldOut = o.length ? o.every((x) => Number.isInteger(x.stock) && x.stock === 0) : (Number.isInteger(p.stock) && p.stock === 0);
  let select = null;
  if (o.length && !soldOut) {
    select = el("select", { id: `v-${p.id}`, "aria-label": `Choisir une option pour ${p.name}` }, el("option", { value: "", text: "Choisir une option…" }),
      o.map((x) => { const out = Number.isInteger(x.stock) && x.stock === 0; const op = el("option", { value: x.label, text: x.label + (out ? " (épuisé)" : "") }); op.disabled = out; return op; }));
  }
  const hint = el("p", { class: "merch-card__hint", role: "status" });
  let action;
  if (soldOut) action = el("p", { class: "merch-card__note", text: "Épuisé" });
  else if (p.sale_mode === "external" && safeUrl(p.external_url)) action = el("a", { class: "btn btn--primary", href: safeUrl(p.external_url), target: "_blank", rel: "noopener noreferrer", text: "Acheter en ligne" });
  else if (p.sale_mode === "cart") {
    action = el("button", { class: "btn btn--primary", type: "button", text: "Ajouter au panier" });
    action.addEventListener("click", () => {
      if (select && !select.value) { hint.textContent = "Choisissez d'abord une option."; select.focus(); return; }
      hint.textContent = ""; addToCart(p, select ? select.value : "");
    });
  } else action = el("p", { class: "merch-card__note", text: "À acheter sur place, au stand merch lors des concerts." });
  const badge = badgeText(p);
  return el("article", { class: "card merch-card" }, main, thumbs,
    el("div", { class: "card__body" },
      el("h2", { class: "h-small", text: p.name }),
      el("p", { class: "merch-card__price", text: eur(p.price) }),
      soldOut ? el("span", { class: "merch-badge", text: "Épuisé" }) : (badge ? el("span", { class: "merch-badge", text: badge + (badge === "Dernières pièces" && ts ? ` (${ts})` : "") }) : null),
      p.description ? el("p", { text: p.description }) : null,
      select, hint, action));
}

function renderCart() {
  toggle.textContent = `Panier (${cart.reduce((n, i) => n + i.qty, 0)})`;
  cartBox.replaceChildren(el("h2", { class: "h-small", text: "Mon panier" }));
  if (!cart.length) { cartBox.append(el("p", { text: "Votre panier est vide." })); return; }
  let total = 0;
  for (const item of cart) {
    const p = products.find((x) => x.id === item.id); if (!p) continue;
    total += Number(p.price) * item.qty;
    const label = item.variant ? `${p.name} (${item.variant})` : p.name;
    const btn = (text, aria, fn) => { const b = el("button", { class: "btn btn--small btn--ghost", type: "button", "aria-label": aria, text }); b.addEventListener("click", fn); return b; };
    cartBox.append(el("div", { class: "cart-line" }, el("span", { text: `${label} — ${eur(p.price)}` }),
      el("span", { class: "cart-line__qty" }, btn("−", `Retirer un ${label}`, () => setQty(item, item.qty - 1)), el("strong", { text: String(item.qty) }), btn("+", `Ajouter un ${label}`, () => setQty(item, item.qty + 1)), btn("✕", `Supprimer ${label}`, () => setQty(item, 0)))));
  }
  cartBox.append(el("p", { class: "cart-total", text: `Total : ${eur(total)}` }), orderForm());
}

function orderForm() {
  const online = CONFIG.features?.onlinePayment === true;
  const f = (id, label, attrs) => el("div", { class: "field" }, el("label", { for: id, text: label }), el("input", { id, name: id, ...attrs }));
  const msg = el("textarea", { id: "o-message", name: "message", rows: "3", maxlength: "1000" });
  const hp = el("input", { type: "text", name: "website", tabindex: "-1", autocomplete: "off" });
  const status = el("p", { role: "status", "aria-live": "polite" });
  const method = online ? el("select", { id: "o-method", name: "method" }, el("option", { value: "online", text: "Payer en ligne par carte, maintenant" }), el("option", { value: "reservation", text: "Réserver et payer à la remise (concert)" })) : null;
  const submit = el("button", { class: "btn btn--primary", type: "submit", text: online ? "Valider ma commande" : "Envoyer ma demande de commande" });
  const form = el("form", { novalidate: "" },
    el("p", { text: online ? "Choisissez de payer en ligne (paiement sécurisé par Stripe) ou de réserver et régler à la remise." : "Aucun paiement en ligne : votre demande est une réservation. Je vous recontacte pour la remise (par exemple au prochain concert) et le règlement." }),
    f("o-name", "Nom *", { type: "text", maxlength: "120", autocomplete: "name" }),
    f("o-email", "E-mail *", { type: "email", maxlength: "200", autocomplete: "email" }),
    method ? el("div", { class: "field" }, el("label", { for: "o-method", text: "Paiement" }), method) : null,
    el("div", { class: "field" }, el("label", { for: "o-message", text: "Message (facultatif)" }), msg),
    el("div", { class: "hp-field", "aria-hidden": "true" }, hp), submit, status);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.elements["o-name"].value.trim(), email = form.elements["o-email"].value.trim();
    if (hp.value) { status.textContent = "Merci !"; return; }
    if (name.length < 2) { status.textContent = "Indiquez votre nom."; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { status.textContent = "Indiquez une adresse e-mail valide."; return; }
    const items = cart.map(({ id, qty, variant }) => ({ id, qty, variant: variant || null }));
    submit.disabled = true; status.textContent = "Envoi…";
    try {
      if (method && method.value === "online") {
        const res = await fetch(`${CONFIG.supabase.url}/functions/v1/merch-checkout`, { method: "POST", headers: { "Content-Type": "application/json", apikey: CONFIG.supabase.anonKey }, body: JSON.stringify({ name, email, message: msg.value.trim() || null, items }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || typeof data.url !== "string" || !data.url.startsWith("https://checkout.stripe.com/")) throw new Error(data.error || "Paiement indisponible, réessayez plus tard.");
        window.location.href = data.url; return;
      }
      const { error } = await sb.from("merch_orders").insert({ name, email, message: msg.value.trim() || null, items });
      if (error) throw new Error(error.message || "Envoi impossible, réessayez plus tard.");
      cart = []; writeCart();
      cartBox.replaceChildren(el("h2", { class: "h-small", text: "Merci !" }), el("p", { text: "Votre demande est bien enregistrée. Un e-mail de confirmation vous est envoyé, et je vous recontacte très vite." }));
      toggle.textContent = "Panier (0)";
    } catch (err) { status.textContent = err.message; }
    submit.disabled = false;
  });
  return form;
}

function notice() {
  const q = new URLSearchParams(window.location.search);
  if (q.get("paid") === "1") { cart = []; writeCart(); root.before(el("p", { class: "alert alert--ok", role: "status", text: "Merci ! Votre paiement est bien reçu. Un e-mail de confirmation vous est envoyé." })); }
  else if (q.get("canceled") === "1") root.before(el("p", { class: "alert alert--err", role: "status", text: "Paiement annulé : votre panier est conservé." }));
}

async function main() {
  if (!(await merchEnabled({ fresh: true }))) { root.replaceChildren(stateEmpty("Bientôt disponible", "La boutique merch ouvrira prochainement.")); return; }
  notice();
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
  if (products.some((p) => p.sale_mode === "cart")) { bar.hidden = false; toggle.addEventListener("click", () => { cartBox.hidden = !cartBox.hidden; }); renderCart(); }
}
main();
