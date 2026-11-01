import type { ActivityPost } from "../components/widgets/ActivityFeed";

/**
 * Données de démonstration pour `ActivityFeed` : un fil d'équipe, des horodatages relatifs écrits
 * en dur, et des illustrations SVG générées ici en data URI — aucune image téléchargée, et la même
 * graine redonne toujours le même dessin.
 */

const PALETTES = [
  ["#f6d9b8", "#f2a77a", "#fff3d6", "#8d6a9f", "#5c4a7d", "#2f2850"],
  ["#cfe8f3", "#9cc9de", "#ffffff", "#7aa58c", "#4e7d63", "#2c4a3a"],
  ["#e9e3f5", "#c3b5e6", "#fff6e0", "#6f86c4", "#4a5f9c", "#2b3866"],
];

/** Un paysage en trois plans de collines sous un soleil, en 16:9. */
export function illustration(seed: number, w = 1200, h = 675): string {
  const [sky1, sky2, sun, far, mid, near] = PALETTES[seed % PALETTES.length];
  let s = (seed * 7919 + 13) % 2147483647;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const hills = [far, mid, near]
    .map((fill, i) => {
      const base = h * (0.5 + i * 0.13);
      let d = `M0 ${h} L0 ${Math.round(base)}`;
      const steps = 5 + i * 2;
      for (let k = 1; k <= steps; k++) {
        const x = Math.round((w * k) / steps);
        const y = Math.round(base - rand() * h * (0.14 - i * 0.03));
        d += ` Q${Math.round(x - w / steps / 2)} ${y - 20} ${x} ${y}`;
      }
      return `<path d="${d} L${w} ${h} Z" fill="${fill}"/>`;
    })
    .join("");
  const cx = Math.round(w * (0.2 + rand() * 0.6));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
    `<circle cx="${cx}" cy="${Math.round(h * 0.34)}" r="${Math.round(h * 0.11)}" fill="${sun}" opacity="0.9"/>` +
    hills +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const ACTIVITY_POSTS: ActivityPost[] = [
  {
    id: "p1",
    author: { name: "Claire Moreau" },
    action: "a publié",
    target: "dans Équipe produit",
    time: "il y a 5 min",
    dateTime: "2026-11-01T14:27",
    text: "La v2.4 part en production cet après-midi. Merci à tous pour la semaine de recette — 37 tickets fermés, zéro régression ouverte.",
    likes: 24,
    liked: true,
    shares: 3,
    commentCount: 2,
    comments: [
      { id: "c1", author: { name: "Julien Petit" }, text: "Bravo à l'équipe ! On surveille les métriques de paiement ce soir.", time: "il y a 3 min" },
      { id: "c2", author: { name: "Inès Garnier" }, text: "Les notes de version sont en ligne.", time: "il y a 1 min" },
    ],
  },
  {
    id: "p2",
    author: { name: "Paul Lefèvre" },
    action: "a partagé une photo",
    time: "il y a 2 h",
    dateTime: "2026-11-01T12:30",
    text: "Le séminaire d'automne, vu du belvédère.",
    image: { src: illustration(1), alt: "Collines en trois plans sous un soleil pâle" },
    likes: 23000,
    shares: 412,
    commentCount: 5345,
    comments: [{ id: "c3", author: { name: "Sophie Laurent" }, text: "Superbe lumière.", time: "il y a 1 h" }],
  },
  {
    id: "p3",
    author: { name: "Inès Garnier" },
    action: "a commenté",
    target: "le ticket #482",
    time: "hier à 18:04",
    dateTime: "2026-10-31T18:04",
    text: "Le correctif de l'export CSV est prêt pour relecture : séparateur « ; » et BOM pour Excel.",
    likes: 4,
  },
  {
    id: "p4",
    author: { name: "Sophie Laurent" },
    action: "a rejoint",
    target: "l'équipe Produit",
    time: "29 oct.",
    dateTime: "2026-10-29T10:12",
    image: { src: illustration(2), alt: "Paysage de collines bleues" },
  },
];
