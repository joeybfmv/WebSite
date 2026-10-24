// js/team-editor.js — éditeur de documents de l'équipe technique (style des fiches Joɘy)
import { getClient } from "./api.js";
import { CONFIG } from "./config.js";
import { el } from "./utils.js";

const $ = (id) => document.getElementById(id);
const W = { a4: 794, a6: 397 }, H = { a4: 1123, a6: 559 };
const H2C = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
const PDF = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
const BLOCKS = { heading: "Titre de section", items: "Liste numérotée avec détails", list: "Liste simple numérotée", stats: "Chiffres clés", text: "Texte", note: "Encadré", keyval: "Informations (libellé / valeur)" };
const NEW = { heading: () => ({ type: "heading", text: "Nouveau titre" }), items: () => ({ type: "items", rows: [{ title: "Point 1", text: "Détail" }] }), list: () => ({ type: "list", rows: [{ text: "Élément" }] }),
  stats: () => ({ type: "stats", cells: [{ value: "0", label: "Légende" }] }), text: () => ({ type: "text", text: "" }), note: () => ({ type: "note", text: "" }), keyval: () => ({ type: "keyval", rows: [{ label: "Libellé", value: "Valeur" }] }) };
const FOOT = { phone: CONFIG.phone || "07 69 34 10 08", email: CONFIG.email || "joeybfmv.contact@gmail.com", site: "joeybfmv.github.io/WebSite" };
const base = (o) => ({ title: "", tagline: "Tribute Bullet For My Valentine", theme: "light", format: "a4", footer: true, footerData: { ...FOOT }, blocks: [], ...o });
const TEMPLATES = {
  blank: ["Document vide", () => base({ title: "Nouveau document", blocks: [NEW.heading(), NEW.text()] })],
  technique: ["Fiche technique", () => base({ title: "Fiche technique", blocks: [
    { type: "stats", cells: [{ value: "1 + 1", label: "Musicien + technicien" }, { value: "12", label: "Morceaux" }, { value: "≈ 1 h", label: "de set" }, { value: "2", label: "Guitares" }] },
    { type: "heading", text: "Besoins" },
    { type: "items", rows: [
      { title: "Ampli guitare", text: "Ampli et pédale apportés par l'artiste. Ampli à micro'ter (micro d'ampli) et à envoyer en façade." },
      { title: "Backing tracks", text: "Ordinateur portable, sortie mini-jack 3,5 mm stéréo. À fournir : 1 DI stéréo (ou 2 DI mono) et le câble vers la console." },
      { title: "Micro chant", text: "1 micro sur pied, pour s'adresser au public entre les morceaux." },
      { title: "Retour de scène", text: "1 retour (wedge) devant l'artiste : guitare + backing tracks." },
      { title: "Électricité", text: "2 prises 230 V à proximité : ampli et chargeur de l'ordinateur." },
      { title: "Technicien, table et supports", text: "1 technicien (guitar tech) derrière la table : backing tracks, guitares, cordes, accordage. Prévoir sa place, 1 petite table et 2 supports de guitare (deux accordages, changements en cours de set)." }] }] })],
  setlist: ["Setlist (fond noir)", () => base({ title: "Setlist", theme: "dark", footer: false, blocks: [{ type: "list", rows: ["Hit the Floor", "Hand of Blood", "4 Words (To Choke Upon)", "Deliver Us from Evil", "Tears Don't Fall", "Hearts Burst into Fire", "No More Tears To Cry", "Can't Escape The Waves", "Your Betrayal", "Dirty Little Secret", "You Want a Battle? (Here's a War)", "Cries in Vain"].map((t) => ({ text: t })) }] })],
  guitar: ["Fiche guitar tech", () => base({ title: "Fiche guitar tech", blocks: [{ type: "heading", text: "Avant le set" }, { type: "items", rows: [{ title: "Point à vérifier", text: "Détail à compléter." }] }, { type: "heading", text: "Pendant le set" }, { type: "items", rows: [{ title: "Point à vérifier", text: "Détail à compléter." }] }] })],
  planb: ["Si ça se passe mal", () => base({ title: "Si ça se passe mal", blocks: [{ type: "heading", text: "Problème" }, { type: "items", rows: [{ title: "Si… alors…", text: "Action à faire, à compléter." }] }, { type: "note", text: "Reste calme, préviens l'artiste d'un signe et applique la solution." }] })],
  annonce: ["Annonce animateur", () => base({ title: "Annonce animateur", blocks: [{ type: "heading", text: "Texte à lire" }, { type: "text", text: "Écris ici l'annonce à lire au micro." }, { type: "note", text: "Consigne pour l'animateur (durée, moment, ton…)." }] })],
  carte: ["Carte de contact (A6, noir)", () => base({ title: "Contact", theme: "dark", format: "a6", footer: false, blocks: [{ type: "keyval", rows: [{ label: "Téléphone", value: FOOT.phone }, { label: "E-mail", value: FOOT.email }, { label: "Site", value: FOOT.site }] }] })],
};

