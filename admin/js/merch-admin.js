// admin/js/merch-admin.js — produits merch (droits imposés par Supabase RLS)
import { requireAdmin, mountAdminBar } from "./auth.js";
import { getClient } from "../../js/api.js";
import { el, safeUrl, stateEmpty, stateError, stateLoading } from "../../js/utils.js";

document.documentElement.classList.remove("no-js");
const $ = (id) => document.getElementById(id);
const user = await requireAdmin();
if (!user) throw new Error("Non autorisé");
mountAdminBar($("admin-bar"), user, "merch.html");
$("app").hidden = false;
const sb = await getClient();
const form = $("m-form");
const BUCKET = "posters", MAX_SIDE = 1400, MAX_IMAGES = 6;
const eur = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n));
const parseVariants = (text) => {
  const out = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const [label, st = ""] = line.split(";").map((x) => x.trim());
    if (!label || label.length > 40) return { error: "Chaque variante doit avoir un nom de 40 caractères maximum." };
    if (out.some((o) => o.label.toLowerCase() === label.toLowerCase())) return { error: `La variante « ${label} » est en double.` };
    const stock = st === "" ? null : Number(st);
    if (stock !== null && (!Number.isInteger(stock) || stock < 0)) return { error: `Stock invalide pour « ${label} » (nombre entier ou vide).` };
    out.push({ label, stock });
  }
  return out.length > 20 ? { error: "20 variantes maximum." } : { options: out };
};
const MODE = { onsite: "Sur place", external: "Boutique externe", cart: "Panier du site" };
let products = [], editing = null, imgs = []; // imgs : { url?, blob?, preview }


let timer;
function notify(type, text) {
  $("admin-status").replaceChildren(el("p", { class: `alert alert--${type}`, text }));
  clearTimeout(timer);
  if (type === "ok") timer = setTimeout(() => $("admin-status").replaceChildren(), 4000);
}

/* ---------- Ouverture / fermeture de la boutique ---------- */
const shop = $("shop-toggle"), shopState = $("shop-state");
const showShop = (on) => { shopState.textContent = on ? "Boutique OUVERTE : l'onglet Merch est visible par tout le monde." : "Boutique FERMÉE : l'onglet Merch est masqué, les produits et les commandes sont inaccessibles au public. Tu peux préparer tes produits."; };
{
  const { data, error } = await sb.from("site_settings").select("value").eq("key", "merch_enabled").maybeSingle();
  if (error) shopState.textContent = "Réglage indisponible : " + error.message + " (migration-settings.sql exécutée ?)";
  else { shop.checked = data?.value === true; shop.disabled = false; showShop(shop.checked); }
}
shop.addEventListener("change", async () => {
  const want = shop.checked; shop.disabled = true;
  const { error } = await sb.from("site_settings").upsert({ key: "merch_enabled", value: want }, { onConflict: "key" });
  shop.disabled = false;
  if (error) { shop.checked = !want; return notify("err", "Impossible de modifier le réglage : " + error.message); }
  try { sessionStorage.removeItem("joey_settings_v1"); } catch { /* ignoré */ }
  showShop(want); notify("ok", want ? "Boutique ouverte au public." : "Boutique masquée.");
});

