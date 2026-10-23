// stripe-webhook — confirme le paiement (signature vérifiée), met la commande en « paid » (le stock baisse via SQL)
import { createClient } from "npm:@supabase/supabase-js@2";
import { adminOrderMail, customerOrderMail, sendMail } from "../_shared/mail.ts";

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function verify(body: string, header: string, secret: string) {
  const parts = header.split(",");
  const t = parts.find((p) => p.startsWith("t="))?.slice(2);
  const sigs = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)));
  return sigs.includes(mac);
}

Deno.serve(async (req) => {
  const body = await req.text();
  const ok = await verify(body, req.headers.get("stripe-signature") ?? "", Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "");
  if (!ok) return new Response("Signature invalide", { status: 400 });
  const event = JSON.parse(body);
  const s = event.data?.object;
  const orderId = s?.metadata?.order_id;
  if (!orderId) return new Response("ok");
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type) && s.payment_status === "paid") {
    const { data: order } = await sb.from("merch_orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", orderId).eq("status", "pending_payment").select().maybeSingle();
    if (order) {            // première réception seulement (pas de doublon d'e-mails)
      const c = customerOrderMail(order, true), a = adminOrderMail(order, true);
      await sendMail(order.email, c.subject, c.html, Deno.env.get("ADMIN_EMAIL"));
      const admin = Deno.env.get("ADMIN_EMAIL");
      if (admin) await sendMail(admin, a.subject, a.html, order.email);
    }
  } else if (event.type === "checkout.session.expired") {
    await sb.from("merch_orders").update({ status: "cancelled" }).eq("id", orderId).eq("status", "pending_payment");
  }
  return new Response("ok");
});
