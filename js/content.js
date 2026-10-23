// js/content.js — Textes éditoriaux du site. TOUS les textes marqués `placeholder: true`
// sont temporaires et affichés comme tels. Remplacez-les puis passez `placeholder` à false.
import { CONFIG } from "./config.js";

export const CONTENT = {
  about: {
    placeholder: false,
    title: "Qui suis-je ?",
    paragraphs: [
      "Depuis longtemps, je suis fan de BFMV : c'est mon groupe n° 1. C'est en partie grâce à eux que j'ai atteint un certain niveau à la guitare et que j'ai de grosses influences metalcore. Ils sont plus qu'un groupe : une vraie inspiration pour ma vie. Et grâce à eux, je me lance aujourd'hui sur scène pour vous faire pogoter !",
      "Alors, prêts à ce qu'un ado de 17 ans vienne casser la scène ?"
    ],
    photo: "assets/images/band/placeholder.svg",
    photoAlt: "Photo de Joɘy (à remplacer)"
  },

  bfmv: {
    title: "Bullet for My Valentine",
    // Photo à remplacer par une image dont vous détenez les droits (assets/images/band/).
    photo: "assets/images/band/bfmv.jpg",
    photoAlt: "Photographie de groupe pour la présentation de Bullet for My Valentine",
    paragraphs: [
      "Bullet for My Valentine est un groupe de metal originaire de Bridgend, au Pays de Galles. Formé à la fin des années 1990 sous un autre nom, il adopte son nom actuel au début des années 2000.",
      "Son premier album, The Poison (2005), l'impose sur la scène metalcore et alternative metal, avec un mélange de riffs lourds, de leads de guitare mélodiques et de refrains fédérateurs. Scream Aim Fire (2008), Fever (2010) et Temper Temper (2013) prolongent cette identité avant d'autres albums publiés ces dernières années.",
      "Ce site est un projet tribute indépendant : il n'est ni affilié, ni approuvé par le groupe."
    ]
  },

  project: {
    placeholder: false,
    title: "Le concept du tribute",
    paragraphs: [
      "Un tribute de BFMV avec moi à la guitare uniquement : le reste du groupe est en backing track, ou bien juste la guitare.",
      "Aucune disponibilité, aucun tarif et aucune condition de prestation ne sont annoncés tant qu'ils ne sont pas confirmés."
    ]
  },

  waywardShip: {
    placeholder: false,
    title: "Wayward Ship",
    teaser: "Mon groupe, distinct de ce projet tribute : cinq membres, des reprises metalcore et nu metal.",
    bio: "Wayward Ship est un groupe formé en 2023, qui a réellement commencé son activité scénique en 2026. Composé de cinq membres uniques, chacun apportant son style et son talent, le groupe propose des reprises de metalcore et de nu metal de qualité.",
    photo: "assets/images/wayward-ship/wayward-ship.jpg",
    photoAlt: "Photo du groupe Wayward Ship avec ses guitares",
    members: [] // ex : [{ name: "Prénom", role: "Chant" }]
  },

  // Images locales du matériel (utilisées si aucune image n'est définie dans Supabase). [mot-clé du nom, image]
  gearImages: [
    ["ex-84", "assets/images/guitars/harley-benton-ex84.jpg"],
    ["g110", "assets/images/guitars/cort-g110.jpg"]
  ],

  gearTeaser: "Harley Benton EX-84 Modern EMG BK et Cort G110 Open Pore Black : les guitares utilisées en concert."
};

export const PAGE_TITLES = { stageName: CONFIG.stageName };