/* ---------- Images ---------- */
const pathOf = (url) => { const m = `/object/public/${BUCKET}/`; const i = url ? url.indexOf(m) : -1; return i === -1 ? null : decodeURIComponent(url.slice(i + m.length).split("?")[0]); };
async function removeFiles(urls) {
  const paths = urls.map(pathOf).filter(Boolean);
  if (paths.length) { const { error } = await sb.storage.from(BUCKET).remove(paths); if (error) console.warn("Suppression d'images :", error.message); }
}
async function resizeImage(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/webp", 0.85));
  if (!blob) throw new Error("Conversion de l'image impossible.");
  return blob;
}
async function uploadImage(blob) {
  const path = `merch/${crypto.randomUUID()}.webp`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error) throw new Error("Téléversement impossible : " + error.message);
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
function renderImages() {
  $("m-images").replaceChildren(...imgs.map((im, i) => {
    const b = (text, label, fn) => { const x = el("button", { class: "btn btn--small btn--ghost", type: "button", "aria-label": label, text }); x.addEventListener("click", fn); return x; };
    return el("div", { class: "admin-thumb" },
      el("img", { src: im.preview, alt: `Photo ${i + 1}` }),
      el("div", {}, i > 0 ? b("←", "Déplacer vers le début", () => { [imgs[i - 1], imgs[i]] = [imgs[i], imgs[i - 1]]; renderImages(); }) : null,
        b("✕", "Retirer la photo", () => { imgs.splice(i, 1); renderImages(); })));
  }));
}
$("m-files").addEventListener("change", async (e) => {
  const err = $("m-error"); err.textContent = "";
  for (const file of e.target.files) {
    if (imgs.length >= MAX_IMAGES) { err.textContent = `${MAX_IMAGES} photos maximum.`; break; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 25 * 1024 * 1024) { err.textContent = "Format non pris en charge ou image trop lourde (25 Mo max)."; continue; }
    try { const blob = await resizeImage(file); imgs.push({ blob, preview: URL.createObjectURL(blob) }); } catch (x) { err.textContent = x.message; }
  }
  e.target.value = ""; renderImages();
});

/* ---------- Liste ---------- */
async function load() {
  const list = $("m-list");
  list.replaceChildren(stateLoading("Chargement…"));
  const { data, error } = await sb.from("merch_products").select("*").order("position", { ascending: true, nullsFirst: false });
  if (error) { console.error(error); list.replaceChildren(stateError("Impossible de charger les produits : " + error.message + " (la migration migration-merch.sql a-t-elle été exécutée ?)")); return; }
  products = data; render();
}
function render() {
  const list = $("m-list"); list.replaceChildren();
  if (!products.length) { list.append(stateEmpty("Aucun produit", "Ajoutez votre premier article avec le formulaire ci-dessus.")); return; }
  products.forEach((p, i) => {
    const btn = (text, cls, fn, disabled = false) => { const b = el("button", { class: `btn btn--small ${cls}`, type: "button", text }); b.disabled = disabled; b.addEventListener("click", fn); return b; };
    const cover = safeUrl((p.images || [])[0]);
    list.append(el("article", { class: `admin-item${p.is_published ? " admin-item--published" : ""}` },
      cover ? el("img", { class: "admin-cover", src: cover, alt: "" }) : null,
      el("div", {}, el("span", { class: `badge${p.is_published ? " badge--accent" : ""}`, text: p.is_published ? "Visible" : "Masqué" })),
      el("h2", { text: p.name }),
      el("p", { class: "admin-item__meta", text: `${eur(p.price)} · ${MODE[p.sale_mode]} · ${(p.options || []).length ? "variantes : " + p.options.map((o) => `${o.label}${Number.isInteger(o.stock) ? ` (${o.stock})` : ""}`).join(", ") : Number.isInteger(p.stock) ? `stock : ${p.stock}` : "stock non suivi"}` }),
      el("div", { class: "admin-item__actions" },
        btn("↑", "btn--ghost", () => move(i, -1), i === 0), btn("↓", "btn--ghost", () => move(i, 1), i === products.length - 1),
        btn("Modifier", "", () => startEdit(p)),
        btn(p.is_published ? "Masquer" : "Afficher", "btn--ghost", () => patch(p, { is_published: !p.is_published })),
        btn("Supprimer", "btn--danger", () => remove(p)))));
  });
}
async function patch(p, values) {
  const { error } = await sb.from("merch_products").update(values).eq("id", p.id);
  if (error) return notify("err", "Échec : " + error.message);
  await load();
}
async function move(i, dir) {
  const arr = [...products]; const j = i + dir; if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  const res = await Promise.all(arr.map((p, k) => ({ p, pos: k + 1 })).filter(({ p, pos }) => p.position !== pos).map(({ p, pos }) => sb.from("merch_products").update({ position: pos }).eq("id", p.id)));
  const bad = res.find((r) => r.error); if (bad) notify("err", "Réordonnancement impossible : " + bad.error.message);
  await load();
}
async function remove(p) {
  if (!window.confirm(`Supprimer « ${p.name} » et ses photos ? (Vous pouvez aussi le masquer.)`)) return;
  const { error } = await sb.from("merch_products").delete().eq("id", p.id);
  if (error) return notify("err", "Suppression impossible : " + error.message);
  await removeFiles(p.images || []); notify("ok", "Produit supprimé."); await load();
}

