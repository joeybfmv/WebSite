// js/merch.js — boutique merch (masquée au public tant que la boutique n'est pas ouverte dans l'admin)
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
const view = { cat: "", sort: "order", hideSold: false };
let sb = null, products = [], cart = readCart(), gridBox = null, lastFocus = null, toastTimer;
let promo = null, promoDraft = "", promoMsg = ""; // promo : { code, discount, label } — le montant réel est recalculé par le serveur à la commande

function readCart() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((i) => i && typeof i.id === "string" && Number.isInteger(i.qty) && i.qty > 0).map((i) => ({ id: i.id, qty: i.qty, variant: typeof i.variant === "string" ? i.variant : "" })) : [];
  } catch { return []; }
}
const writeCart = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch { /* stockage indisponible */ } };
const opts = (p) => (Array.isArray(p.options) ? p.options : []);
const same = (i, id, v) => i.id === id && i.variant === (v || "");
const catOf = (p) => (typeof p.category === "string" ? p.category.trim() : "");

/** Stock disponible pour un produit (et une variante) ; null = non suivi. */
function stockOf(p, variant) {
  if (opts(p).length) { const o = opts(p).find((x) => x.label === variant); return o && Number.isInteger(o.stock) ? o.stock : null; }
  return Number.isInteger(p.stock) ? p.stock : null;
}
function totalStock(p) {
  if (!opts(p).length) return Number.isInteger(p.stock) ? p.stock : null;
  return opts(p).every((o) => Number.isInteger(o.stock)) ? opts(p).reduce((n, o) => n + o.stock, 0) : null;
}
const soldOutOf = (p) => (opts(p).length ? opts(p).every((x) => Number.isInteger(x.stock) && x.stock === 0) : (Number.isInteger(p.stock) && p.stock === 0));
function badgeText(p) {
  const mode = p.badge || "auto", ts = totalStock(p);
  if (mode === "none") return null;
  if (mode === "new") return "Nouveau";
  if (mode === "last") return "Dernières pièces";
  if (ts !== null && ts > 0 && ts <= 5) return "Dernières pièces";
  if (p.created_at && Date.now() - new Date(p.created_at).getTime() < 21 * 864e5) return "Nouveau";
  return null;
}

