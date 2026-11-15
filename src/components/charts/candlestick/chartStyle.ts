import type { CSSProperties } from "react";

/** Style d'un trait réglable (grille, réticule, ligne du dernier prix). */
export type ChartLineStyle = "solid" | "dashed" | "dotted";

/** Format des dates des étiquettes de temps (axe et pastille du réticule). `auto` : celui d'avant ces
 *  réglages (« 01 juin 2026 », ou le `formatDate` de l'application). */
export type ChartDateFormat = "auto" | "dd MMM yyyy" | "dd/MM/yyyy" | "dd/MM/yy" | "yyyy-MM-dd" | "dd MMM 'yy" | "MMM yyyy";

/** Heure ajoutée aux étiquettes de temps des bougies intrajournalières. `auto` : pas d'heure (comme avant). */
export type ChartTimeFormat = "auto" | "24h" | "12h";

/** Réglages d'apparence avancés du graphique (fenêtre « Paramètres du graphique », sections Symbole, Ligne
 *  d'état, Échelles et lignes, Toile). Chaque champ absent vaut le rendu d'avant ces réglages : un graphique
 *  dont personne ne touche les paramètres ne change pas. Une couleur absente : celle du thème. */
export interface ChartStyleSettings {
  // ── Symbole ──
  /** Mèches des bougies haussières / baissières. Absent : la couleur du corps. */
  wickUpColor?: string;
  wickDownColor?: string;
  /** Bordures des bougies haussières / baissières. Absent : la couleur du corps. */
  borderUpColor?: string;
  borderDownColor?: string;

  // ── Ligne d'état (légende en haut à gauche) ──
  /** Nom du symbole. Défaut vrai. */
  legendSymbol?: boolean;
  /** Description : le type de graphique (Bougies, Ligne…). Défaut vrai. */
  legendDescription?: boolean;
  /** Valeurs O H L C. Défaut vrai. */
  legendOhlc?: boolean;
  /** Variation depuis la clôture précédente (valeur et %). Défaut vrai. */
  legendChange?: boolean;
  /** Volume de la bougie. Défaut faux. */
  legendVolume?: boolean;
  /** Valeurs des indicateurs à côté de leur nom. Défaut faux. */
  legendIndicatorValues?: boolean;
  /** Titres des indicateurs. Défaut vrai. */
  legendIndicatorTitles?: boolean;

  // ── Échelles et lignes ──
  /** Axe des prix (étiquettes, pastilles). Défaut vrai. */
  priceAxisVisible?: boolean;
  /** Axe du temps (dates en bas). Défaut vrai. */
  timeAxisVisible?: boolean;
  /** Axes des panneaux (volume, indicateurs). Défaut vrai. */
  paneAxesVisible?: boolean;
  /** Côté de l'échelle des prix. Défaut `right`. */
  priceAxisSide?: "right" | "left";
  /** Pastille du dernier prix sur l'axe. Défaut vrai. */
  lastPriceLabel?: boolean;
  /** Pastilles du plus haut et du plus bas visibles sur l'axe. Défaut faux. */
  highLowLabels?: boolean;
  /** Dernière valeur de chaque indicateur sur son axe. Défaut faux. */
  indicatorAxisLabels?: boolean;
  /** Compte à rebours jusqu'à la clôture de la bougie (prix en direct). Défaut vrai. */
  countdown?: boolean;
  /** Ligne horizontale du dernier prix. Absent : tracée seulement en direct (`livePrice`), comme avant. */
  lastPriceLine?: boolean;
  /** Style et couleur de cette ligne. Défaut `dashed`, couleur de hausse / baisse. */
  lastPriceLineStyle?: ChartLineStyle;
  lastPriceLineColor?: string;
  /** Jour de la semaine sur les étiquettes de temps. Défaut faux. */
  weekdayOnLabels?: boolean;
  dateFormat?: ChartDateFormat;
  timeFormat?: ChartTimeFormat;

