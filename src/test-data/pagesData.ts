/* Données de démonstration des pages ProfilePage, InvoicePage et LockScreenPage. Images générées
   en SVG (data URI) : locales, sans réseau, déterministes. */
import type { InvoiceLine } from "../pages/InvoicePage";

const svg = (body: string, w: number, h: number) =>
  "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);

/** Un portrait stylisé : tête et épaules sur fond uni. */
export const DEMO_AVATAR = svg(
  `<rect width="120" height="120" fill="#c9d3e6"/>
   <circle cx="60" cy="48" r="22" fill="#5b4636"/>
   <circle cx="60" cy="52" r="19" fill="#e9c4a6"/>
   <path d="M41 46 Q60 22 79 46 Q72 36 60 36 Q48 36 41 46Z" fill="#5b4636"/>
   <path d="M18 120 Q22 82 60 80 Q98 82 102 120Z" fill="#2f3b52"/>`,
  120,
  120
);

/** Une bannière de paysage : ciel en dégradé, deux lignes de collines. */
export const DEMO_BANNER = svg(
  `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3a55"/><stop offset="1" stop-color="#c7835b"/></linearGradient></defs>
   <rect width="1200" height="300" fill="url(#s)"/>
   <circle cx="880" cy="190" r="46" fill="#f3c98b" opacity="0.9"/>
   <path d="M0 220 L180 150 L320 200 L520 120 L700 210 L900 140 L1200 210 V300 H0Z" fill="#3b3550"/>
   <path d="M0 260 L220 210 L430 250 L640 200 L860 255 L1040 220 L1200 250 V300 H0Z" fill="#1f2233"/>`,
  1200,
  300
);

export const DEMO_INVOICE_LINES: InvoiceLine[] = [
  { id: "l1", description: "Atelier de cadrage", detail: "Deux demi-journées avec l'équipe produit, restitution écrite.", quantity: 1, unit: "j", unitPrice: 1200 },
  { id: "l2", description: "Maquettes de l'espace client", detail: "Douze écrans, version claire et sombre.", quantity: 6, unit: "j", unitPrice: 650 },
  { id: "l3", description: "Intégration du tableau de bord", detail: "Composants, routes et données de démonstration.", quantity: 38.5, unit: "h", unitPrice: 85 },
  { id: "l4", description: "Hébergement — 12 mois", quantity: 12, unit: "mois", unitPrice: 29.9 },
];
