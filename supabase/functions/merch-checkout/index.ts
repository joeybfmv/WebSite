// merch-checkout — crée une commande « à payer » et une session Stripe Checkout.
// Les prix viennent TOUJOURS de la base (jamais du navigateur).
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN = Deno.env.get("SITE_ORIGIN") ?? "*";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 20000) return json({ error: "Requête trop volumineuse." }, 413);
    const b = JSON.parse(raw);
    const name = String(b.name ?? "").trim(), email = String(b.email ?? "").trim();
    if (name.length < 2 || name.length > 120) return json({ error: "Nom invalide." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return json({ error: "E-mail invalide." }, 400);
    if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 30) return json({ error: "Panier invalide." }, 400);
    // deno-lint-ignore no-explicit-any
    const items = b.items.map((i: any) => ({ id: String(i.id), qty: Number(i.qty), variant: i.variant ? String(i.variant) : null }));

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: order, error } = await sb.from("merch_orders")
      .insert({ name, email, message: b.message ? String(b.message).slice(0, 1000) : null, items, status: "pending_payment", payment_method: "online" })
      .select().single();
    if (error) return json({ error: error.message }, 400);

    const site = (Deno.env.get("SITE_URL") ?? "").replace(/\/?$/, "/");
    const p = new URLSearchParams({
      mode: "payment", customer_email: email, "metadata[order_id]": order.id,
      success_url: `${site}merch.html?paid=1`, cancel_url: `${site}merch.html?canceled=1`,
      expires_at: String(Math.floor(Date.now() / 1000) + 1900),
    });
    // deno-lint-ignore no-explicit-any
    order.items.forEach((i: any, n: number) => {
      p.set(`line_items[${n}][quantity]`, String(i.qty));
      p.set(`line_items[${n}][price_data][currency]`, "eur");
      p.set(`line_items[${n}][price_data][unit_amount]`, String(Math.round(Number(i.price) * 100)));
      p.set(`line_items[${n}][price_data][product_data][name]`, i.variant ? `${i.name} (${i.variant})` : i.name);
    });
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: p,
    });
    const s = await r.json();
    if (!r.ok || !s.url) {
      console.error("Stripe", JSON.stringify(s));
      await sb.from("merch_orders").update({ status: "cancelled" }).eq("id", order.id);
      return json({ error: "Le paiement en ligne est momentanément indisponible." }, 502);
    }
    await sb.from("merch_orders").update({ stripe_session_id: s.id }).eq("id", order.id);
    return json({ url: s.url });
  } catch (e) {
    console.error(e);
    return json({ error: "Requête invalide." }, 400);
  }
});
