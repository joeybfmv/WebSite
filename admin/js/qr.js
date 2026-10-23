// admin/js/qr.js — QR code du merch (affiche imprimable)
import { requireAdmin, mountAdminBar } from "./auth.js";
import qrcode from "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm";

document.documentElement.classList.remove("no-js");
const $ = (id) => document.getElementById(id);
const user = await requireAdmin();
if (!user) throw new Error("Non autorisé");
mountAdminBar($("admin-bar"), user, "qr.html");
$("app").hidden = false;
$("q-url").value = new URL("../merch.html", window.location.href).href;
let svgText = "";

function draw() {
  const err = $("q-error"); err.textContent = "";
  const url = $("q-url").value.trim();
  if (!/^https:\/\/\S+$/i.test(url)) { err.textContent = "Indiquez une adresse en https://."; return; }
  const qr = qrcode(0, "M"); qr.addData(url); qr.make();
  svgText = qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true });
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  $("q-box").replaceChildren(document.importNode(doc.documentElement, true));
  $("q-text").textContent = url;
}
const save = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
$("q-url").addEventListener("input", draw);
$("q-print").addEventListener("click", () => window.print());
$("q-svg").addEventListener("click", () => svgText && save(new Blob([svgText], { type: "image/svg+xml" }), "qr-merch.svg"));
$("q-png").addEventListener("click", () => {
  if (!svgText) return;
  const img = new Image(), u = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
  img.onload = () => { const c = document.createElement("canvas"); c.width = c.height = 1200; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 1200, 1200); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, 1200, 1200); URL.revokeObjectURL(u); c.toBlob((b) => save(b, "qr-merch.png")); };
  img.src = u;
});
draw();
