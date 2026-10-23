// notify — appelée par un Database Webhook (INSERT) : avertit Joɘy par e-mail et confirme la commande au client.
import { adminOrderMail, customerOrderMail, esc, sendMail } from "../_shared/mail.ts";

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("NOTIFY_SECRET") || !Deno.env.get("NOTIFY_SECRET")) {
    return new Response("Non autorisé", { status: 401 });
  }
  const { type, table, record } = await req.json();
  const admin = Deno.env.get("ADMIN_EMAIL");
  if (type !== "INSERT" || !record || !admin) return new Response("ok");
  const site = Deno.env.get("SITE_URL") ?? "";

  if (table === "contact_requests") {
    await sendMail(admin, `Demande de concert — ${record.name}`,
      `<div style="font-family:Arial,sans-serif"><h2>Nouvelle demande de concert</h2>
       <p><strong>${esc(record.name)}</strong> — <a href="mailto:${esc(record.email)}">${esc(record.email)}</a></p>
       <p>${esc(record.organization ?? "")} ${esc(record.city ?? "")} ${esc(record.event_date ?? "")}</p>
       <p style="white-space:pre-wrap">${esc(record.message)}</p>
       ${site ? `<p><a href="${esc(site)}admin/requests.html">Ouvrir les demandes</a></p>` : ""}</div>`, record.email);
  } else if (table === "merch_orders" && record.status === "new") {
    const a = adminOrderMail(record, false), c = customerOrderMail(record, false);
    await sendMail(admin, a.subject, a.html, record.email);
    await sendMail(record.email, c.subject, c.html, admin);
  }
  return new Response("ok");
});