/* ---------- Message court (« ajouté au panier ») ---------- */
const toast = el("p", { class: "merch-toast", role: "status", "aria-live": "polite" });
function say(text) {
  toast.textContent = text; toast.classList.add("is-visible");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

/* ---------- Panier (panneau latéral) ---------- */
const overlay = el("div", { class: "cart-overlay", hidden: true });
function openCart() {
  lastFocus = document.activeElement;
  cartBox.hidden = false; overlay.hidden = false; document.body.classList.add("cart-open");
  toggle.setAttribute("aria-expanded", "true");
  (cartBox.querySelector("[data-close]") || cartBox).focus();
}
function closeCart() {
  cartBox.hidden = true; overlay.hidden = true; document.body.classList.remove("cart-open");
  toggle.setAttribute("aria-expanded", "false");
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
const cartHeader = (title) => {
  const close = el("button", { class: "btn btn--small btn--ghost", type: "button", "data-close": "", "aria-label": "Fermer le panier", text: "Fermer ✕" });
  close.addEventListener("click", closeCart);
  return el("div", { class: "cart-head" }, el("h2", { class: "h-small", text: title }), close);
};

function addToCart(p, variant) {
  const max = stockOf(p, variant);
  const line = cart.find((i) => same(i, p.id, variant));
  const next = (line ? line.qty : 0) + 1;
  if (max !== null && next > max) return say("Stock maximum atteint pour cet article.");
  if (next > 20) return say("20 exemplaires maximum par article.");
  if (line) line.qty = next; else cart.push({ id: p.id, qty: 1, variant: variant || "" });
  writeCart(); renderCart(); refreshPromo();
  say(`${p.name}${variant ? ` (${variant})` : ""} ajouté au panier`);
}
function setQty(item, qty) {
  const p = products.find((x) => x.id === item.id), max = p ? stockOf(p, item.variant) : null;
  if (qty < 1) cart = cart.filter((i) => i !== item);
  else if (qty <= 20 && (max === null || qty <= max)) item.qty = qty;
  writeCart(); renderCart(); refreshPromo();
}

/* ---------- Photos en grand ---------- */
const dlg = el("dialog", { class: "lightbox", "aria-label": "Photos du produit" });
const lbImg = el("img", { alt: "" }), lbCount = el("span", { class: "lightbox__count", "aria-live": "polite" });
let lbList = [], lbIdx = 0;
function lbShow(i) {
  lbIdx = (i + lbList.length) % lbList.length; lbImg.src = lbList[lbIdx];
  lbCount.textContent = lbList.length > 1 ? `${lbIdx + 1} / ${lbList.length}` : "";
}
{
  const b = (text, label, fn) => { const x = el("button", { class: "btn btn--small btn--ghost", type: "button", "aria-label": label, text }); x.addEventListener("click", fn); return x; };
  dlg.append(lbImg, el("div", { class: "lightbox__bar" }, b("←", "Photo précédente", () => lbShow(lbIdx - 1)), lbCount, b("→", "Photo suivante", () => lbShow(lbIdx + 1)), b("Fermer ✕", "Fermer", () => dlg.close())));
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") lbShow(lbIdx - 1); else if (e.key === "ArrowRight") lbShow(lbIdx + 1); });
}
function openLightbox(list, i, alt) {
  if (typeof dlg.showModal !== "function") return;
  lbList = list; lbImg.alt = alt; lbShow(i); dlg.showModal();
}

/* ---------- Choix de la taille / option ---------- */
function picker(p, onChange) {
  const node = el("div", { class: "size-picker", role: "radiogroup", "aria-label": `Options pour ${p.name}` });
  const api = { node, value: "" };
  const btns = opts(p).map((x) => {
    const out = Number.isInteger(x.stock) && x.stock === 0;
    const b = el("button", { class: "size-btn", type: "button", role: "radio", "aria-checked": "false", disabled: out, title: out ? "Épuisé" : null, text: x.label });
    b.addEventListener("click", () => { api.value = x.label; btns.forEach((o) => o.setAttribute("aria-checked", String(o === b))); onChange(); });
    return b;
  });
  node.append(...btns);
  return api;
}

function card(p) {
  const imgs = (p.images || []).map((u) => safeUrl(u)).filter(Boolean);
  const main = el("img", { class: "merch-card__img", alt: p.name, loading: "lazy", decoding: "async", width: "600", height: "600" });
  main.src = imgs[0] || "assets/images/guitars/placeholder.svg";
  let cur = 0;
  const zoom = imgs.length ? el("button", { class: "merch-card__zoom", type: "button", "aria-label": `Agrandir la photo de ${p.name}` }, main) : main;
  if (imgs.length) zoom.addEventListener("click", () => openLightbox(imgs, cur, p.name));
  const thumbs = imgs.length > 1 ? el("div", { class: "merch-card__thumbs" }, imgs.map((u, i) => {
    const b = el("button", { class: "merch-thumb", type: "button", "aria-label": `Photo ${i + 1} de ${p.name}` }, el("img", { src: u, alt: "", loading: "lazy", width: "48", height: "48" }));
    b.addEventListener("click", () => { main.src = u; cur = i; });
    return b;
  })) : null;
  const o = opts(p), ts = totalStock(p), soldOut = soldOutOf(p);
  const hint = el("p", { class: "merch-card__hint", role: "status" });
  const pick = o.length && !soldOut ? picker(p, () => { hint.textContent = ""; }) : null;
  let action;
  if (soldOut) action = el("p", { class: "merch-card__note", text: "Épuisé" });
  else if (p.sale_mode === "external" && safeUrl(p.external_url)) action = el("a", { class: "btn btn--primary", href: safeUrl(p.external_url), target: "_blank", rel: "noopener noreferrer", text: "Acheter en ligne" });
  else if (p.sale_mode === "cart") {
    action = el("button", { class: "btn btn--primary", type: "button", text: "Ajouter au panier" });
    action.addEventListener("click", () => {
      if (pick && !pick.value) { hint.textContent = "Choisissez d'abord une option."; pick.node.querySelector(".size-btn:not(:disabled)")?.focus(); return; }
      hint.textContent = ""; addToCart(p, pick ? pick.value : "");
    });
  } else action = el("p", { class: "merch-card__note", text: "À acheter sur place, au stand merch lors des concerts." });
  const badge = badgeText(p);
  const old = Number(p.compare_price), price = Number(p.price), onSale = Number.isFinite(old) && old > price;
  return el("article", { class: "card merch-card", id: `p-${p.id}` }, zoom, thumbs,
    el("div", { class: "card__body" },
      catOf(p) ? el("p", { class: "merch-card__cat", text: catOf(p) }) : null,
      el("h2", { class: "h-small", text: p.name }),
      el("p", { class: "merch-card__price" },
        onSale ? el("s", { class: "merch-card__old", text: eur(old), title: "Ancien prix" }) : null,
        el("span", { text: eur(price) }),
        onSale ? el("span", { class: "merch-badge merch-badge--sale", text: `-${Math.round((1 - price / old) * 100)} %` }) : null),
      soldOut ? el("span", { class: "merch-badge", text: "Épuisé" }) : (badge ? el("span", { class: "merch-badge", text: badge + (badge === "Dernières pièces" && ts ? ` (${ts})` : "") }) : null),
      p.description ? el("p", { text: p.description }) : null,
      pick ? pick.node : null, hint, action));
}

/* ---------- Catalogue : catégories, tri, épuisés ---------- */
function visible() {
  let list = products.filter((p) => (!view.cat || catOf(p) === view.cat) && (!view.hideSold || !soldOutOf(p)));
  if (view.sort === "asc") list = [...list].sort((a, b) => Number(a.price) - Number(b.price));
  else if (view.sort === "desc") list = [...list].sort((a, b) => Number(b.price) - Number(a.price));
  else if (view.sort === "new") list = [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  return list;
}
function renderGrid() {
  const list = visible();
  gridBox.replaceChildren(list.length ? el("div", { class: "merch-grid" }, list.map(card)) : stateEmpty("Aucun article", "Aucun produit ne correspond à ce filtre."));
}
function toolbar() {
  const cats = [...new Set(products.map(catOf).filter(Boolean))];
  const anySold = products.some(soldOutOf);
  if (cats.length < 2 && products.length < 4) return null;
  const chips = cats.length > 1 ? el("div", { class: "chip-row", role: "group", "aria-label": "Catégories" }) : null;
  if (chips) {
    for (const [value, label] of [["", "Tout"], ...cats.map((c) => [c, c])]) {
      const b = el("button", { class: "chip", type: "button", "aria-pressed": String(view.cat === value), text: label });
      b.addEventListener("click", () => { view.cat = value; chips.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); renderGrid(); });
      chips.append(b);
    }
  }
  const sort = el("select", { id: "merch-sort", "aria-label": "Trier les articles" },
    el("option", { value: "order", text: "Ordre de la boutique" }), el("option", { value: "new", text: "Nouveautés" }),
    el("option", { value: "asc", text: "Prix croissant" }), el("option", { value: "desc", text: "Prix décroissant" }));
  sort.addEventListener("change", () => { view.sort = sort.value; renderGrid(); });
  let sold = null;
  if (anySold) {
    const cb = el("input", { type: "checkbox", id: "merch-hide-sold" });
    cb.addEventListener("change", () => { view.hideSold = cb.checked; renderGrid(); });
    sold = el("label", { class: "merch-check", for: "merch-hide-sold" }, cb, " Masquer les épuisés");
  }
  return el("div", { class: "merch-toolbar" }, chips, el("div", { class: "merch-toolbar__side" }, sold, sort));
}

/* ---------- Codes promo (vérifiés par le serveur) ---------- */
const promosOn = () => CONFIG.features?.promoCodes === true;
const cartItems = () => cart.map(({ id, qty, variant }) => ({ id, qty, variant: variant || null }));
async function checkPromo(code) {
  try {
    const { data, error } = await sb.rpc("merch_promo_preview", { p_code: code, p_items: cartItems() });
    if (error || !data) throw error || new Error("vide");
    return data;
  } catch (e) { console.warn(e); return { ok: false, message: "Impossible de vérifier le code pour le moment." }; }
}
const useResult = (r) => { if (r.ok) { promo = { code: r.code, discount: Number(r.discount), label: r.label }; promoMsg = ""; } else { promo = null; promoMsg = r.message || "Code promo invalide."; } };
/** Le panier a changé : on refait vérifier le code (pourcentage, minimum d'achat…). */
async function refreshPromo() {
  if (!promo) return;
  if (!cart.length) { promo = null; promoMsg = ""; return renderCart(); }
  useResult(await checkPromo(promo.code)); renderCart();
}
const discountOf = (total) => (promo ? Math.min(promo.discount, total) : 0);
function promoBox() {
  const box = el("div", { class: "cart-promo" });
  if (promo) {
    const rm = el("button", { class: "btn btn--small btn--ghost", type: "button", text: "Retirer" });
    rm.addEventListener("click", () => { promo = null; promoDraft = ""; promoMsg = ""; renderCart(); });
    box.append(el("p", { class: "cart-promo__ok", role: "status", text: `Code ${promo.code} appliqué (${promo.label})` }), rm);
    return box;
  }
  const input = el("input", { id: "o-promo", type: "text", maxlength: "30", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", placeholder: "Code promo", "aria-label": "Code promo", value: promoDraft });
  const ok = el("button", { class: "btn btn--small btn--ghost", type: "button", text: "Appliquer" });
  const go = async () => {
    const code = input.value.trim(); promoDraft = code; if (!code) return;
    ok.disabled = true; ok.textContent = "Vérification…";
    useResult(await checkPromo(code)); if (promo) promoDraft = ""; renderCart();
  };
  ok.addEventListener("click", go);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
  box.append(input, ok);
  if (promoMsg) box.append(el("p", { class: "cart-promo__err", role: "status", text: promoMsg }));
  return box;
}

/* ---------- Panier : affichage ---------- */
function renderCart() {
  const n = cart.reduce((s, i) => s + i.qty, 0);
  const active = cartBox.contains(document.activeElement) ? document.activeElement.getAttribute("aria-label") : null;
  let total = 0;
  for (const item of cart) { const p = products.find((x) => x.id === item.id); if (p) total += Number(p.price) * item.qty; }
  const off = discountOf(total);
  toggle.textContent = n ? `Panier (${n}) · ${eur(total - off)}` : "Panier (0)";
  cartBox.replaceChildren(cartHeader("Mon panier"));
  if (!cart.length) { cartBox.append(el("p", { text: "Votre panier est vide." })); return; }
  for (const item of cart) {
    const p = products.find((x) => x.id === item.id); if (!p) continue;
    const label = item.variant ? `${p.name} (${item.variant})` : p.name;
    const btn = (text, aria, fn) => { const b = el("button", { class: "btn btn--small btn--ghost", type: "button", "aria-label": aria, text }); b.addEventListener("click", fn); return b; };
    cartBox.append(el("div", { class: "cart-line" }, el("span", { text: `${label} — ${eur(p.price)}` }),
      el("span", { class: "cart-line__qty" }, btn("−", `Retirer un ${label}`, () => setQty(item, item.qty - 1)), el("strong", { text: String(item.qty) }), btn("+", `Ajouter un ${label}`, () => setQty(item, item.qty + 1)), btn("✕", `Supprimer ${label}`, () => setQty(item, 0)))));
  }
  if (promosOn() && sb) cartBox.append(promoBox());
  if (off > 0) cartBox.append(el("p", { class: "cart-sum", text: `Sous-total : ${eur(total)}` }), el("p", { class: "cart-sum cart-sum--promo", text: `Code ${promo.code} : −${eur(off)}` }));
  cartBox.append(el("p", { class: "cart-total", text: `Total : ${eur(total - off)}` }), el("p", { class: "cart-pickup", text: "Retrait au stand merch, lors des concerts." }), orderForm());
  if (active) [...cartBox.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === active)?.focus();
}

function receipt() {
  let total = 0;
  const lines = cart.map((item) => {
    const p = products.find((x) => x.id === item.id); if (!p) return null;
    total += Number(p.price) * item.qty;
    return el("li", { text: `${item.qty} × ${p.name}${item.variant ? ` (${item.variant})` : ""} — ${eur(Number(p.price) * item.qty)}` });
  }).filter(Boolean);
  const off = discountOf(total);
  return el("div", { class: "cart-receipt" }, el("ul", {}, lines), off > 0 ? el("p", { class: "cart-sum cart-sum--promo", text: `Code ${promo.code} : −${eur(off)}` }) : null, el("p", { class: "cart-total", text: `Total : ${eur(total - off)}` }));
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
        const res = await fetch(`${CONFIG.supabase.url}/functions/v1/merch-checkout`, { method: "POST", headers: { "Content-Type": "application/json", apikey: CONFIG.supabase.anonKey }, body: JSON.stringify({ name, email, message: msg.value.trim() || null, items, ...(promo ? { promo_code: promo.code } : {}) }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || typeof data.url !== "string" || !data.url.startsWith("https://checkout.stripe.com/")) throw new Error(data.error || "Paiement indisponible, réessayez plus tard.");
        window.location.href = data.url; return;
      }
      const { error } = await sb.from("merch_orders").insert({ name, email, message: msg.value.trim() || null, items, ...(promo ? { promo_code: promo.code } : {}) });
      if (error) throw new Error(error.message || "Envoi impossible, réessayez plus tard.");
      const summary = receipt();
      cart = []; writeCart(); promo = null; promoDraft = ""; promoMsg = "";
      cartBox.replaceChildren(cartHeader("Merci !"), el("p", { text: "Votre demande est bien enregistrée. Un e-mail de confirmation vous est envoyé, et je vous recontacte très vite." }), summary, el("p", { class: "cart-pickup", text: "Retrait et règlement au stand merch, lors d'un prochain concert." }));
      toggle.textContent = "Panier (0)";
      cartBox.querySelector("[data-close]")?.focus();
    } catch (err) {
      status.textContent = err.message;
      if (promo && /promo|code est valable/i.test(err.message)) { promoMsg = err.message; promo = null; setTimeout(renderCart, 1500); }
    }
    submit.disabled = false;
  });
  return form;
}

function notice() {
  const q = new URLSearchParams(window.location.search);
  if (q.get("paid") === "1") { cart = []; writeCart(); root.before(el("p", { class: "alert alert--ok", role: "status", text: "Merci ! Votre paiement est bien reçu. Un e-mail de confirmation vous est envoyé." })); }
  else if (q.get("canceled") === "1") root.before(el("p", { class: "alert alert--err", role: "status", text: "Paiement annulé : votre panier est conservé." }));
}

/** Lien direct vers un article (QR code du stand) : #p-<id>. */
function goToHash() {
  const m = /^#p-([\w-]+)$/.exec(window.location.hash); if (!m) return;
  let target = document.getElementById(`p-${m[1]}`);
  if (!target && products.some((p) => p.id === m[1])) { view.cat = ""; view.hideSold = false; renderGrid(); target = document.getElementById(`p-${m[1]}`); }
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("is-target"); setTimeout(() => target.classList.remove("is-target"), 3500);
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
  gridBox = el("div", { class: "merch-results" });
  root.replaceChildren(...[toolbar(), gridBox].filter(Boolean)); renderGrid();
  document.body.append(toast, overlay, dlg);
  cart = cart.filter((i) => products.some((p) => p.id === i.id && p.sale_mode === "cart"));
  if (products.some((p) => p.sale_mode === "cart")) {
    bar.hidden = false; cartBox.hidden = true; toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", () => (cartBox.hidden ? openCart() : closeCart()));
    overlay.addEventListener("click", closeCart);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !cartBox.hidden) closeCart(); });
    renderCart();
  }
  goToHash(); window.addEventListener("hashchange", goToHash);
}
main();
