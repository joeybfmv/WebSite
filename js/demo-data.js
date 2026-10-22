// js/demo-data.js — DONNÉES DE DÉMONSTRATION (fictives).
// Utilisées uniquement tant que Supabase n'est pas configuré. Elles sont signalées « DÉMO » à l'écran.
const inDays = (d, h = 20, m = 30) => {
  const t = new Date(); t.setDate(t.getDate() + d); t.setHours(h, m, 0, 0); return t.toISOString();
};

export const DEMO = {
  concerts: [
    { id: "demo-1", title: "[DÉMO] Soirée tribute — exemple", description: "Concert fictif servant à tester l'affichage. Supprimez-le en configurant Supabase.", event_date: inDays(21), venue_name: "Salle d'exemple", address: "1 rue de l'Exemple", city: "Ville exemple", latitude: null, longitude: null, poster_url: null, reservation_url: "https://example.com/reservation", is_published: true },
    { id: "demo-2", title: "[DÉMO] Festival — exemple", description: "Second concert fictif, sans lien de réservation.", event_date: inDays(48, 19, 0), venue_name: "Scène d'exemple", address: "10 avenue du Test", city: "Autre ville", latitude: null, longitude: null, poster_url: null, reservation_url: null, is_published: true }
  ],
  setlist: [
    { id: 1, title: "The Poison", album: "The Poison", duration_seconds: null, position: 1, is_published: true },
    { id: 2, title: "Tears Don't Fall", album: "The Poison", duration_seconds: null, position: 2, is_published: true },
    { id: 3, title: "Hand of Blood", album: "The Poison", duration_seconds: null, position: 3, is_published: true },
    { id: 4, title: "All These Things I Hate (Revolve Around Me)", album: "The Poison", duration_seconds: null, position: 4, is_published: true },
    { id: 5, title: "Scream Aim Fire", album: "Scream Aim Fire", duration_seconds: null, position: 5, is_published: true },
    { id: 6, title: "Hearts Burst into Fire", album: "Scream Aim Fire", duration_seconds: null, position: 6, is_published: true },
    { id: 7, title: "Waking the Demon", album: "Scream Aim Fire", duration_seconds: null, position: 7, is_published: true },
    { id: 8, title: "Your Betrayal", album: "Fever", duration_seconds: null, position: 8, is_published: true },
    { id: 9, title: "Fever", album: "Fever", duration_seconds: null, position: 9, is_published: true },
    { id: 10, title: "Temper Temper", album: "Temper Temper", duration_seconds: null, position: 10, is_published: true }
  ],
  gear: [
    { id: 1, name: "Guitare principale (à compléter)", category: "Guitare", brand: "À COMPLÉTER", model: "À COMPLÉTER", description: "Accordage, micros et modifications à renseigner.", image_url: null, position: 1, is_published: true },
    { id: 2, name: "Guitare secondaire (à compléter)", category: "Guitare", brand: "À COMPLÉTER", model: "À COMPLÉTER", description: "À renseigner.", image_url: null, position: 2, is_published: true },
    { id: 3, name: "Ampli (à compléter)", category: "Ampli", brand: "À COMPLÉTER", model: "À COMPLÉTER", description: "À renseigner.", image_url: null, position: 3, is_published: true },
    { id: 4, name: "Pédalier (à compléter)", category: "Pédales & effets", brand: "À COMPLÉTER", model: "À COMPLÉTER", description: "À renseigner.", image_url: null, position: 4, is_published: true }
  ]
};