/* ---------- Formulaire ---------- */
function toggleUrl() { $("m-url-field").hidden = form.elements.sale_mode.value !== "external"; }
form.elements.sale_mode.addEventListener("change", toggleUrl);
function startEdit(p) {
  editing = p; const F = form.elements;
  F.name.value = p.name; F.price.value = String(p.price).replace(".", ","); F.stock.value = p.stock ?? ""; F.description.value = p.description || "";
  F.variants.value = (p.options || []).map((o) => (Number.isInteger(o.stock) ? `${o.label}; ${o.stock}` : o.label)).join("\n"); F.badge.value = p.badge || "auto"; F.sale_mode.value = p.sale_mode; F.external_url.value = p.external_url || ""; F.is_published.checked = !!p.is_published;
  imgs = (p.images || []).map((url) => ({ url, preview: url })); renderImages(); toggleUrl();
  $("m-legend").textContent = "Modifier le produit"; $("m-save").textContent = "Enregistrer"; $("m-cancel").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" }); F.name.focus();
}
function resetForm() {
  editing = null; form.reset(); imgs = []; renderImages(); toggleUrl(); $("m-error").textContent = "";
  $("m-legend").textContent = "Ajouter un produit"; $("m-save").textContent = "Ajouter"; $("m-cancel").hidden = true;
}
$("m-cancel").addEventListener("click", resetForm);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const F = form.elements, err = $("m-error"); err.textContent = "";
  const name = F.name.value.trim(), price = Number(F.price.value.trim().replace(",", "."));
  const stockRaw = F.stock.value.trim(), stock = stockRaw === "" ? null : Number(stockRaw);
  const mode = F.sale_mode.value, url = F.external_url.value.trim();
  if (name.length < 2) return void (err.textContent = "Le nom est obligatoire (2 caractères minimum).");
  if (!Number.isFinite(price) || price < 0 || price > 99999) return void (err.textContent = "Indiquez un prix valide (ex : 20 ou 17,50).");
  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) return void (err.textContent = "Le stock doit être un nombre entier (ou laissé vide).");
  const pv = parseVariants(F.variants.value); if (pv.error) return void (err.textContent = pv.error);
  if (mode === "external" && !/^https:\/\/\S+$/i.test(url)) return void (err.textContent = "Indiquez le lien de la boutique, en https://.");
  const btn = $("m-save"); btn.disabled = true;
  try {
    const urls = [];
    for (const im of imgs) urls.push(im.url || await uploadImage(im.blob));
    const row = { name, description: F.description.value.trim() || null, price, stock: pv.options.length ? null : stock, options: pv.options, badge: F.badge.value, sale_mode: mode, external_url: mode === "external" ? url : null, images: urls, is_published: F.is_published.checked };
    const { error } = editing
      ? await sb.from("merch_products").update(row).eq("id", editing.id)
      : await sb.from("merch_products").insert({ ...row, position: products.reduce((m, p) => Math.max(m, p.position || 0), 0) + 1 });
    if (error) throw new Error(error.message);
    if (editing) await removeFiles((editing.images || []).filter((u) => !urls.includes(u)));
    notify("ok", editing ? "Produit modifié." : "Produit ajouté."); resetForm(); await load();
  } catch (x) { err.textContent = "Enregistrement impossible : " + x.message; }
  btn.disabled = false;
});

toggleUrl(); await load();