const str = (v, n) => String(v ?? "").slice(0, n);
function clean(d) {
  const o = d && typeof d === "object" ? d : {};
  const rows = (a, n, m) => (Array.isArray(a) ? a : []).slice(0, m).map((r) => Object.fromEntries(Object.entries(n).map(([k, max]) => [k, str(r?.[k], max)])));
  const fd = o.footerData || {};
  const blocks = (Array.isArray(o.blocks) ? o.blocks : []).slice(0, 60).map((b) => {
    switch (b?.type) {
      case "heading": return { type: "heading", text: str(b.text, 120) };
      case "text": case "note": return { type: b.type, text: str(b.text, 3000) };
      case "items": return { type: "items", rows: rows(b.rows, { title: 120, text: 600 }, 30) };
      case "list": return { type: "list", rows: rows(b.rows, { text: 160 }, 40) };
      case "stats": return { type: "stats", cells: rows(b.cells, { value: 20, label: 40 }, 4) };
      case "keyval": return { type: "keyval", rows: rows(b.rows, { label: 60, value: 200 }, 20) };
      default: return null;
    }
  }).filter(Boolean);
  return { title: str(o.title, 160), tagline: str(o.tagline ?? "Tribute Bullet For My Valentine", 80), theme: o.theme === "dark" ? "dark" : "light", format: o.format === "a6" ? "a6" : "a4", footer: o.footer !== false,
    footerData: { phone: str(fd.phone ?? FOOT.phone, 40), email: str(fd.email ?? FOOT.email, 120), site: str(fd.site ?? FOOT.site, 120) }, blocks };
}

/* ---------- Rendu du document ---------- */
function renderBlock(b) {
  const pad = (n) => String(n + 1).padStart(2, "0");
  switch (b.type) {
    case "heading": return el("h2", { class: "doc__h", text: b.text });
    case "text": return el("p", { class: "doc__text", text: b.text });
    case "note": return el("p", { class: "doc__note", text: b.text });
    case "stats": { const w = el("div", { class: "doc__stats" }, b.cells.map((c) => el("div", { class: "doc__stat" }, el("strong", { text: c.value }), el("span", { text: c.label })))); w.style.setProperty("--n", String(Math.max(1, b.cells.length))); return w; }
    case "items": return el("div", {}, b.rows.map((r, i) => el("div", { class: "doc__item" }, el("b", { text: String(i + 1) }), el("div", {}, el("h3", { text: r.title }), r.text ? el("p", { text: r.text }) : null))));
    case "list": return el("div", {}, b.rows.map((r, i) => el("div", { class: "doc__li" }, el("b", { text: pad(i) }), el("span", { text: r.text }))));
    case "keyval": return el("div", {}, b.rows.map((r) => el("div", { class: "doc__kv" }, el("b", { text: r.label }), el("span", { text: r.value }))));
    default: return el("div");
  }
}
function renderDoc(d) {
  const root = el("article", { class: `doc doc--${d.theme} doc--${d.format}` });
  root.append(el("header", { class: "doc__head" },
    el("img", { class: "doc__logo", src: d.theme === "dark" ? "assets/images/logo/joey-logo-floral.svg" : "assets/images/logo/joey-logo-floral-light.svg", alt: "Joɘy" }),
    d.tagline ? el("p", { class: "doc__tag", text: d.tagline }) : null, d.title ? el("h1", { class: "doc__title", text: d.title }) : null), el("hr", { class: "doc__rule" }));
  root.append(el("div", { class: "doc__body" }, d.blocks.map(renderBlock)));
  if (d.footer) root.append(el("footer", { class: "doc__foot" }, ...[["Téléphone", d.footerData.phone], ["E-mail", d.footerData.email], ["Site", d.footerData.site]].map(([l, v]) => el("div", {}, el("b", { text: l }), el("span", { text: v })))));
  return root;
}

