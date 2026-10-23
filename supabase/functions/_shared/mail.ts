// _shared/mail.ts — envoi d'e-mails via Resend + modèles
export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n));

export async function sendMail(to: string, subject: string, html: string, replyTo?: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM") ?? "Joɘy <onboarding@resend.dev>";
  if (!key) { console.warn("RESEND_API_KEY manquant : e-mail non envoyé"); return false; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!r.ok) console.error("Resend", r.status, await r.text());
  return r.ok;
}

const wrap = (inner: string) =>
  `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111">${inner}<hr style="border:none;border-top:1px solid #ddd;margin:24px 0"><p style="font-size:12px;color:#666">Joɘy — Tribute de Bullet For My Valentine</p></div>`;

// deno-lint-ignore no-explicit-any
const lines = (items: any[]) =>
  `<ul>${items.map((i) => `<li>${esc(i.qty)} × ${esc(i.name)}${i.variant ? ` (${esc(i.variant)})` : ""} — ${eur(i.price * i.qty)}</li>`).join("")}</ul>`;

// deno-lint-ignore no-explicit-any
export function customerOrderMail(o: any, paid: boolean) {
  const ref = String(o.id).slice(0, 8).toUpperCase();
  return {
    subject: paid ? `Paiement reçu — commande ${ref}` : `Demande de commande reçue — ${ref}`,
    html: wrap(`<h2>Merci ${esc(o.name)} !</h2>
      <p>${paid ? "Ton paiement est bien reçu. Ta commande est confirmée." : "Ta demande de commande est bien enregistrée. Aucun paiement n'a été effectué : je te recontacte pour la remise (par exemple lors d'un concert) et le règlement."}</p>
      <p><strong>Commande ${esc(ref)}</strong></p>${lines(o.items)}
      <p><strong>Total : ${eur(o.total)}</strong></p>
      <p>Pour toute question, réponds simplement à cet e-mail.</p>`),
  };
}

// deno-lint-ignore no-explicit-any
export function adminOrderMail(o: any, paid: boolean) {
  const site = Deno.env.get("SITE_URL") ?? "";
  return {
    subject: `${paid ? "Commande PAYÉE" : "Nouvelle demande de commande"} — ${o.name} (${eur(o.total)})`,
    html: wrap(`<h2>${paid ? "Commande payée en ligne" : "Nouvelle demande de commande"}</h2>
      <p>${esc(o.name)} — <a href="mailto:${esc(o.email)}">${esc(o.email)}</a></p>${lines(o.items)}
      <p><strong>Total : ${eur(o.total)}</strong></p>${o.message ? `<p>Message : ${esc(o.message)}</p>` : ""}
      ${site ? `<p><a href="${esc(site)}admin/merch-orders.html">Ouvrir les commandes</a></p>` : ""}`),
  };
}