  // ── Toile ──
  /** Fond : uni (`backgroundColor`) ou dégradé vertical (`backgroundColor` → `backgroundColor2`). Absent : le thème. */
  backgroundType?: "solid" | "gradient";
  backgroundColor?: string;
  backgroundColor2?: string;
  /** Grille verticale (aux dates de l'axe du temps). Défaut faux. */
  vertGridVisible?: boolean;
  vertGridColor?: string;
  vertGridStyle?: ChartLineStyle;
  /** Grille horizontale (aux prix de l'axe). Défaut vrai. */
  horzGridVisible?: boolean;
  horzGridColor?: string;
  /** Défaut : celui du thème (pointillés « 2 3 »). */
  horzGridStyle?: ChartLineStyle;
  /** Séparateurs entre panneaux. */
  paneSeparatorColor?: string;
  /** Réticule. Défaut : couleur de texte atténuée, tirets, 1 px. */
  crosshairColor?: string;
  crosshairStyle?: ChartLineStyle;
  crosshairWidth?: number;
  /** Texte des échelles : couleur et taille (px). */
  scaleTextColor?: string;
  scaleTextSize?: number;
  /** Lignes des échelles (trait d'axe et graduations). */
  scaleLineColor?: string;
  /** Marges au-dessus du plus haut et sous le plus bas, en % de l'amplitude affichée. Défaut 8. */
  marginTop?: number;
  marginBottom?: number;
  /** Marge à droite de la dernière bougie, en bougies. Absent : celle de l'application (`futureBars`). */
  marginRightBars?: number;
}

/** Un modèle d'apparence enregistré (menu « Modèle » de la fenêtre des paramètres). */
export interface ChartStyleTemplate {
  id: string;
  name: string;
  /** Couleurs des bougies au moment de l'enregistrement. */
  upColor?: string;
  downColor?: string;
  style: ChartStyleSettings;
}

/** Les champs de la section Toile : retirés du rendu quand la personnalisation avancée n'est pas offerte
 *  (`advancedAppearance` faux). */
export const CANVAS_STYLE_KEYS: (keyof ChartStyleSettings)[] = [
  "backgroundType",
  "backgroundColor",
  "backgroundColor2",
  "vertGridVisible",
  "vertGridColor",
  "vertGridStyle",
  "horzGridVisible",
  "horzGridColor",
  "horzGridStyle",
  "paneSeparatorColor",
  "crosshairColor",
  "crosshairStyle",
  "crosshairWidth",
  "scaleTextColor",
  "scaleTextSize",
  "scaleLineColor",
  "marginTop",
  "marginBottom",
  "marginRightBars",
];

/** Le style effectivement appliqué : sans la personnalisation avancée, les réglages de la Toile sont ignorés. */
export function effectiveChartStyle(style: ChartStyleSettings, advanced: boolean): ChartStyleSettings {
  if (advanced) return style;
  const next: ChartStyleSettings = { ...style };
  for (const key of CANVAS_STYLE_KEYS) delete next[key];
  return next;
}

/** Tirets du canvas d'un style de trait ; `fallback` pour un style absent. */
export function lineDash(style: ChartLineStyle | undefined, fallback: number[]): number[] {
  if (style === "solid") return [];
  if (style === "dashed") return [4, 4];
  if (style === "dotted") return [1.5, 3];
  return fallback;
}

/** Variables CSS et fond posés sur la zone du graphique : texte et lignes des échelles (lus par ChartAxis.css),
 *  fond uni ou dégradé, séparateurs des colonnes d'axe. Vide quand rien n'est réglé. */
export function chartStyleCssVars(style: ChartStyleSettings): CSSProperties {
  const vars: Record<string, string> = {};
  if (style.scaleTextColor) vars["--lq-chart-axis-color"] = style.scaleTextColor;
  if (style.scaleTextSize) vars["--lq-chart-axis-size"] = `${style.scaleTextSize}px`;
  if (style.scaleLineColor) vars["--lq-chart-domain-color"] = style.scaleLineColor;
  if (style.paneSeparatorColor) vars["--lq-chart-pane-separator-color"] = style.paneSeparatorColor;
  if (style.backgroundColor) {
    // Texte lisible sur ce fond pour la légende et les en-têtes de panneaux (voir ChartSettingsDialog.css).
    const dark = isDarkColor(style.backgroundType === "gradient" && style.backgroundColor2 ? mixHex(style.backgroundColor, style.backgroundColor2) : style.backgroundColor);
    vars["--lq-chart-on-bg-text"] = dark ? "#e8e8e8" : "#1d1d1d";
    vars["--lq-chart-on-bg-muted"] = dark ? "#a3a3a3" : "#666666";
    vars.background =
      style.backgroundType === "gradient" && style.backgroundColor2
        ? `linear-gradient(to bottom, ${style.backgroundColor}, ${style.backgroundColor2})`
        : style.backgroundColor;
  }
  return vars as CSSProperties;
}

function hexRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(a: string, b: string): string {
  const x = hexRgb(a);
  const y = hexRgb(b);
  if (!x || !y) return a;
  return "#" + x.map((v, i) => Math.round((v + y[i]) / 2).toString(16).padStart(2, "0")).join("");
}

/** Vrai pour une couleur sombre (luminance perçue sous la moitié). Une couleur illisible compte pour claire. */
export function isDarkColor(color: string): boolean {
  const rgb = hexRgb(color);
  if (!rgb) return false;
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 < 0.5;
}

/** La colonne de l'échelle des Y (prix, volume, panneaux) : son côté, sa largeur et sa position `x` (bord
 *  gauche, dans le repère du tracé : 0 = bord gauche des bougies). Largeur 0 quand tous les axes Y sont masqués. */
export interface ChartYAxisGutter {
  side: "left" | "right";
  width: number;
  x: number;
  priceVisible: boolean;
  panesVisible: boolean;
  timeVisible: boolean;
}

/** La colonne d'avant ces réglages (à droite, toute la marge droite), pour un appelant qui n'en passe pas. */
export function defaultYAxisGutter(dims: { margin: { right: number }; boundedWidth: number }): ChartYAxisGutter {
  return { side: "right", width: dims.margin.right, x: dims.boundedWidth, priceVisible: true, panesVisible: true, timeVisible: true };
}

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const WEEKDAYS_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const pad2 = (n: number) => String(n).padStart(2, "0");

const formatterCache = new Map<string, (date: Date) => string>();

/** Le formateur des étiquettes de temps choisi dans « Échelles et lignes », ou `null` quand tout est par défaut
 *  (le graphique garde alors le sien). Même fonction d'un rendu à l'autre pour les mêmes réglages. `intraday` :
 *  les bougies durent moins d'un jour (l'heure n'est ajoutée qu'à celles-là). */
export function chartStyleDateFormatter(
  style: ChartStyleSettings,
  intraday: boolean,
  base: (date: Date) => string,
): ((date: Date) => string) | null {
  const dateFormat = style.dateFormat ?? "auto";
  const timeFormat = intraday ? (style.timeFormat ?? "auto") : "auto";
  const weekday = style.weekdayOnLabels ?? false;
  if (dateFormat === "auto" && timeFormat === "auto" && !weekday) return null;
  const key = `${dateFormat}|${timeFormat}|${weekday}`;
  const cachedBase = formatterCache.get(`${key}#base`);
  const cached = formatterCache.get(key);
  if (cached && cachedBase === base) return cached;
  const fmt = (date: Date): string => {
    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();
    let text: string;
    switch (dateFormat) {
      case "dd MMM yyyy":
        text = `${pad2(d)} ${MONTHS_SHORT[m]} ${y}`;
        break;
      case "dd/MM/yyyy":
        text = `${pad2(d)}/${pad2(m + 1)}/${y}`;
        break;
      case "dd/MM/yy":
        text = `${pad2(d)}/${pad2(m + 1)}/${String(y).slice(-2)}`;
        break;
      case "yyyy-MM-dd":
        text = `${y}-${pad2(m + 1)}-${pad2(d)}`;
        break;
      case "dd MMM 'yy":
        text = `${pad2(d)} ${MONTHS_SHORT[m]} '${String(y).slice(-2)}`;
        break;
      case "MMM yyyy":
        text = `${MONTHS_SHORT[m]} ${y}`;
        break;
      default:
        text = base(date);
    }
    if (weekday) text = `${WEEKDAYS_SHORT[date.getDay()]} ${text}`;
    if (timeFormat === "24h") text += ` ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    else if (timeFormat === "12h") {
      const h = date.getHours();
      text += ` ${h % 12 === 0 ? 12 : h % 12}:${pad2(date.getMinutes())} ${h < 12 ? "AM" : "PM"}`;
    }
    return text;
  };
  formatterCache.set(key, fmt);
  formatterCache.set(`${key}#base`, base as (date: Date) => string);
  return fmt;
}
