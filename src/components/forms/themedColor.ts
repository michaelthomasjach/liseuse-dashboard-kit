import { createContext, useContext } from "react";
import { formatHex, parseColor } from "./colorUtils";

/** Mode d'affichage : jour (`light`) ou nuit (`dark`). */
export type ThemedColorMode = "light" | "dark";

/**
 * Une couleur selon le mode jour / nuit, écrite dans une chaîne pour passer partout où une couleur est attendue :
 * - `#rrggbb` (ou toute couleur CSS) : la même couleur dans les deux modes (cas par défaut) ;
 * - `light-dark(<jour>, <nuit>)` : une couleur par mode (même écriture que la fonction CSS) ;
 * - la même écriture suivie du commentaire CSS « auto » : « Auto », la couleur choisie éclaircie ou assombrie dans le mode où elle
 *   manquerait de contraste avec le fond (blanc invisible en jour, noir invisible en nuit), calculée au choix.
 * Toutes restent du CSS valide : la légende et les étiquettes HTML du graphique les résolvent d'elles-mêmes
 * (`color-scheme` posé sur le graphique), le canvas passe par `resolveThemedColor`.
 */
export type ThemedColor = { kind: "same"; color: string } | { kind: "modes"; light: string; dark: string } | { kind: "auto"; light: string; dark: string };

/** Découpe « a, b » au premier niveau (une virgule dans `rgba(…)` ne compte pas). */
function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(text.slice(start).trim());
  return out;
}

const THEMED_RE = /^\s*light-dark\((.*)\)\s*(\/\*auto\*\/)?\s*$/s;

/** Vrai pour une couleur écrite par mode (`light-dark(…)`), automatique comprise. */
export const isThemedColor = (value: unknown): value is string => typeof value === "string" && THEMED_RE.test(value);

export function parseThemedColor(value: string | null | undefined): ThemedColor {
  const v = value ?? "";
  const m = THEMED_RE.exec(v);
  if (!m) return { kind: "same", color: v };
  const parts = splitTopLevel(m[1] ?? "");
  const light = parts[0] ?? "";
  const dark = parts[1] ?? light;
  return m[2] ? { kind: "auto", light, dark } : { kind: "modes", light, dark };
}

export function formatThemedColor(t: ThemedColor): string {
  if (t.kind === "same") return t.color;
  return `light-dark(${t.light}, ${t.dark})${t.kind === "auto" ? " /*auto*/" : ""}`;
}

/** « Auto » à partir d'une couleur : elle-même là où elle se lit, sa version éclaircie ou assombrie ailleurs. */
export function autoThemedColor(color: string): string {
  return formatThemedColor({ kind: "auto", light: autoContrastColor(color, "light"), dark: autoContrastColor(color, "dark") });
}

/** Luminance relative (WCAG) d'une couleur opaque. */
function luminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Inverse la luminosité (TSL) d'une couleur en gardant sa teinte, sa saturation et son opacité. */
function invertLightness(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  const l2 = 1 - l;
  if (s === 0) {
    const v = Math.round(l2 * 255);
    return [v, v, v];
  }
  const q = l2 < 0.5 ? l2 * (1 + s) : l2 + s - l2 * s;
  const p = 2 * l2 - q;
  const hue = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [Math.round(hue(h + 1 / 3) * 255), Math.round(hue(h) * 255), Math.round(hue(h - 1 / 3) * 255)];
}

/**
 * La couleur lisible dans le mode : inchangée si elle contraste assez avec le fond du mode, sinon sa luminosité est
 * inversée (un blanc devient noir en jour, un bleu nuit devient bleu clair en nuit), teinte et opacité gardées.
 */
export function autoContrastColor(color: string, mode: ThemedColorMode): string {
  const c = parseColor(color);
  if (!c) return color;
  const lum = luminance(c.r, c.g, c.b);
  const tooDark = mode === "dark" && lum < 0.18;
  const tooLight = mode === "light" && lum > 0.6;
  if (!tooDark && !tooLight) return color;
  const [r, g, b] = invertLightness(c.r, c.g, c.b);
  return formatHex({ r, g, b, a: c.a });
}

/**
 * La couleur à dessiner dans le mode. Une couleur simple est rendue telle quelle. `autoMode` : le mode où se
 * résolvent les couleurs « Auto », celui du fond réellement affiché (une toile blanche en mode nuit est un fond clair :
 * l'« Auto » doit y être sombre). Par défaut le mode lui-même.
 */