/* ---------- État et éditeur ---------- */
let sb = null, doc = TEMPLATES.technique[1](), currentId = null, dirty = false, uid = 0, queued = false;
const say = (t) => { $("ed-status").textContent = t; };
const touch = () => { dirty = true; schedule(); };
function schedule() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; preview(); }); }
function fit() {
  const s = Math.min(1, $("ed-stage").clientWidth / W[doc.format]);
  $("ed-frame").style.setProperty("--s", String(s));
  $("ed-frame").style.width = `${Math.round(W[doc.format] * s)}px`; $("ed-frame").style.height = `${Math.round(H[doc.format] * s)}px`;
}
function preview() {
  const node = renderDoc(doc);
  $("ed-scale").replaceChildren(node); fit();
  const body = node.querySelector(".doc__body");
  $("ed-warn").textContent = body && body.scrollHeight > body.clientHeight + 2 ? "⚠ Le contenu dépasse la page : raccourcis un texte ou supprime un bloc." : "";
}
new ResizeObserver(() => fit()).observe($("ed-stage"));
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

function inp(label, value, onInput, { area = false, max = 500 } = {}) {
  const node = el(area ? "textarea" : "input", area ? { rows: "3", maxlength: String(max) } : { type: "text", maxlength: String(max) });
  node.id = `f${++uid}`; node.value = value ?? "";
  node.addEventListener("input", () => { onInput(node.value); touch(); });
  return el("div", { class: "field" }, el("label", { for: node.id, text: label }), node);
}
const mini = (text, aria, fn, disabled = false) => { const b = el("button", { class: "btn btn--small btn--ghost", type: "button", "aria-label": aria, text }); b.disabled = disabled; b.addEventListener("click", fn); return b; };
const redraw = () => { buildPanel(); touch(); };
function move(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; redraw(); }

