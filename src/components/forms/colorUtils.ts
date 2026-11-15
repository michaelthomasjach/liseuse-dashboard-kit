/**
 * Couleurs du sélecteur (`ColorPicker`) : lecture des écritures CSS courantes, écriture en hexadécimal, conversions
 * RVB ↔ TSV (teinte, saturation, valeur) pour la zone de sélection fine.
 *
 * Écriture produite : `#rrggbb` quand la couleur est opaque (les couleurs déjà enregistrées ne changent donc pas
 * d'écriture), `#rrggbbaa` dès qu'elle a de la transparence. Les deux sont comprises partout où le kit dessine :
 * canvas (`fillStyle`, `strokeStyle`), SVG (`fill`, `stroke`) et CSS. Une opacité ajoutée par-dessus
 * (`globalAlpha`, `fill-opacity`, `color-mix(… transparent)`) se multiplie avec celle de la couleur.
 */

export interface RgbaColor {
  /** 0–255 */
  r: number;
  g: number;
  b: number;
  /** 0–1 */
  a: number;
}

export interface HsvaColor {
  /** 0–360 */
  h: number;
  /** 0–1 */
  s: number;
  v: number;
  a: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` / `rgba()` (virgules ou espaces, `/ alpha`, pourcentages) ;
 *  sinon, dans un navigateur, ce que le canvas sait lire (noms de couleur, `hsl()`…). `null` si illisible. */
export function parseColor(input: string | null | undefined): RgbaColor | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = h.split("").map((c) => c + c).join("");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? Math.round((parseInt(h.slice(6, 8), 16) / 255) * 1000) / 1000 : 1,
    };
  }
  const fn = /^rgba?\(\s*([^)]*)\)$/.exec(s);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const channel = (p: string) => (p.endsWith("%") ? (parseFloat(p) / 100) * 255 : parseFloat(p));
    const [r, g, b] = parts.slice(0, 3).map(channel);
    const a = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    if ([r, g, b, a].some((n) => !Number.isFinite(n))) return null;
    return { r: clamp(Math.round(r), 0, 255), g: clamp(Math.round(g), 0, 255), b: clamp(Math.round(b), 0, 255), a: clamp(a, 0, 1) };
  }
  if (typeof document === "undefined") return null;
  // Repli : le canvas normalise toute couleur CSS valide en #rrggbb ou rgba(…).
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#010203";
    ctx.fillStyle = s;
    const out = String(ctx.fillStyle);
    if (out === "#010203" && s !== "#010203") return null;
    return out.startsWith("#") || out.startsWith("rgb") ? parseColor(out) : null;
  } catch {
    return null;
  }
}

const hex2 = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");

/** `#rrggbb` (opaque) ou `#rrggbbaa`. */
export function formatHex({ r, g, b, a }: RgbaColor): string {
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return a >= 0.999 ? base : base + hex2(a * 255);
}

/** La même couleur, réécrite en `#rrggbb` / `#rrggbbaa` minuscules ; telle quelle si elle est illisible. */
export function normalizeColor(input: string): string {
  const c = parseColor(input);
  return c ? formatHex(c) : input;
}

/** Opacité de la couleur, 0–1 (1 si illisible). */
export function colorAlpha(input: string): number {
  return parseColor(input)?.a ?? 1;
}

/** La couleur avec une autre opacité (0–1). */
export function withAlpha(input: string, alpha: number): string {
  const c = parseColor(input);
  return c ? formatHex({ ...c, a: clamp(alpha, 0, 1) }) : input;
}

export function rgbaToHsva({ r, g, b, a }: RgbaColor): HsvaColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max, a };
}

export function hsvaToRgba({ h, s, v, a }: HsvaColor): RgbaColor {
  const c = v * s;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r1, g1, b1] =
    hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  const m = v - c;
  return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255), a };
}

/** Lecture tolérante de ce qu'on tape dans le champ hexadécimal (« fff », « #FF8800 », « ff880080 »). */
export function parseHexInput(text: string): RgbaColor | null {
  const t = text.trim().replace(/^#?/, "#");
  return /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(t) ? parseColor(t) : null;
}
