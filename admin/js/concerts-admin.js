// admin/js/concerts-admin.js — gestion des concerts depuis un smartphone.
// Toutes les écritures passent par Supabase ; les droits sont imposés par les politiques RLS
// (table public.admins) et non par ce script.
import { requireAdmin, mountAdminBar } from "./auth.js";
import { getClient } from "../../js/api.js";
import { CONFIG } from "../../js/config.js";
import { el, formatDate, formatPrice, formatTime, safeUrl, stateEmpty, stateError, stateLoading } from "../../js/utils.js";
import { renderConcertCard } from "../../js/concert-card.js";

document.documentElement.classList.remove("no-js");

const $ = (id) => document.getElementById(id);
const user = await requireAdmin();
if (!user) throw new Error("Non autorisé");
mountAdminBar($("admin-bar"), user, "concerts.html");
$("app").hidden = false;

const sb = await getClient();
const BUCKET = CONFIG.supabase.posterBucket || "posters";
const form = $("concert-form");
const MAX_SIDE = 1600;

let concerts = [];
let editing = null;        // concert en cours d'édition (null = création)
let posterUrl = null;      // URL actuelle de l'affiche
let newPosterBlob = null;  // fichier redimensionné à téléverser
let removePoster = false;

/* ---------- Messages ---------- */
let statusTimer;
function notify(type, text) {
  const p = el("p", { class: `alert alert--${type}`, text });
  $("admin-status").replaceChildren(p);
  clearTimeout(statusTimer);
  if (type === "ok") statusTimer = setTimeout(() => $("admin-status").replaceChildren(), 5000);
}

/* ---------- Dates (fuseau de l'appareil) ---------- */
const pad = (n) => String(n).padStart(2, "0");
const toDateInput = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const toTimeInput = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const toIso = (date, time) => new Date(`${date}T${time}`).toISOString();

/* ---------- Liste ---------- */
async function load() {
  const list = $("admin-list");
  list.replaceChildren(stateLoading("Chargement…"));
  const { data, error } = await sb.from("concerts").select("*").order("event_date", { ascending: false });
  if (error) { console.error(error); list.replaceChildren(stateError("Impossible de charger les concerts : " + error.message)); return; }
  concerts = data;
  renderList();
}

function renderList() {
  const list = $("admin-list");
  const f = $("filter").value;
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const rows = concerts.filter((c) => {
    const past = new Date(c.event_date) < startOfToday;
    return f === "all" || (f === "past" ? past : !past);
  });
  if (f !== "past") rows.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
  list.replaceChildren();
  if (!rows.length) { list.append(stateEmpty("Aucun concert", "Rien à afficher pour ce filtre. Utilisez « Ajouter un concert »." )); return; }

  rows.forEach((c) => {
    const past = new Date(c.event_date) < startOfToday;
    const toggle = el("button", { class: "btn btn--small btn--ghost", type: "button", text: c.is_published ? "Dépublier" : "Publier" });
    toggle.addEventListener("click", () => setPublished(c, !c.is_published));
    const edit = el("button", { class: "btn btn--small", type: "button", text: "Modifier" });
    edit.addEventListener("click", () => openForm(c));
    const del = el("button", { class: "btn btn--small btn--danger", type: "button", text: "Supprimer" });
    del.addEventListener("click", () => removeConcert(c));

    list.append(el("article", { class: `admin-item${c.is_published ? " admin-item--published" : ""}${past ? " admin-item--past" : ""}` },
      el("div", {},
        el("span", { class: `badge${c.is_published ? " badge--accent" : ""}`, text: c.is_published ? "Publié" : "Brouillon" }),
        past && el("span", { class: "badge", text: " Passé" })
      ),
      el("h2", { text: c.title }),
      c.price_type && c.price_type !== "none" && el("p", { class: "admin-item__meta", text: "Tarif : " + formatPrice(c) }),
      el("p", { class: "admin-item__meta", text: `${formatDate(c.event_date)} à ${formatTime(c.event_date)} — ${[c.venue_name, c.city].filter(Boolean).join(", ") || "lieu non renseigné"}` }),
      el("div", { class: "admin-item__actions" }, edit, toggle, del)
    ));
  });
}

