import type { GalleryImage } from "../components/widgets/Gallery";

/**
 * Images de démonstration pour `Gallery` et `Lightbox` : des illustrations SVG générées ici, en
 * data URI — paysages, formes, vagues, dégradés — dans des formats variés (paysage, portrait, carré,
 * panorama). Aucune image téléchargée, et tout est déterministe : chaque visuel découle d'une graine,
 * la même graine redonne le même dessin.
 */

type Kind = "paysage" | "formes" | "vagues" | "degrade";

const FORMATS = {
  paysage: [1200, 800],
  portrait: [800, 1200],
  carre: [1000, 1000],
  panorama: [1600, 700],
} as const;

type Format = keyof typeof FORMATS;

/** Générateur pseudo-aléatoire de Park-Miller : une graine, toujours la même suite. */
function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function landscape(w: number, h: number, c: string[], rand: () => number): string {
  const [sky1, sky2, sun, far, mid, near] = c;
  const layers = [far, mid, near]
    .map((fill, li) => {
      const base = h * (0.45 + li * 0.14);
      const amp = h * (0.16 - li * 0.03);
      const steps = 6 + li * 2;
      let d = `M0 ${h} L0 ${r1(base)}`;
      for (let i = 1; i <= steps; i++) {
        const x = (w / steps) * i;
        const y = base - rand() * amp + (i % 2 ? amp * 0.3 : 0);
        d += ` L${r1(x)} ${r1(y)}`;
      }
      return `<path d="${d} L${w} ${h} Z" fill="${fill}"/>`;
    })
    .join("");
  const sx = r1(w * (0.2 + rand() * 0.6));
  const sy = r1(h * (0.18 + rand() * 0.12));
  return (
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#s)"/>` +
    `<circle cx="${sx}" cy="${sy}" r="${r1(Math.min(w, h) * 0.08)}" fill="${sun}"/>` +
    layers
  );
}

function shapes(w: number, h: number, c: string[], rand: () => number): string {
  const [bg1, bg2, ...fills] = c;
  let out =
    `<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#b)"/>`;
  for (let i = 0; i < 9; i++) {
    const fill = fills[i % fills.length];
    const x = rand() * w;
    const y = rand() * h;
    const s = Math.min(w, h) * (0.08 + rand() * 0.2);
    const o = r1(0.55 + rand() * 0.4);
    const k = i % 3;
    if (k === 0) out += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(s / 2)}" fill="${fill}" fill-opacity="${o}"/>`;
    else if (k === 1)
      out += `<rect x="${r1(x - s / 2)}" y="${r1(y - s / 2)}" width="${r1(s)}" height="${r1(s)}" fill="${fill}" fill-opacity="${o}" transform="rotate(${Math.round(rand() * 90)} ${r1(x)} ${r1(y)})"/>`;
    else out += `<path d="M${r1(x)} ${r1(y - s / 2)} L${r1(x + s / 2)} ${r1(y + s / 2)} L${r1(x - s / 2)} ${r1(y + s / 2)} Z" fill="${fill}" fill-opacity="${o}"/>`;
  }
  return out;
}

function waves(w: number, h: number, c: string[], rand: () => number): string {
  const [bg, ...fills] = c;
  let out = `<rect width="${w}" height="${h}" fill="${bg}"/>`;
  fills.forEach((fill, i) => {
    const base = h * (0.3 + (i * 0.6) / fills.length);
    const amp = h * (0.04 + rand() * 0.05);
    const period = w / (1.2 + rand() * 1.6);
    const phase = rand() * Math.PI * 2;
    let d = `M0 ${h} L0 ${r1(base)}`;
    for (let x = 0; x <= w; x += w / 40) d += ` L${r1(x)} ${r1(base + Math.sin((x / period) * Math.PI * 2 + phase) * amp)}`;
    out += `<path d="${d} L${w} ${h} Z" fill="${fill}"/>`;
  });
  return out;
}

function gradient(w: number, h: number, c: string[], rand: () => number): string {
  const [bg, ...spots] = c;
  const defs = spots
    .map(
      (col, i) =>
        `<radialGradient id="g${i}" cx="${r1(rand())}" cy="${r1(rand())}" r="${r1(0.5 + rand() * 0.4)}"><stop offset="0" stop-color="${col}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`
    )
    .join("");
  return `<defs>${defs}</defs><rect width="${w}" height="${h}" fill="${bg}"/>` + spots.map((_, i) => `<rect width="${w}" height="${h}" fill="url(#g${i})"/>`).join("");
}

const DRAW: Record<Kind, typeof landscape> = { paysage: landscape, formes: shapes, vagues: waves, degrade: gradient };

/** Une illustration SVG en data URI, de la taille du format demandé. */
export function demoArtwork(kind: Kind, seed: number, colors: string[], format: Format = "paysage"): { src: string; width: number; height: number } {
  const [w, h] = FORMATS[format];
  const body = DRAW[kind](w, h, colors, rng(seed));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;
  return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width: w, height: h };
}

interface Spec {
  id: string;
  kind: Kind;
  seed: number;
  colors: string[];
  format: Format;
  title: string;
  subtitle: string;
  meta: string;
  span?: GalleryImage["span"];
}

const CATEGORY: Record<Kind, string> = { paysage: "Paysages", formes: "Formes", vagues: "Vagues", degrade: "Dégradés" };

