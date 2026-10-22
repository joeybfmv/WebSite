// js/navigation.js — en-tête + menu mobile accessible
import { CONFIG } from "./config.js";
import { logoHTML } from "./logo.js";

const LINKS = [
  { href: "index.html", label: "Accueil" },
  { href: "concerts.html", label: "Concerts" },
  { href: "setlist.html", label: "Setlist" },
  { href: "materiel.html", label: "Matériel & groupe" },
  { href: "contact.html", label: "Contact" }
];

function currentPage() {
  const last = location.pathname.split("/").pop();
  return last === "" ? "index.html" : last;
}

export function mountNavigation(root) {
  if (!root) return;
  const page = currentPage();
  const items = LINKS.map((l) => `<li><a href="${l.href}"${l.href === page ? ' aria-current="page"' : ""}>${l.label}</a></li>`).join("");
  root.innerHTML = `
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="index.html" aria-label="${CONFIG.stageName} — accueil">${logoHTML()}</a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Ouvrir le menu">
          <span></span><span></span><span></span>
        </button>
        <nav class="primary-nav" id="primary-nav" aria-label="Navigation principale"><ul>${items}</ul></nav>
      </div>
    </header>`;

  const toggle = root.querySelector(".nav-toggle");
  const nav = root.querySelector(".primary-nav");
  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
  };
  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { setOpen(false); toggle.focus(); } });
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  window.matchMedia("(min-width: 821px)").addEventListener("change", () => setOpen(false));
}
