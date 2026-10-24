// admin/js/qr.js — un QR code par page du site (affiches imprimables, export SVG / PNG)
import { requireAdmin, mountAdminBar } from "./auth.js";
import { getClient } from "../../js/api.js";
import qrcode from "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm";

document.documentElement.classList.remove("no-js");
const $ = (id) => document.getElementById(id);
const user = await requireAdmin();
if (!user) throw new Error("Non autorisé");
mountAdminBar($("admin-bar"), user, "qr.html");
$("app").hidden = false;

// Pages du site, regroupées. `file` = nom du fichier à la racine du site.
const GROUPS = [
  { title: "Pages publiques", pages: [
    { file: "index.html", label: "Accueil", tagline: "Scanne pour découvrir le groupe" },
    { file: "concerts.html", label: "Concerts", tagline: "Scanne pour voir les prochaines dates" },
    { file: "setlist.html", label: "Setlist", tagline: "Scanne pour voir la setlist" },
    { file: "materiel.html", label: "Matériel & groupe", tagline: "Scanne pour voir le matériel et le groupe" },
    { file: "merch.html", label: "Merch", tagline: "Scanne pour voir la boutique", note: "La page n'est visible que lorsque la boutique est ouverte (onglet Merch)." },
    { file: "contact.html", label: "Contact", tagline: "Scanne pour nous contacter" }
  ] },
  { title: "Espace équipe", pages: [
    { file: "equipe.html", label: "Espace équipe technique", tagline: "Accès réservé à l'équipe technique" },
    { file: "equipe-editeur.html", label: "Éditeur de documents", tagline: "Accès réservé à l'équipe technique" }
  ] },
  { title: "Mentions légales", pages: [
    { file: "cgu.html", label: "Conditions générales d'utilisation", tagline: "Scanne pour lire les CGU" },
    { file: "confidentialite.html", label: "Politique de confidentialité", tagline: "Scanne pour lire la politique de confidentialité" }
  ] }
];

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
const save = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
const slug = (file) => file.replace(/\.html$/, "");
let merchProducts = [];
try {
  const sb = await getClient();
  const { data, error } = sb ? await sb.from("merch_products").select("id,name,is_published").order("position", { ascending: true, nullsFirst: false }) : { data: null };
  if (!error && Array.isArray(data)) merchProducts = data;
} catch (e) { console.warn(e); }

function makeSvg(url) {
  const qr = qrcode(0, "M"); qr.addData(url); qr.make();
  return qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true });
}
function svgToPng(svgText, name) {
  const img = new Image(), u = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
  img.onload = () => {
    const c = document.createElement("canvas"); c.width = c.height = 1200;
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 1200, 1200);
    x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, 1200, 1200);
    URL.revokeObjectURL(u); c.toBlob((b) => save(b, name));
  };
  img.src = u;
}

// Imprime une seule affiche : on marque la carte, on imprime, on démarque.
function printOne(card) {
  document.body.classList.add("print-one"); card.classList.add("is-printing");
  const done = () => { document.body.classList.remove("print-one"); card.classList.remove("is-printing"); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done); window.print();
}

function buildCard(page, base) {
  const url = new URL(page.file, base).href;
  const svgText = makeSvg(url);
  const card = el("article", "qr-card");
  const poster = el("section", "qr-poster");
  poster.setAttribute("aria-label", `Affiche — ${page.label}`);
  const box = el("div", "qr-box");
  box.append(document.importNode(new DOMParser().parseFromString(svgText, "image/svg+xml").documentElement, true));
  poster.append(el("h2", null, page.label), el("p", null, page.tagline), box, el("p", "qr-url", url), el("p", null, "Joɘy · Tribute de Bullet For My Valentine"));
  const actions = el("div", "qr-card__actions no-print");
  const mk = (label, cls, fn) => { const b = el("button", `btn btn--small ${cls}`, label); b.type = "button"; b.addEventListener("click", fn); return b; };
  actions.append(
    mk("Imprimer", "btn--primary", () => printOne(card)),
    mk("SVG", "btn--ghost", () => save(new Blob([svgText], { type: "image/svg+xml" }), `qr-${page.fname || slug(page.file)}.svg`)),
    mk("PNG", "btn--ghost", () => svgToPng(svgText, `qr-${page.fname || slug(page.file)}.png`))
  );
  card.append(poster, actions);
  if (page.note) card.append(el("p", "qr-note no-print", page.note));
  return card;
}

function render() {
  const err = $("q-error"); err.textContent = "";
  const raw = $("q-base").value.trim();
  if (!/^https:\/\/\S+$/i.test(raw)) { err.textContent = "Indiquez une adresse en https://."; return; }
  const base = raw.endsWith("/") ? raw : raw + "/";
  const frag = document.createDocumentFragment();
  const productGroup = merchProducts.length ? { title: "Produits du merch (affiche de stand)", pages: merchProducts.map((p, i) => ({
    file: `merch.html#p-${p.id}`, fname: `produit-${String(i + 1).padStart(2, "0")}`, label: p.name, tagline: "Scanne pour voir ce produit",
    note: p.is_published ? "" : "Produit masqué : le lien ne montrera rien tant qu'il n'est pas visible dans la boutique."
  })) } : null;
  for (const g of productGroup ? [...GROUPS, productGroup] : GROUPS) {
    const section = el("section", "qr-group");
    section.append(el("h2", "no-print", g.title));
    const grid = el("div", "qr-grid");
    for (const p of g.pages) grid.append(buildCard(p, base));
    section.append(grid); frag.append(section);
  }
  $("q-groups").replaceChildren(frag);
}

// Adresse par défaut : la racine du site déduite de l'emplacement de l'admin (…/admin/qr.html → …/).
$("q-base").value = new URL("../", window.location.href).href;
$("q-base").addEventListener("input", render);
$("q-print-all").addEventListener("click", () => window.print());
render();