const SPECS: Spec[] = [
  { id: "aube", kind: "paysage", seed: 11, colors: ["#f6c99b", "#fbe6cf", "#fff4e0", "#c98f7a", "#8c5d63", "#4b3a4f"], format: "paysage", title: "Aube sur les crêtes", subtitle: "Série Reliefs", meta: "48 €" },
  { id: "lagon", kind: "vagues", seed: 23, colors: ["#e8f6f7", "#9fd8dc", "#5cb8c2", "#2f8f9e", "#1d5e6d"], format: "portrait", title: "Lagon", subtitle: "Série Marées", meta: "32 €" },
  { id: "bauhaus", kind: "formes", seed: 37, colors: ["#f3ede2", "#e7dcc8", "#d8432f", "#1f4fa3", "#f2b632", "#1d1d1d"], format: "carre", title: "Bauhaus", subtitle: "Série Géométries", meta: "40 €", span: "large" },
  { id: "aurore", kind: "degrade", seed: 41, colors: ["#141b3a", "#6be3c4", "#7c5cf0", "#f06aa8"], format: "paysage", title: "Aurore", subtitle: "Série Lumières", meta: "36 €" },
  { id: "vallee", kind: "paysage", seed: 53, colors: ["#9fd0f0", "#e6f4fb", "#ffffff", "#8db7a3", "#4f8a6c", "#24503f"], format: "panorama", title: "La vallée verte", subtitle: "Série Reliefs", meta: "55 €", span: "wide" },
  { id: "houle", kind: "vagues", seed: 61, colors: ["#fdf3e1", "#f5c27a", "#ec8f4e", "#c95b3b", "#7d2f2a"], format: "paysage", title: "Houle orange", subtitle: "Série Marées", meta: "29 €" },
  { id: "constellation", kind: "formes", seed: 73, colors: ["#1b2340", "#2c3a66", "#f2d16b", "#e8eefc", "#8fa3e6"], format: "portrait", title: "Constellation", subtitle: "Série Géométries", meta: "42 €", span: "tall" },
  { id: "pastel", kind: "degrade", seed: 89, colors: ["#fbf7f2", "#ffc8a8", "#b8d8ff", "#d6c2ff"], format: "carre", title: "Pastel", subtitle: "Série Lumières", meta: "24 €" },
  { id: "crepuscule", kind: "paysage", seed: 97, colors: ["#3b2a5c", "#d9787a", "#ffd9a0", "#6b4a7a", "#45305a", "#21172f"], format: "portrait", title: "Crépuscule", subtitle: "Série Reliefs", meta: "48 €" },
  { id: "abysses", kind: "vagues", seed: 101, colors: ["#0e2a3f", "#1b4a6b", "#236a8f", "#2f8bb0", "#55b3d1"], format: "carre", title: "Abysses", subtitle: "Série Marées", meta: "34 €" },
  { id: "mosaique", kind: "formes", seed: 113, colors: ["#e9f3ec", "#cfe6d6", "#2e8b57", "#f4a259", "#5b8e7d", "#bc4b51"], format: "paysage", title: "Mosaïque", subtitle: "Série Géométries", meta: "38 €" },
  { id: "braise", kind: "degrade", seed: 127, colors: ["#2a0f0f", "#ff7a3d", "#ffc94d", "#c2185b"], format: "portrait", title: "Braise", subtitle: "Série Lumières", meta: "30 €" },
  { id: "desert", kind: "paysage", seed: 131, colors: ["#f7d9a8", "#fff1d6", "#fff8ea", "#e3b278", "#c98b4f", "#8f5a2e"], format: "paysage", title: "Désert", subtitle: "Série Reliefs", meta: "44 €" },
  { id: "estran", kind: "vagues", seed: 139, colors: ["#f4efe6", "#d9cbb3", "#b5a58a", "#7f9c96", "#4b6f6b"], format: "panorama", title: "Estran", subtitle: "Série Marées", meta: "52 €" },
  { id: "prisme", kind: "formes", seed: 149, colors: ["#fafafa", "#ececec", "#7252d3", "#0072ec", "#19ad79", "#ffd945"], format: "portrait", title: "Prisme", subtitle: "Série Géométries", meta: "36 €" },
  { id: "brume", kind: "degrade", seed: 157, colors: ["#e9edf2", "#9fb4c7", "#c7d3dd", "#7f93a8"], format: "paysage", title: "Brume", subtitle: "Série Lumières", meta: "26 €" },
];

/** Seize images, quatre catégories, tous les formats. Trois portent un `span` pour la grille. */
export const GALLERY_IMAGES: GalleryImage[] = SPECS.map((s) => {
  const art = demoArtwork(s.kind, s.seed, s.colors, s.format);
  return {
    id: s.id,
    src: art.src,
    width: art.width,
    height: art.height,
    alt: `${s.title} — illustration (${CATEGORY[s.kind].toLowerCase()})`,
    title: s.title,
    subtitle: s.subtitle,
    meta: s.meta,
    caption: `${s.subtitle} · ${CATEGORY[s.kind]} · ${art.width} × ${art.height}`,
    category: CATEGORY[s.kind],
    span: s.span,
  };
});

/** Les mêmes, sans `span` : pour une grille régulière ou la maçonnerie. */
export const GALLERY_IMAGES_PLAIN: GalleryImage[] = GALLERY_IMAGES.map(({ span: _span, ...rest }) => rest);
