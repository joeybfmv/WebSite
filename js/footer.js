// js/footer.js — pied de page commun à toutes les pages
import { CONFIG, isFilled } from "./config.js";
import { escapeHtml, safeUrl } from "./utils.js";

const SOCIAL_LABELS = { instagram: "Instagram", x: "X", facebook: "Facebook", youtube: "YouTube", tiktok: "TikTok", spotify: "Spotify", linktree: "Linktree" };

export function mountFooter(root) {
  if (!root) return;
  const { phone, phoneHref, email, emailHref } = CONFIG.contact;

  const phoneHtml = isFilled(phone) && phoneHref
    ? `<a href="tel:${escapeHtml(phoneHref)}">${escapeHtml(phone)}</a>`
    : `<span>Téléphone : <em>à renseigner</em></span>`;
  const emailHtml = isFilled(email) && emailHref
    ? `<a href="mailto:${escapeHtml(emailHref)}">${escapeHtml(email)}</a>`
    : `<span>E-mail : <em>à renseigner</em></span>`;

  const socials = Object.entries(CONFIG.socials)
    .map(([key, url]) => ({ key, url: safeUrl(url) }))
    .filter((s) => s.url)
    .map((s) => `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${SOCIAL_LABELS[s.key]}</a></li>`)
    .join("") || `<li><em>Réseaux sociaux à renseigner</em></li>`;

  root.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <section aria-labelledby="f-contact">
            <h2 id="f-contact">Contact</h2>
            <ul><li>${phoneHtml}</li><li>${emailHtml}</li><li><a href="contact.html">Page contact</a></li></ul>
          </section>
          <section aria-labelledby="f-social">
            <h2 id="f-social">Réseaux</h2>
            <ul>${socials}</ul>
          </section>
          <section aria-labelledby="f-legal">
            <h2 id="f-legal">Informations</h2>
            <ul>
              <li><a href="cgu.html">Conditions générales d'utilisation</a></li>
              <li><a href="confidentialite.html">Politique de confidentialité</a></li>
            </ul>
          </section>
        </div>
        <p class="footer-bottom">© 2026 ${CONFIG.stageName}. Tous droits réservés.</p>
        <p class="footer-bottom footer-tribute-note">Projet tribute indépendant, non affilié à Bullet for My Valentine.</p>
      </div>
    </footer>`;
}
