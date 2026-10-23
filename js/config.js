// js/config.js — Configuration centralisée du site.
// ⚠ Aucun secret ici. Seules les clés PUBLIQUES Supabase (anon / publishable) sont autorisées.
// Toute valeur commençant par "À COMPLÉTER" est considérée comme non renseignée :
// elle n'est pas affichée comme une vraie donnée (voir isFilled()).

export const TODO = "À COMPLÉTER";

export const CONFIG = {
  stageName: "Joɘy",
  tagline: "Tribute de BFMV (Bullet for My Valentine)",
  description:
    "Joɘy — guitariste et projet tribute à Bullet for My Valentine. Concerts, setlist, matériel et contact.",
  siteUrl: "https://waywardship.github.io/WebSite/",
  contactPageUrl: "https://waywardship.github.io/WebSite/contact.html",

  contact: {
    phone: "07 69 34 10 08",
    phoneHref: "+33769341008",
    email: "joeybfmv.contact@gmail.com",
    emailHref: "joeybfmv.contact@gmail.com"
  },

  // Laisser "" pour masquer un réseau.
  socials: {
    instagram: "",
    facebook: "",
    youtube: "https://www.youtube.com/@JoeyBFMV",
    tiktok: "https://www.tiktok.com/@joey.bfmv?lang=fr",
    spotify: ""
  },

  features: {
    merch: false // passer à true le jour où l'onglet Merch doit apparaître au public
  },

  officialLinks: {
    bfmvWebsite: "https://www.bulletformyvalentine.com/", // site officiel du groupe
    waywardShip: {
      website: "https://waywardship.github.io/WebSite/",
      instagram: "",
      facebook: "",
      youtube: "",
      spotify: ""
    }
  },

  // Paramètres PUBLICS Supabase (Project Settings > API).
  // Tant qu'ils sont vides, le site fonctionne en MODE DÉMO avec des données fictives.
  supabase: {
    url: "https://elcdvzokmhunvhqwtaod.supabase.co",
    anonKey: "sb_publishable_khjWfBsCfJAttfxdlEZDOQ_i0y1MSp8", // clé publique UNIQUEMENT
    posterBucket: "posters"
  },

  // Anti-spam du formulaire (côté client ; des garde-fous existent aussi côté base)
  contactForm: { minFillSeconds: 4, cooldownMinutes: 2 },

  locale: "fr-FR",
  timeZone: "Europe/Paris"
};

export const isFilled = (v) => typeof v === "string" && v.trim() !== "" && !v.startsWith(TODO);
export const isConfigured = () => isFilled(CONFIG.supabase.url) && isFilled(CONFIG.supabase.anonKey);
