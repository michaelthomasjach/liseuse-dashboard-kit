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

/** La couleur à dessiner dans le mode. Une couleur simple est rendue telle quelle. */
export function resolveThemedColor(value: string, mode: ThemedColorMode): string {
  if (!isThemedColor(value)) return value;
  const t = parseThemedColor(value);
  return t.kind === "same" ? t.color : mode === "dark" ? t.dark : t.light;
}

const DEEP_CACHE: Record<ThemedColorMode, WeakMap<object, unknown>> = { light: new WeakMap(), dark: new WeakMap() };

/** Au-delà, un tableau est une série de données (bougies, valeurs d'indicateur) : jamais de couleur dedans. */
const MAX_WALKED_ARRAY = 400;

/**
 * Remplace, en profondeur, chaque couleur jour / nuit par celle du mode. Rend le même objet (même identité) s'il n'en
 * contient aucune, et garde le résultat en cache par objet : appelé à chaque rendu, il ne recrée rien tant que rien
 * ne change. Les dates, fonctions, Map/Set et longs tableaux de données ne sont pas parcourus.
 */
export function resolveThemedDeep<T>(value: T, mode: ThemedColorMode): T {
  if (typeof value === "string") return (isThemedColor(value) ? resolveThemedColor(value, mode) : value) as T;
  if (value === null || typeof value !== "object") return value;
  const obj = value as unknown as object;
  if (obj instanceof Date || obj instanceof Map || obj instanceof Set || ArrayBuffer.isView(obj)) return value;
  const cache = DEEP_CACHE[mode];
  if (cache.has(obj)) return cache.get(obj) as T;
  let out: unknown = value;
  if (Array.isArray(obj)) {
    if (obj.length <= MAX_WALKED_ARRAY) {
      let copy: unknown[] | null = null;
      for (let i = 0; i < obj.length; i++) {
        const next = resolveThemedDeep(obj[i], mode);
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
        const next = resolveThemedDeep(v, mode);
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
