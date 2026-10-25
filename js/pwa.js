// js/pwa.js — service worker + invitation à installer le site comme une application (PWA).
//  • Android / Chrome : bouton « Installer » (événement beforeinstallprompt).
//  • iPhone / iPad (Safari) : mode d'emploi « Partager → Sur l'écran d'accueil » (Apple n'a pas d'API d'installation).
// L'invitation n'apparaît que sur mobile, jamais si le site est déjà installé, et pas plus d'une fois toutes les 2 semaines.
const KEY = "joey_pwa_v1";
const COOLDOWN_MS = 14 * 24 * 3600 * 1000;
const DELAY_MS = 4000;

const ua = navigator.userAgent || "";
const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);
const inAppBrowser = /FBAN|FBAV|Instagram|Snapchat|TikTok|musical_ly|Twitter|Line\//i.test(ua); // navigateurs intégrés : pas d'installation possible
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

function readState() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } }
function writeState(patch) { try { localStorage.setItem(KEY, JSON.stringify({ ...readState(), ...patch })); } catch { /* stockage indisponible */ } }
function shouldShow() {
  const s = readState();
  if (s.installed) return false;
  return !s.dismissedAt || Date.now() - s.dismissedAt > COOLDOWN_MS;
}

let deferredPrompt = null;
let banner = null;
let timer = null;

function closeBanner(remember) {
  if (remember) writeState({ dismissedAt: Date.now() });
  banner?.remove(); banner = null;
}

const SHARE_ICON = '<svg class="install-banner__share" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';

function showBanner(mode) {
  if (banner || isStandalone() || !shouldShow()) return;
  banner = document.createElement("section");
  banner.className = "install-banner";
  banner.setAttribute("aria-label", "Installer l'application");

  const icon = document.createElement("img");
  icon.className = "install-banner__icon"; icon.src = "assets/icons/icon-192.png"; icon.alt = ""; icon.width = 48; icon.height = 48;

  const body = document.createElement("div");
  body.className = "install-banner__body";
  const title = document.createElement("strong");
  title.className = "install-banner__title"; title.textContent = "Installer Joɘy";
  const text = document.createElement("p");
  text.className = "install-banner__text";
  if (mode === "ios") text.innerHTML = `Touche ${SHARE_ICON} <b>Partager</b>, puis <b>« Sur l'écran d'accueil »</b> pour avoir le site comme une appli.`;
  else text.textContent = "Ajoute le site à ton écran d'accueil : accès rapide, plein écran, même hors connexion.";
  body.append(title, text);

  const actions = document.createElement("div");
  actions.className = "install-banner__actions";
  if (mode === "prompt") {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "btn btn--primary btn--small"; btn.textContent = "Installer";
    btn.addEventListener("click", async () => {
      if (!deferredPrompt) return closeBanner(false);
      const evt = deferredPrompt; deferredPrompt = null;
      evt.prompt();
      const { outcome } = await evt.userChoice.catch(() => ({ outcome: "dismissed" }));
      if (outcome === "accepted") writeState({ installed: true });
      closeBanner(outcome !== "accepted");
    });
    actions.append(btn);
  }
  const close = document.createElement("button");
  close.type = "button"; close.className = "install-banner__close"; close.setAttribute("aria-label", "Fermer"); close.textContent = "✕";
  close.addEventListener("click", () => closeBanner(true));
  actions.append(close);

  banner.append(icon, body, actions);
  document.body.append(banner);
}

function schedule(mode) {
  clearTimeout(timer);
  timer = setTimeout(() => showBanner(mode), DELAY_MS);
}

export function initPwa() {
  // 1. Service worker (site installable + hors ligne)
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch((e) => console.warn("[pwa] service worker :", e)));
  }

  if (isStandalone() || inAppBrowser || !(isIOS || isAndroid)) return;

  // 2. Android / Chrome : le navigateur annonce que le site est installable
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    schedule("prompt");
  });
  window.addEventListener("appinstalled", () => { writeState({ installed: true }); deferredPrompt = null; closeBanner(false); });

  // 3. iPhone / iPad : pas d'événement, on affiche le mode d'emploi
  if (isIOS) schedule("ios");
}
