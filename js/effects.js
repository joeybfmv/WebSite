// js/effects.js — effets visuels (aucune dépendance). Respecte « réduire les animations ».
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = window.matchMedia("(pointer: fine)").matches;

function scrollEffects() {
  const bar = document.createElement("div");
  bar.className = "scroll-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.append(bar);
  const hero = document.querySelector(".hero");
  let tick = false;
  const update = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.setProperty("--p", max > 0 ? (y / max).toFixed(4) : 0);
    document.querySelector(".site-header")?.classList.toggle("is-scrolled", y > 40);
    if (hero && !reduce && y < window.innerHeight) hero.style.setProperty("--py", `${Math.round(y * 0.3)}px`);
    tick = false;
  };
  window.addEventListener("scroll", () => { if (!tick) { tick = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

function cardGlow() {
  if (!fine) return;
  document.addEventListener("pointermove", (e) => {
    const card = e.target.closest?.(".card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--gx", `${e.clientX - r.left}px`);
    card.style.setProperty("--gy", `${e.clientY - r.top}px`);
  }, { passive: true });
}

/** Braises + fumée dans le hero (canvas). Mis en pause hors écran. */
function heroSmoke() {
  const hero = document.querySelector(".hero");
  if (!hero || reduce) return;
  const cv = document.createElement("canvas");
  cv.className = "hero__fx";
  cv.setAttribute("aria-hidden", "true");
  hero.prepend(cv);
  const ctx = cv.getContext("2d");
  let w = 0, h = 0, run = true;
  const resize = () => { w = cv.width = hero.clientWidth; h = cv.height = hero.clientHeight; };
  resize();
  window.addEventListener("resize", resize);
  const mk = (smoke) => ({ x: Math.random() * w, y: smoke ? h + Math.random() * 100 : Math.random() * h, r: smoke ? 90 + Math.random() * 140 : 1 + Math.random() * 2.2, vy: smoke ? 0.15 + Math.random() * 0.25 : 0.4 + Math.random() * 1.1, vx: (Math.random() - 0.5) * 0.4, a: Math.random(), smoke });
  const small = window.matchMedia("(max-width: 700px)").matches;
  const ps = [...Array.from({ length: small ? 5 : 9 }, () => mk(true)), ...Array.from({ length: small ? 26 : 55 }, () => mk(false))];
  function frame() {
    if (!run) return;
    ctx.clearRect(0, 0, w, h);
    for (const p of ps) {
      p.y -= p.vy; p.x += p.vx + Math.sin((p.y + p.a * 100) / 60) * 0.25;
      if (p.y < -p.r) Object.assign(p, mk(p.smoke), { y: h + p.r });
      if (p.smoke) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, "rgba(120,110,105,.10)"); g.addColorStop(1, "rgba(120,110,105,0)");
        ctx.fillStyle = g; ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      } else {
        const a = 0.35 + 0.65 * Math.abs(Math.sin(performance.now() / 400 + p.a * 10));
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fillStyle = `rgba(255,${59 + Math.round(p.a * 60)},${40},${a})`;
        ctx.shadowColor = "#ff3b3b"; ctx.shadowBlur = small ? 4 : 10; ctx.fill(); ctx.shadowBlur = 0;
      }
    }
    requestAnimationFrame(frame);
  }
  new IntersectionObserver(([en]) => { const was = run; run = en.isIntersecting; if (run && !was) frame(); }).observe(hero);
  frame();
  if (fine) hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    hero.style.setProperty("--mx", `${e.clientX - r.left}px`);
    hero.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, { passive: true });
}

export function mountEffects() { scrollEffects(); cardGlow(); heroSmoke(); }
