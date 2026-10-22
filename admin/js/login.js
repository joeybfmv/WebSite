// admin/js/login.js — formulaire de connexion
import { currentAdmin, signIn, isDemoMode } from "./auth.js";

document.documentElement.classList.remove("no-js");
const form = document.getElementById("login-form");
const status = document.getElementById("login-status");
const btn = document.getElementById("login-btn");

const show = (type, text) => {
  const p = document.createElement("p");
  p.className = `alert alert--${type}`;
  p.textContent = text;
  status.replaceChildren(p);
};

if (isDemoMode()) {
  show("err", "Supabase n'est pas configuré : renseignez l'URL et la clé publique dans js/config.js.");
  btn.disabled = true;
} else {
  currentAdmin().then((u) => { if (u) location.replace("index.html"); }).catch(() => {});
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = form.email.value.trim();
  const password = form.password.value;
  if (!email || !password) { show("err", "Saisissez votre e-mail et votre mot de passe."); return; }
  btn.disabled = true; btn.textContent = "Connexion…";
  try {
    await signIn(email, password);
    location.replace("index.html");
  } catch (err) {
    show("err", err.message || "Connexion impossible.");
    btn.disabled = false; btn.textContent = "Se connecter";
  }
});