function rowsEditor(b, key, fields, max, empty) {
  const rows = b[key], wrap = el("div");
  rows.forEach((r, i) => wrap.append(el("div", { class: "ed-row" }, ...fields.map((f) => inp(f.label, r[f.k], (v) => { r[f.k] = v; }, { area: f.area, max: f.max })),
    el("div", { class: "ed-row__actions" }, mini("↑", "Monter", () => move(rows, i, -1), i === 0), mini("↓", "Descendre", () => move(rows, i, 1), i === rows.length - 1), mini("✕", "Supprimer la ligne", () => { rows.splice(i, 1); redraw(); })))));
  if (rows.length < max) wrap.append(mini("+ Ajouter une ligne", "Ajouter une ligne", () => { rows.push({ ...empty }); redraw(); }));
  return wrap;
}
function blockFields(b) {
  switch (b.type) {
    case "heading": return inp("Texte", b.text, (v) => { b.text = v; }, { max: 120 });
    case "text": case "note": return inp("Texte", b.text, (v) => { b.text = v; }, { area: true, max: 3000 });
    case "items": return rowsEditor(b, "rows", [{ k: "title", label: "Titre", max: 120 }, { k: "text", label: "Détail", area: true, max: 600 }], 30, { title: "", text: "" });
    case "list": return rowsEditor(b, "rows", [{ k: "text", label: "Texte", max: 160 }], 40, { text: "" });
    case "stats": return rowsEditor(b, "cells", [{ k: "value", label: "Valeur", max: 20 }, { k: "label", label: "Légende", max: 40 }], 4, { value: "", label: "" });
    default: return rowsEditor(b, "rows", [{ k: "label", label: "Libellé", max: 60 }, { k: "value", label: "Valeur", max: 200 }], 20, { label: "", value: "" });
  }
}
function select(label, value, options, onChange) {
  const s = el("select", { id: `f${++uid}` }, options.map(([v, t]) => el("option", { value: v, text: t })));
  s.value = value; s.addEventListener("change", () => onChange(s.value));
  return el("div", { class: "field" }, el("label", { for: s.id, text: label }), s);
}
function buildPanel() {
  const panel = $("ed-panel"), fd = doc.footerData;
  const foot = el("input", { type: "checkbox", id: `f${++uid}` }); foot.checked = doc.footer; foot.addEventListener("change", () => { doc.footer = foot.checked; redraw(); });
  const settings = el("section", { class: "ed-settings" },
    inp("Titre du document", doc.title, (v) => { doc.title = v; }, { max: 160 }), inp("Sous-titre", doc.tagline, (v) => { doc.tagline = v; }, { max: 80 }),
    select("Fond", doc.theme, [["light", "Blanc"], ["dark", "Noir"]], (v) => { doc.theme = v; redraw(); }),
    select("Format", doc.format, [["a4", "A4"], ["a6", "A6 (carte)"]], (v) => { doc.format = v; redraw(); }),
    el("div", { class: "field" }, el("label", { for: foot.id, text: "Pied de page avec les contacts" }), foot),
    doc.footer ? el("div", {}, inp("Téléphone", fd.phone, (v) => { fd.phone = v; }, { max: 40 }), inp("E-mail", fd.email, (v) => { fd.email = v; }, { max: 120 }), inp("Site", fd.site, (v) => { fd.site = v; }, { max: 120 })) : null);
  const blocks = doc.blocks.map((b, i) => el("section", { class: "ed-block" },
    el("div", { class: "ed-block__head" }, el("strong", { text: BLOCKS[b.type] }), el("div", { class: "ed-mini" }, mini("↑", "Monter le bloc", () => move(doc.blocks, i, -1), i === 0), mini("↓", "Descendre le bloc", () => move(doc.blocks, i, 1), i === doc.blocks.length - 1), mini("✕", "Supprimer le bloc", () => { doc.blocks.splice(i, 1); redraw(); }))),
    blockFields(b)));
  const kind = select("Ajouter un bloc", "heading", Object.entries(BLOCKS), () => {});
  const add = el("div", { class: "ed-add" }, kind, mini("+ Ajouter", "Ajouter le bloc", () => { if (doc.blocks.length < 60) { doc.blocks.push(NEW[kind.querySelector("select").value]()); redraw(); } }));
  panel.replaceChildren(settings, ...blocks, add);
}

/* ---------- Export PNG / PDF ---------- */
const loaded = {};
const loadScript = (src) => new Promise((res, rej) => {
  if (loaded[src]) return res();
  const s = document.createElement("script"); s.src = src;
  s.onload = () => { loaded[src] = true; res(); }; s.onerror = () => rej(new Error("Chargement de la bibliothèque d'export impossible (connexion ?)."));
  document.head.append(s);
});
async function snapshot() {
  await loadScript(H2C);
  await Promise.all(["400", "500", "700"].map((w) => document.fonts.load(`${w} 20px Poppins`))); await document.fonts.ready;
  const holder = el("div", { class: "doc-offscreen" }), node = renderDoc(doc);
  holder.append(node); document.body.append(holder);
  try {
    await Promise.all([...node.querySelectorAll("img")].map((i) => i.decode().catch(() => {})));
    return await window.html2canvas(node, { scale: 2480 / 794, backgroundColor: null, useCORS: true, logging: false });
  } finally { holder.remove(); }
}
const slug = () => (doc.title || "document").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "document";
const fname = (ext) => `${slug()}-joey-${doc.format.toUpperCase()}-fond-${doc.theme === "dark" ? "noir" : "blanc"}.${ext}`;
const saveBlob = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
async function run(label, fn) { say(`${label}…`); try { await fn(); say(`${label} : terminé.`); } catch (e) { console.error(e); say(e.message || "Action impossible."); } }
const exportPng = () => run("Export PNG", async () => { const c = await snapshot(); await new Promise((r) => c.toBlob((b) => { saveBlob(b, fname("png")); r(); }, "image/png")); });
const exportPdf = () => run("Export PDF", async () => {
  const c = await snapshot(); await loadScript(PDF);
  const [w, h] = doc.format === "a4" ? [210, 297] : [105, 148];
  const pdf = new window.jspdf.jsPDF({ unit: "mm", format: doc.format, orientation: "portrait" });
  pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, w, h); pdf.save(fname("pdf"));
});

