// admin/js/auth.js — authentification Supabase + garde d'accès de l'administration.
// La sécurité réelle est imposée par Supabase (RLS + table public.admins) ;
// ce fichier ne fait que rediriger proprement les visiteurs non autorisés.
import { getClient, isDemoMode } from "../../js/api.js";

export { isDemoMode };

/** Retourne l'utilisateur connecté s'il figure dans public.admins, sinon null. */
export async function currentAdmin() {
  const sb = await getClient();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data, error } = await sb.from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
  if (error || !data) return null;
  return session.user;
}

/** À appeler en tête des pages protégées. Redirige vers login.html si non autorisé. */
export async function requireAdmin() {
  try {
    const user = await currentAdmin();
    if (user) return user;
  } catch (err) { console.error(err); }
  location.replace("login.html");
  return null;
}

export async function signIn(email, password) {
  const sb = await getClient();
  if (!sb) throw new Error("Supabase n'est pas configuré (voir js/config.js).");
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Identifiants incorrects.");
  const user = await currentAdmin();
  if (!user) {
    await sb.auth.signOut();
    throw new Error("Ce compte n'est pas autorisé à administrer le site.");
  }
  return user;
}

export async function signOut() {
  const sb = await getClient();
  if (sb) await sb.auth.signOut();
  location.replace("login.html");
}

/** Barre supérieure commune aux pages d'administration. */
export function mountAdminBar(root, user, active) {
  const link = (href, label) => `<a class="btn btn--ghost btn--small" href="${href}"${active === href ? ' aria-current="page"' : ""}>${label}</a>`;
  root.innerHTML = `
    <div class="admin-bar"><div class="container admin-bar__inner">
      <a class="admin-bar__brand" href="index.html">Admin · Joɘy</a>
      <nav class="admin-bar__nav" aria-label="Administration">
        ${link("index.html", "Accueil")}${link("concerts.html", "Concerts")}${link("setlist.html", "Setlist")}${link("requests.html", "Demandes")}${link("merch.html", "Merch")}${link("merch-orders.html", "Commandes")}${link("qr.html", "QR code")}
        <a class="btn btn--ghost btn--small" href="../index.html" target="_blank" rel="noopener">Voir le site</a>
        <span class="admin-bar__user" title=""></span>
        <button class="btn btn--small btn--danger" type="button" id="logout-btn">Déconnexion</button>
      </nav>
    </div></div>`;
  root.querySelector(".admin-bar__user").textContent = user.email || "";
  root.querySelector("#logout-btn").addEventListener("click", signOut);
}
