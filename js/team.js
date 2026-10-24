// js/team.js — espace équipe technique : connexion + téléchargement des fichiers (stockage privé Supabase)
import { getClient } from "./api.js";
import { el, stateError } from "./utils.js";

const root = document.getElementById("team-root");
const BUCKET = "team-files";
const KINDS = [["fiche-technique", "Fiche technique"], ["fiche-guitar-tech", "Fiche guitar tech"], ["setlist", "Setlist"], ["annonce-animateur", "Annonce animateur"], ["si-ca-se-passe-mal", "Si ça se passe mal"], ["carte-contact", "Carte de contact"]];
const MAX_ZIP = 120 * 1024 * 1024;
let sb = null;

function label(name) {
  const base = name.replace(/\.[^.]+$/, "").toLowerCase();
  const kind = KINDS.find(([k]) => base.includes(k));
  if (!kind) return name;
  const fmt = (base.match(/a\d/) || [""])[0].toUpperCase(), fond = (base.match(/fond-(blanc|noir)/) || [])[1];
  return [kind[1], [fmt, fond ? `fond ${fond}` : ""].filter(Boolean).join(" · ")].filter(Boolean).join(" — ");
}
const size = (n) => (!Number.isFinite(n) ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);
const save = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const btn = (text, cls, fn) => { const b = el("button", { class: `btn btn--small ${cls}`, type: "button", text }); b.addEventListener("click", async () => { b.disabled = true; try { await fn(); } catch (e) { console.error(e); window.alert(e.message || "Action impossible."); } b.disabled = false; }); return b; };

async function signedUrl(name) {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(name, 120, { download: name });
  if (error) throw new Error("Lien indisponible : " + error.message);
  return data.signedUrl;
}
async function download(name) { const a = document.createElement("a"); a.href = await signedUrl(name); a.rel = "noopener"; document.body.append(a); a.click(); a.remove(); }

async function zipContent(file, holder) {
  if (holder.childElementCount) { holder.replaceChildren(); return; }
  if ((file.metadata?.size || 0) > MAX_ZIP) throw new Error("Archive trop volumineuse pour être ouverte ici : téléchargez-la.");
  holder.append(el("p", { text: "Ouverture de l'archive…" }));
  const { default: JSZip } = await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
  const res = await fetch(await signedUrl(file.name));
  if (!res.ok) throw new Error("Téléchargement impossible.");
  const zip = await JSZip.loadAsync(await res.arrayBuffer());
  const entries = Object.values(zip.files).filter((f) => !f.dir && !f.name.split("/").some((p) => p.startsWith(".") || p === "__MACOSX"));
  holder.replaceChildren(...entries.map((f) => {
    const short = f.name.split("/").pop();
    return el("div", { class: "team-file" }, el("div", {}, el("h2", { text: label(short) }), el("p", { class: "team-file__meta", text: f.name })),
      el("div", { class: "team-file__actions" },
        /\.(png|jpe?g)$/i.test(short) && btn("Aperçu", "btn--ghost", async () => { const b = await f.async("blob"); window.open(URL.createObjectURL(new Blob([b], { type: /\.png$/i.test(short) ? "image/png" : "image/jpeg" })), "_blank", "noopener"); }),
        btn("Télécharger", "btn--primary", async () => save(await f.async("blob"), short))));
  }));
}

async function showFiles() {
  const out = el("div");
  root.replaceChildren(el("div", { class: "team-bar" }, el("p", { text: "Connecté à l'espace équipe." }), el("a", { class: "btn btn--small btn--primary", href: "equipe-editeur.html", text: "Éditeur de documents" }), btn("Se déconnecter", "btn--ghost", async () => { await sb.auth.signOut(); showLogin(); })), out);
  const { data, error } = await sb.storage.from(BUCKET).list("", { limit: 200, sortBy: { column: "name", order: "asc" } });
  if (error) { out.append(stateError("Impossible de charger les fichiers : " + error.message)); return; }
  const files = (data || []).filter((f) => f.id && !f.name.startsWith("."));
  if (!files.length) { out.append(el("p", { text: "Aucun fichier pour le moment." })); return; }
  for (const f of files) {
    const holder = el("div", { class: "team-zip" });
    const isZip = /\.zip$/i.test(f.name);
    out.append(el("div", { class: "team-file" }, el("div", {}, el("h2", { text: label(f.name) }), el("p", { class: "team-file__meta", text: `${f.name} · ${size(f.metadata?.size)}` })),
      el("div", { class: "team-file__actions" }, isZip && btn("Voir le contenu", "btn--ghost", () => zipContent(f, holder)), btn("Télécharger", "btn--primary", () => download(f.name)))), holder);
  }
}

async function enter() {
  const { data, error } = await sb.rpc("is_team_member");
  if (error || data !== true) { await sb.auth.signOut(); showLogin("Ce compte n'a pas accès à l'espace équipe."); return; }
  await showFiles();
}

function showLogin(message = "") {
  const status = el("p", { role: "alert", text: message });
  const submit = el("button", { class: "btn btn--primary", type: "submit", text: "Se connecter" });
  const field = (id, lab, attrs) => el("div", { class: "field" }, el("label", { for: id, text: lab }), el("input", { id, name: id, required: "", ...attrs }));
  const form = el("form", { class: "team-login", novalidate: "" }, el("h2", { text: "Connexion" }),
    field("t-email", "E-mail", { type: "email", autocomplete: "username" }), field("t-pass", "Mot de passe", { type: "password", autocomplete: "current-password" }), submit, status);
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); status.textContent = ""; submit.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: form.elements["t-email"].value.trim(), password: form.elements["t-pass"].value });
    submit.disabled = false;
    if (error) { status.textContent = "Identifiants incorrects."; return; }
    await enter();
  });
  root.replaceChildren(form);
}

async function main() {
  sb = await getClient();
  if (!sb) { root.replaceChildren(el("p", { text: "L'espace équipe n'est pas encore disponible." })); return; }
  const { data: { session } } = await sb.auth.getSession();
  if (session) await enter(); else showLogin();
}
main();
