// admin/js/dashboard.js
import { requireAdmin, mountAdminBar } from "./auth.js";
import { getClient } from "../../js/api.js";

document.documentElement.classList.remove("no-js");
const user = await requireAdmin();
if (user) {
  mountAdminBar(document.getElementById("admin-bar"), user, "index.html");
  document.getElementById("app").hidden = false;
  try {
    const sb = await getClient();
    const { count, error } = await sb.from("contact_requests").select("id", { count: "exact", head: true }).eq("status", "new");
    if (!error && count) document.getElementById("req-count").textContent = `${count} nouvelle${count > 1 ? "s" : ""} demande${count > 1 ? "s" : ""} à traiter.`;
  } catch (e) { console.warn(e); }
}