/* ---------- Enregistrement et documents ---------- */
async function save() {
  const title = doc.title.trim().slice(0, 160) || "Document sans titre";
  const q = currentId ? sb.from("team_documents").update({ title, doc }).eq("id", currentId) : sb.from("team_documents").insert({ title, doc });
  const { data, error } = await q.select("id").single();
  if (error) throw new Error("Enregistrement impossible : " + error.message + " (migration-team-editor.sql exécutée ?)");
  currentId = data.id; dirty = false;
}
async function listDocs(forceOpen = false) {
  const box = $("ed-docs"); box.hidden = forceOpen ? false : !box.hidden; if (box.hidden) return;
  box.replaceChildren(el("p", { text: "Chargement…" }));
  const { data, error } = await sb.from("team_documents").select("id,title,author_email,updated_at").order("updated_at", { ascending: false }).limit(100);
  if (error) { box.replaceChildren(el("p", { text: "Impossible de charger les documents : " + error.message })); return; }
  box.replaceChildren(...(data.length ? [] : [el("p", { text: "Aucun document enregistré." })]), ...data.map((d) => el("div", { class: "ed-docs__row" },
    el("span", { text: `${d.title} — ${d.author_email || "?"} — ${new Date(d.updated_at).toLocaleDateString("fr-FR")}` }),
    el("span", { class: "ed-mini" }, mini("Ouvrir", `Ouvrir ${d.title}`, async () => {
      if (dirty && !window.confirm("Les modifications non enregistrées seront perdues. Continuer ?")) return;
      const { data: row, error: e } = await sb.from("team_documents").select("doc").eq("id", d.id).single();
      if (e) return say("Ouverture impossible : " + e.message);
      doc = clean(row.doc); currentId = d.id; dirty = false; box.hidden = true; buildPanel(); preview(); say("Document ouvert.");
    }), mini("Supprimer", `Supprimer ${d.title}`, async () => {
      if (!window.confirm(`Supprimer « ${d.title} » ?`)) return;
      const { error: e } = await sb.from("team_documents").delete().eq("id", d.id);
      say(e ? "Suppression impossible : seul l'auteur ou un administrateur peut supprimer." : "Document supprimé.");
      if (!e && currentId === d.id) currentId = null; await listDocs(true);
    })))));
}
function fromTemplate(key) {
  if (dirty && !window.confirm("Les modifications non enregistrées seront perdues. Continuer ?")) return;
  doc = TEMPLATES[key][1](); currentId = null; dirty = false; buildPanel(); preview(); say(`Modèle « ${TEMPLATES[key][0]} » chargé.`);
}

async function main() {
  sb = await getClient();
  if (!sb) { say("L'éditeur n'est pas encore disponible."); return; }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.replace("equipe.html"); return; }
  const { data: ok } = await sb.rpc("is_team_member");
  if (ok !== true) { window.location.replace("equipe.html"); return; }
  const tpl = select("Nouveau depuis un modèle", "technique", Object.entries(TEMPLATES).map(([k, v]) => [k, v[0]]), () => {});
  $("ed-toolbar").append(tpl, mini("Créer", "Créer depuis le modèle", () => fromTemplate(tpl.querySelector("select").value)),
    mini("Enregistrer", "Enregistrer le document", () => run("Enregistrement", save)), mini("Mes documents", "Voir les documents enregistrés", () => listDocs()),
    mini("Télécharger en PNG", "Exporter en PNG", exportPng), mini("Télécharger en PDF", "Exporter en PDF", exportPdf));
  buildPanel(); preview();
}
main();