export function resolveThemedColor(value: string, mode: ThemedColorMode, autoMode: ThemedColorMode = mode): string {
  if (!isThemedColor(value)) return value;
  const t = parseThemedColor(value);
  if (t.kind === "same") return t.color;
  const m = t.kind === "auto" ? autoMode : mode;
  return m === "dark" ? t.dark : t.light;
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21) ; 21 si l'une ne se lit pas. */
export function contrastRatio(a: string, b: string): number {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return 21;
  const la = luminance(ca.r, ca.g, ca.b);
  const lb = luminance(cb.r, cb.g, cb.b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Le mode (clair ou sombre) d'un fond, d'après sa luminance. */
export function surfaceModeOf(bg: string): ThemedColorMode | undefined {
  const c = parseColor(bg);
  if (!c) return undefined;
  return luminance(c.r, c.g, c.b) > 0.36 ? "light" : "dark";
}

/** `fg` posé à l'opacité `alpha` (0 à 1) sur `bg`, en hexadécimal opaque. */
export function blendColors(fg: string, bg: string, alpha: number): string {
  const f = parseColor(fg);
  const b = parseColor(bg);
  if (!f) return bg;
  if (!b) return fg;
  const a = Math.max(0, Math.min(1, alpha * f.a));
  const mix = (x: number, y: number) => Math.round(x * a + y * (1 - a));
  return formatHex({ r: mix(f.r, b.r), g: mix(f.g, b.g), b: mix(f.b, b.b), a: 1 });
}

/**
 * Une couleur du thème (accent, texte) lisible sur le fond réellement affiché : inchangée si elle contraste assez,
 * sinon sa luminosité est inversée (teinte gardée). Un accent blanc du thème nuit devient sombre sur une toile blanche.
 */
export function readableOn(color: string, bg: string, min = 2): string {
  if (contrastRatio(color, bg) >= min) return color;
  const c = parseColor(color);
  if (!c) return color;
  const [r, g, b] = invertLightness(c.r, c.g, c.b);
  const inverted = formatHex({ r, g, b, a: c.a });
  return contrastRatio(inverted, bg) > contrastRatio(color, bg) ? inverted : color;
}

const DEEP_CACHE = new Map<string, WeakMap<object, unknown>>();

/** Au-delà, un tableau est une série de données (bougies, valeurs d'indicateur) : jamais de couleur dedans. */
const MAX_WALKED_ARRAY = 400;

/**
 * Remplace, en profondeur, chaque couleur jour / nuit par celle du mode. Rend le même objet (même identité) s'il n'en
 * contient aucune, et garde le résultat en cache par objet : appelé à chaque rendu, il ne recrée rien tant que rien
 * ne change. Les dates, fonctions, Map/Set et longs tableaux de données ne sont pas parcourus.
 */
export function resolveThemedDeep<T>(value: T, mode: ThemedColorMode, autoMode: ThemedColorMode = mode): T {
  if (typeof value === "string") return (isThemedColor(value) ? resolveThemedColor(value, mode, autoMode) : value) as T;
  if (value === null || typeof value !== "object") return value;
  const obj = value as unknown as object;
  if (obj instanceof Date || obj instanceof Map || obj instanceof Set || ArrayBuffer.isView(obj)) return value;
  const cacheKey = `${mode}|${autoMode}`;
  let cache = DEEP_CACHE.get(cacheKey);
  if (!cache) DEEP_CACHE.set(cacheKey, (cache = new WeakMap()));
  if (cache.has(obj)) return cache.get(obj) as T;
  let out: unknown = value;
  if (Array.isArray(obj)) {
    if (obj.length <= MAX_WALKED_ARRAY) {
      let copy: unknown[] | null = null;
      for (let i = 0; i < obj.length; i++) {
        const next = resolveThemedDeep(obj[i], mode, autoMode);
        if (next !== obj[i]) {
          copy ??= obj.slice();
          copy[i] = next;
        }
      }
      if (copy) out = copy;
    }
  } else {
    const proto = Object.getPrototypeOf(obj);
    if (proto === Object.prototype || proto === null) {
      let copy: Record<string, unknown> | null = null;
      for (const [k, v] of Object.entries(obj)) {
        const next = resolveThemedDeep(v, mode, autoMode);
        if (next !== v) {
          copy ??= { ...(obj as Record<string, unknown>) };
          copy[k] = next;
        }
      }
      if (copy) out = copy;
    }
  }
  cache.set(obj, out);
  return out as T;
}

/**
 * Contexte des sélecteurs de couleur : présent (graphique), chaque sélecteur propose « Identique / Jour et nuit /
 * Auto » et sait quel mode est affiché ; absent, le sélecteur reste une couleur simple.
 */
export const ThemedColorContext = createContext<{ mode: ThemedColorMode } | null>(null);
export const useThemedColorContext = () => useContext(ThemedColorContext);