async function setPublished(c, value) {
  const { error } = await sb.from("concerts").update({ is_published: value }).eq("id", c.id);
  if (error) return notify("err", "Échec de la mise à jour : " + error.message);
  notify("ok", value ? "Concert publié." : "Concert dépublié.");
  await load();
}

async function removeConcert(c) {
  if (!window.confirm(`Supprimer définitivement « ${c.title} » ?\nCette action est irréversible. (Vous pouvez aussi simplement le dépublier.)`)) return;
  const { error } = await sb.from("concerts").delete().eq("id", c.id);
  if (error) return notify("err", "Suppression impossible : " + error.message);
  await deletePosterFile(c.poster_url);
  notify("ok", "Concert supprimé.");
  await load();
}

/* ---------- Affiches (Storage) ---------- */
function posterPath(url) {
  const marker = `/object/public/${BUCKET}/`;
  const i = url ? url.indexOf(marker) : -1;
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}
async function deletePosterFile(url) {
  const path = posterPath(url);
  if (path) { const { error } = await sb.storage.from(BUCKET).remove([path]); if (error) console.warn("Suppression de l'affiche :", error.message); }
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

function showPoster(url) {
  const safe = url && (url.startsWith("blob:") || safeUrl(url));
  $("poster-box").hidden = !safe;
  $("poster-remove").hidden = !safe;
  if (safe) $("poster-img").src = url;
}

$("f-poster").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  setError("poster", "");
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("poster", "Format non pris en charge (JPG, PNG ou WebP)."); e.target.value = ""; return; }
  if (file.size > 25 * 1024 * 1024) { setError("poster", "Image trop lourde (25 Mo max avant redimensionnement)."); e.target.value = ""; return; }
  try {
    newPosterBlob = await resizeImage(file);
    removePoster = false;
    showPoster(URL.createObjectURL(newPosterBlob));
    updatePreview();
  } catch (err) { setError("poster", err.message); }
});

$("poster-remove").addEventListener("click", () => {
  newPosterBlob = null; removePoster = true; $("f-poster").value = "";
  showPoster(null); updatePreview();
});

async function uploadPoster(blob) {
  const path = `${crypto.randomUUID()}.webp`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error) throw new Error("Téléversement de l'affiche impossible : " + error.message);
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/* ---------- Formulaire ---------- */
function setError(name, text) {
  const span = form.querySelector(`[data-error-for="${name}"]`);
  const input = form.elements[name];
  if (span) span.textContent = text || "";
  if (input) input.setAttribute("aria-invalid", text ? "true" : "false");
}

function openForm(c = null) {
  editing = c; newPosterBlob = null; removePoster = false; posterUrl = c?.poster_url || null;
  form.reset();
  $("form-title").textContent = c ? "Modifier le concert" : "Nouveau concert";
  ["title", "date", "time", "latitude", "longitude", "reservation_url", "poster", "price_amount"].forEach((n) => setError(n, ""));
  if (c) {
    const F = form.elements;
    F.title.value = c.title; F.date.value = toDateInput(c.event_date); F.time.value = toTimeInput(c.event_date);
    F.description.value = c.description || ""; F.venue_name.value = c.venue_name || ""; F.address.value = c.address || "";
    F.city.value = c.city || ""; F.latitude.value = c.latitude ?? ""; F.longitude.value = c.longitude ?? "";
    F.reservation_url.value = c.reservation_url || ""; F.is_published.checked = !!c.is_published;
    F.price_type.value = c.price_type || "none"; F.price_amount.value = c.price_amount ?? "";
  } else { form.elements.time.value = "20:30"; }
  togglePrice();
  showPoster(posterUrl);
  $("list-view").hidden = true; $("form-view").hidden = false;
  updatePreview(); window.scrollTo({ top: 0 });
}
function closeForm() { $("form-view").hidden = true; $("list-view").hidden = false; window.scrollTo({ top: 0 }); }

