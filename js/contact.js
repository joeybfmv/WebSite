// js/contact.js — coordonnées, texte du projet et formulaire « Proposer un concert »
import { CONFIG, isFilled } from "./config.js";
import { CONTENT } from "./content.js";
import { submitContactRequest } from "./api.js";
import { el, safeUrl } from "./utils.js";

/* ---------- Coordonnées ---------- */
const { phone, phoneHref, email, emailHref } = CONFIG.contact;
const methods = document.getElementById("contact-methods");
const actions = document.getElementById("contact-actions");

const row = (label, value, href) =>
  el("li", {}, el("span", { class: "lbl", text: label }), href ? el("a", { class: "val", href, text: value }) : el("span", { class: "val", text: value }));

methods.append(
  row("Téléphone", isFilled(phone) ? phone : "À renseigner", isFilled(phone) && phoneHref ? `tel:${phoneHref}` : ""),
  row("E-mail", isFilled(email) ? email : "À renseigner", isFilled(email) && emailHref ? `mailto:${emailHref}` : "")
);
if (emailHref && isFilled(email)) actions.append(el("a", { class: "btn btn--primary", href: `mailto:${emailHref}`, text: "Envoyer un e-mail" }));
if (phoneHref && isFilled(phone)) actions.append(el("a", { class: "btn btn--ghost", href: `tel:${phoneHref}`, text: "Appeler" }));
if (!actions.children.length) actions.append(el("p", { class: "placeholder-note", text: "Coordonnées à renseigner dans js/config.js." }));

const socials = Object.entries(CONFIG.socials).map(([k, u]) => [k, safeUrl(u)]).filter(([, u]) => u);
const socialsBox = document.getElementById("contact-socials");
socialsBox.append(el("h3", { text: "Réseaux sociaux" }));
if (socials.length) {
  socialsBox.append(el("ul", { class: "socials-list" }, socials.map(([k, u]) => el("li", {}, el("a", { class: "btn btn--small btn--ghost", href: u, target: "_blank", rel: "noopener noreferrer", text: k[0].toUpperCase() + k.slice(1) })))));
} else socialsBox.append(el("p", { class: "mt-4", text: "Liens à venir." }));

/* ---------- Texte du projet ---------- */
const pt = document.getElementById("project-text");
CONTENT.project.paragraphs.forEach((p) => pt.append(el("p", { text: p })));
if (CONTENT.project.placeholder) pt.append(el("p", { class: "placeholder-note", text: "Texte définitif à fournir." }));

/* ---------- Formulaire ---------- */
const form = document.getElementById("contact-form");
const status = document.getElementById("cf-status");
const submit = document.getElementById("cf-submit");
const msg = document.getElementById("cf-message");
const counter = document.getElementById("cf-count");
const openedAt = Date.now();
const LS_KEY = "joey:last-contact";

msg.addEventListener("input", () => { counter.textContent = String(msg.value.length); });

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const clean = (s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();

function setError(name, text) {
  const span = form.querySelector(`[data-error-for="${name}"]`);
  const input = form.elements[name];
  if (span) span.textContent = text || "";
  if (input) input.setAttribute("aria-invalid", text ? "true" : "false");
}

function validate(v) {
  let ok = true;
  const check = (name, bad, text) => { setError(name, bad ? text : ""); if (bad) ok = false; };
  check("name", v.name.length < 2, "Indiquez votre nom (2 caractères minimum).");
  check("email", !EMAIL_RE.test(v.email), "Indiquez une adresse e-mail valide.");
  check("message", v.message.length < 10, "Votre message doit contenir au moins 10 caractères.");
  check("consent", !v.consent, "Votre accord est nécessaire pour envoyer la demande.");
  if (v.event_date) {
    const d = new Date(v.event_date + "T00:00:00");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    check("event_date", Number.isNaN(d.getTime()) || d < today, "La date envisagée doit être aujourd'hui ou dans le futur.");
  } else setError("event_date", "");
  return ok;
}

function showStatus(type, text) {
  status.replaceChildren(el("p", { class: `alert alert--${type}`, text }));
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  status.replaceChildren();

  const fd = new FormData(form);
  const v = {
    name: clean(fd.get("name") || ""), email: clean(fd.get("email") || "").toLowerCase(),
    organization: clean(fd.get("organization") || ""), city: clean(fd.get("city") || ""),
    event_date: fd.get("event_date") || "", message: clean(fd.get("message") || ""),
    consent: form.elements.consent.checked
  };

  // Anti-spam : champ piège, délai minimal de remplissage, délai entre deux envois
  if (fd.get("website")) { showStatus("ok", "Merci, votre demande a bien été envoyée."); return; } // bots : silence
  if ((Date.now() - openedAt) / 1000 < CONFIG.contactForm.minFillSeconds) { showStatus("err", "Merci de patienter quelques secondes avant d'envoyer."); return; }
  try {
    const last = Number(localStorage.getItem(LS_KEY) || 0);
    if (Date.now() - last < CONFIG.contactForm.cooldownMinutes * 60000) { showStatus("err", "Une demande vient d'être envoyée. Réessayez dans quelques minutes."); return; }
  } catch { /* stockage indisponible : on continue */ }

  if (!validate(v)) { showStatus("err", "Certains champs sont à corriger."); form.querySelector('[aria-invalid="true"]')?.focus(); return; }

  submit.disabled = true; submit.textContent = "Envoi en cours…";
  try {
    const { demo } = await submitContactRequest({
      name: v.name, email: v.email, organization: v.organization || null, city: v.city || null,
      event_date: v.event_date || null, message: v.message
    });
    try { localStorage.setItem(LS_KEY, String(Date.now())); } catch { /* ignore */ }
    form.reset(); counter.textContent = "0";
    showStatus("ok", demo
      ? "Mode démo : rien n'a été envoyé (Supabase non configuré). Le formulaire fonctionne."
      : "Merci ! Votre demande a bien été envoyée. Vous recevrez une réponse par e-mail.");
  } catch (err) {
    console.error(err);
    showStatus("err", "L'envoi a échoué. Vérifiez vos informations ou contactez-moi directement par e-mail.");
  } finally {
    submit.disabled = false; submit.textContent = "Envoyer ma demande";
  }
});