function readForm() {
  const v = Object.fromEntries(new FormData(form).entries());
  const pr = String(v.price_amount || "").trim().replace(",", ".");
  const lat = String(v.latitude || "").trim().replace(",", "."), lng = String(v.longitude || "").trim().replace(",", ".");
  return {
    title: (v.title || "").trim(), date: v.date, time: v.time,
    description: (v.description || "").trim() || null, venue_name: (v.venue_name || "").trim() || null,
    address: (v.address || "").trim() || null, city: (v.city || "").trim() || null,
    latitude: lat === "" ? null : Number(lat), longitude: lng === "" ? null : Number(lng),
    reservation_url: (v.reservation_url || "").trim() || null, is_published: form.elements.is_published.checked,
    price_type: v.price_type || "none",
    price_amount: v.price_type === "amount" && pr !== "" ? Number(pr) : null
  };
}

function validate(v) {
  let ok = true;
  const bad = (n, cond, t) => { setError(n, cond ? t : ""); if (cond) ok = false; };
  bad("title", v.title.length < 2, "Le titre est obligatoire (2 caractères minimum).");
  bad("date", !v.date, "La date est obligatoire.");
  bad("time", !v.time, "L'heure est obligatoire.");
  bad("latitude", v.latitude != null && !(v.latitude >= -90 && v.latitude <= 90), "Latitude invalide (-90 à 90).");
  bad("longitude", v.longitude != null && !(v.longitude >= -180 && v.longitude <= 180), "Longitude invalide (-180 à 180).");
  bad("longitude", (v.latitude == null) !== (v.longitude == null), "Renseignez latitude ET longitude, ou aucune des deux.");
  bad("reservation_url", v.reservation_url && !/^https?:\/\//i.test(v.reservation_url) || (v.reservation_url && !safeUrl(v.reservation_url)), "Lien invalide : il doit commencer par https://");
  bad("price_amount", v.price_type === "amount" && (v.price_amount == null || !Number.isFinite(v.price_amount) || v.price_amount < 0 || v.price_amount > 99999), "Indiquez un prix valide (ex : 10 ou 7,50).");
  return ok;
}

function previewData() {
  const v = readForm();
  let iso = new Date().toISOString();
  if (v.date) { const d = new Date(`${v.date}T${v.time || "20:00"}`); if (!Number.isNaN(d.getTime())) iso = d.toISOString(); }
  const poster = newPosterBlob ? $("poster-img").src : removePoster ? null : posterUrl;
  return { ...v, title: v.title || "Titre du concert", event_date: iso, poster_url: poster, reservation_url: v.reservation_url };
}
function updatePreview() { $("preview").replaceChildren(renderConcertCard(previewData(), { detailed: true, preview: true })); $("preview").firstChild.classList.add("is-visible"); }
function togglePrice() { $("price-amount-field").hidden = form.elements.price_type.value !== "amount"; }
form.addEventListener("input", () => { togglePrice(); updatePreview(); });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const v = readForm();
  if (!validate(v)) { notify("err", "Certains champs sont à corriger."); form.querySelector('[aria-invalid="true"]')?.focus(); return; }
  const btn = $("save-btn"); btn.disabled = true; btn.textContent = "Enregistrement…";
  try {
    let url = posterUrl;
    const oldUrl = editing?.poster_url || null;
    if (newPosterBlob) url = await uploadPoster(newPosterBlob);
    else if (removePoster) url = null;

    const row = {
      title: v.title, description: v.description, event_date: toIso(v.date, v.time), venue_name: v.venue_name, address: v.address,
      city: v.city, latitude: v.latitude, longitude: v.longitude, poster_url: url, reservation_url: v.reservation_url, is_published: v.is_published,
      price_type: v.price_type, price_amount: v.price_amount
    };
    const { error } = editing
      ? await sb.from("concerts").update(row).eq("id", editing.id)
      : await sb.from("concerts").insert(row);
    if (error) { if (newPosterBlob && url) await deletePosterFile(url); throw error; }
    if (oldUrl && oldUrl !== url) await deletePosterFile(oldUrl);

    notify("ok", editing ? "Concert modifié." : "Concert ajouté.");
    closeForm(); await load();
  } catch (err) {
    console.error(err);
    notify("err", "Enregistrement impossible : " + (err.message || "erreur inconnue"));
  } finally { btn.disabled = false; btn.textContent = "Enregistrer"; }
});

$("add-btn").addEventListener("click", () => openForm(null));
$("cancel-btn").addEventListener("click", closeForm);
$("filter").addEventListener("change", renderList);

await load();
