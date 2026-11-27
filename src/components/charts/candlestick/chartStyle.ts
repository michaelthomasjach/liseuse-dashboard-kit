import type { CSSProperties } from "react";
import { blendColors, resolveThemedColor, resolveThemedDeep, surfaceModeOf, type ThemedColorMode } from "../../forms/themedColor";

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
  /** Style et couleur de cette ligne. Défaut `dashed`, couleur de hausse / baisse. `lastPriceLineColor` (réglage
   *  d'avant) vaut pour les deux sens, sauf là où `lastPriceLineUpColor` / `lastPriceLineDownColor` sont posés. */
  lastPriceLineStyle?: ChartLineStyle;
  lastPriceLineColor?: string;
  /** Couleur de la ligne du dernier prix et de sa pastille sur l'axe (sauf valeurs des séries en « Personnalisée »)
   *  quand le dernier prix est au-dessus / au-dessous de la clôture précédente. Absent : la couleur de la bougie. */
  lastPriceLineUpColor?: string;
  lastPriceLineDownColor?: string;
  /** Jour de la semaine sur les étiquettes de temps. Défaut faux. */
  weekdayOnLabels?: boolean;
  dateFormat?: ChartDateFormat;
  timeFormat?: ChartTimeFormat;

  // ── Toile ──
  /** Fond : uni (`backgroundColor`) ou dégradé vertical (`backgroundColor` → `backgroundColor2`). Absent : le thème. */
  backgroundType?: "solid" | "gradient";
  backgroundColor?: string;
  backgroundColor2?: string;
  /** Opacité du fond du tracé, en % (100 : opaque, défaut). En dessous, le fond (celui du thème ou `backgroundColor`)
   *  devient translucide et ce qui est derrière le graphique transparaît — un halo animé de la page, par exemple ;
   *  le graphique et son espace de travail laissent alors leur propre fond plein. */
  backgroundOpacity?: number;
  /** Bord à bord : une page qui pose le graphique dans un cadre (marge, coins arrondis) l'étend jusqu'aux bords. Le
   *  graphique n'en fait rien lui-même : il porte la classe `lq-chart--edge`, que la page lit. */
  edgeToEdge?: boolean;
  /** Grille verticale (aux dates de l'axe du temps). Défaut faux. */
  vertGridVisible?: boolean;
  vertGridColor?: string;
  vertGridStyle?: ChartLineStyle;
  /** Grille horizontale (aux prix de l'axe). Défaut vrai. */
  horzGridVisible?: boolean;
  horzGridColor?: string;
  /** Défaut : celui du thème (pointillés « 2 3 »). */
  horzGridStyle?: ChartLineStyle;
  /** Séparateurs entre panneaux : couleur et épaisseur (px, 2 par défaut). */
  paneSeparatorColor?: string;
  paneSeparatorWidth?: number;
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
  /** Réinitialisation du zoom (Espace, double-clic, loupe −) : nombre de bougies de l'unité de temps affichées. Défaut
   *  100 (`DEFAULT_RESET_ZOOM_BARS`) ; au-delà des bougies disponibles, toutes. */
  resetZoomBars?: number;

  // ── Bougies (onglet « Bougies » : couleurs de chaque type de graphique) ──
  /** Heikin Ashi : corps, bordures et mèches en hausse / baisse. Absent : les réglages des bougies. */
  haUpColor?: string;
  haDownColor?: string;
  haBorderUpColor?: string;
  haBorderDownColor?: string;
  haWickUpColor?: string;
  haWickDownColor?: string;
  /** Barres OHLC : couleurs en hausse / baisse (absent : celles des bougies) et épaisseur du trait (px, absent :
   *  celle des mèches du thème). */
  barUpColor?: string;
  barDownColor?: string;
  barWidth?: number;
  /** Ligne de clôture : couleur (absent : l'accent du thème), épaisseur (px, défaut 1,5) et style (défaut plein). */
  lineColor?: string;
  lineWidth?: number;
  lineStyle?: ChartLineStyle;
  /** Dégradé vertical sur la ligne elle-même : couleur à son point le plus haut et à son point le plus bas (absent :
   *  la couleur de la ligne, unie). */
  lineGradient?: boolean;
  lineTopColor?: string;
  lineBottomColor?: string;
  /** Remplissage sous la ligne de clôture. Défaut faux : une simple ligne ; vrai : la couleur de la ligne à 8 %. */
  lineFill?: boolean;
  /** Couleur du remplissage uni, opacité comprise (`#rrggbbaa`). Absent : la couleur de la ligne à 8 %. */
  lineFillColor?: string;
  /** Dégradé vertical, du haut de la courbe au bas du panneau : couleur du haut et du bas, opacité comprise. */
  lineFillGradient?: boolean;
  lineFillTopColor?: string;
  lineFillBottomColor?: string;
  /** Renko et Line Break : briques en hausse / baisse (corps et bordure). Absent : les couleurs des bougies. */
  renkoUpColor?: string;
  renkoDownColor?: string;
  renkoBorderUpColor?: string;
  renkoBorderDownColor?: string;
  lineBreakUpColor?: string;
  lineBreakDownColor?: string;
  lineBreakBorderUpColor?: string;
  lineBreakBorderDownColor?: string;
  /** Renko : période de l'ATR qui fixe la taille des briques (absent : la prop `renkoAtrPeriod`, 14). */
  renkoAtrPeriod?: number;
  /** Line Break : nombre de lignes à dépasser pour un renversement. Défaut 3. */
  lineBreakLines?: number;
  /** Étiquettes de l'axe des prix qui suivent une série (dernier cours, dernière valeur des indicateurs) : fond et
   *  texte. Absent : la couleur de la série en fond, le texte du thème. */
  seriesLabelBg?: string;
  seriesLabelText?: string;
  /** @deprecated Ignorés (une seule couleur pour les valeurs des séries) ; gardés pour lire sans erreur un réglage
   *  enregistré par le kit 0.276.0. */
  seriesLabelBgDown?: string;
  seriesLabelTextDown?: string;
  /** Étiquette du réticule sur l'axe des prix et des panneaux. Absent : la couleur d'accent du thème. */
  crosshairPriceLabelBg?: string;
  crosshairPriceLabelText?: string;
  /** Étiquette de date du réticule sur l'axe du temps. Absent : la couleur d'accent du thème. */
  crosshairTimeLabelBg?: string;
  crosshairTimeLabelText?: string;
  /** Filigrane (nom du symbole en fond) : toujours, quand il est activé (défaut), ou seulement pendant un replay. */
  watermarkVisibility?: "always" | "replay";
  /** Couleur du filigrane (son opacité reste celle du réglage du filigrane). Absent : la couleur du texte. */
  watermarkColor?: string;
  /** Boutons de navigation (zoom, défilement, remise à zéro) en bas du panneau des prix. Défaut `hidden`. */
  navigationButtons?: ChartButtonsVisibility;
  /** Boutons des en-têtes de panneaux et des lignes d'indicateurs (réglages, masquer, fermer…). Défaut `hover`. */
  paneButtons?: ChartButtonsVisibility;

  // ── Mode jour / nuit ──
  /** Mode du graphique : jour, nuit, ou absent pour suivre le thème du site (`hostColorScheme`, sinon la surface
   *  du thème du kit). Un mode différent de celui du site pose ses propres couleurs de toile par défaut. */
  colorMode?: ChartColorMode;
  /** Couleurs choisies dans chaque mode, enregistrées séparément pour le jour et pour la nuit : elles passent devant
   *  les couleurs du même nom posées à la racine (réglages d'avant les modes, valables dans les deux). */
  modeColors?: { light?: ChartModeColors; dark?: ChartModeColors };
  /** @internal Jetons de surface du mode imposé (calculés, jamais enregistrés). */
  surfaceTokens?: ChartSurfaceTokens;
  /** @internal Mode affiché (calculé par `resolveChartStyle`, jamais enregistré) : celui où se résolvent les couleurs
   *  jour / nuit (`light-dark(…)`) au dessin. */
  resolvedMode?: ChartColorMode;
}

/** Visibilité d'un groupe de boutons du graphique. */
export type ChartButtonsVisibility = "always" | "hover" | "hidden";

/** Mode jour (`light`) ou nuit (`dark`) du graphique. */
export type ChartColorMode = "light" | "dark";

/** Les réglages de couleur enregistrés par mode (jour / nuit). */
export const MODE_COLOR_KEYS = [
  "wickUpColor",
  "wickDownColor",
  "borderUpColor",
  "borderDownColor",
  "lastPriceLineColor",
  "lastPriceLineUpColor",
  "lastPriceLineDownColor",
  "backgroundType",
  "backgroundColor",
  "backgroundColor2",
  "vertGridColor",
  "horzGridColor",
  "paneSeparatorColor",
  "crosshairColor",
  "scaleTextColor",
  "scaleLineColor",
  "watermarkColor",
  "haUpColor",
  "haDownColor",
  "haBorderUpColor",
  "haBorderDownColor",
  "haWickUpColor",
  "haWickDownColor",
  "barUpColor",
  "barDownColor",
  "lineColor",
  "lineTopColor",
  "lineBottomColor",
  "lineFillColor",
  "lineFillTopColor",
  "lineFillBottomColor",
  "renkoUpColor",
  "renkoDownColor",
  "renkoBorderUpColor",
  "renkoBorderDownColor",
  "lineBreakUpColor",
  "lineBreakDownColor",
  "lineBreakBorderUpColor",
  "lineBreakBorderDownColor",
  "seriesLabelBg",
  "seriesLabelText",
  "crosshairPriceLabelBg",
  "crosshairPriceLabelText",
  "crosshairTimeLabelBg",
  "crosshairTimeLabelText",
] as const;
export type ModeColorKey = (typeof MODE_COLOR_KEYS)[number];
const MODE_COLOR_KEY_SET = new Set<string>(MODE_COLOR_KEYS);

/** Les réglages de couleur propres à un mode, plus les couleurs du corps des bougies. */
export type ChartModeColors = Partial<Pick<ChartStyleSettings, ModeColorKey>> & { upColor?: string; downColor?: string };

/** Couleurs de surface d'un mode imposé, posées en variables CSS sur la zone du graphique. */
export interface ChartSurfaceTokens {
  bg: string;
  panel: string;
  text: string;
  muted: string;
  border: string;
  borderSubtle: string;
  hover: string;
  /** Hausse et baisse (OHLC de la légende, pastilles) dans ce mode. */
  up: string;
  down: string;
  /** Accent (réticule, pastilles) et texte posé dessus. */
  accent: string;
  accentContrast: string;
}

interface ModePreset {
  style: Partial<ChartStyleSettings>;
  tokens: ChartSurfaceTokens;
}

function modePreset(tokens: ChartSurfaceTokens, grid: string): ModePreset {
  return {
    tokens,
    style: {
      backgroundColor: tokens.bg,
      horzGridColor: grid,
      vertGridColor: grid,
      paneSeparatorColor: tokens.border,
      crosshairColor: tokens.muted,
      scaleTextColor: tokens.muted,
      scaleLineColor: tokens.border,
    },
  };
}

/** Couleurs par défaut d'un mode imposé, selon la palette du thème (couleur ou e-ink) : celles des surfaces claire et
 *  sombre de tokens.css, pour qu'un graphique en mode nuit sur un site en jour ressemble au site en nuit. */
const MODE_PRESETS: Record<"color" | "eink", Record<ChartColorMode, ModePreset>> = {
  color: {
    light: modePreset({ bg: "#ffffff", panel: "#ffffff", text: "#12141a", muted: "#656b78", border: "#dfe2e8", borderSubtle: "#ecedf1", hover: "rgba(108, 135, 201, 0.08)", up: "#6faf82", down: "#c97c7c", accent: "#6c87c9", accentContrast: "#ffffff" }, "#e8eaef"),
    dark: modePreset({ bg: "#0f1420", panel: "#171d2b", text: "#f1f5f9", muted: "#8b93a7", border: "#2a3245", borderSubtle: "#232a3a", hover: "rgba(147, 169, 222, 0.12)", up: "#8fcb9e", down: "#e0a0a0", accent: "#93a9de", accentContrast: "#0f1420" }, "#232a3a"),
  },
  eink: {
    light: modePreset({ bg: "#f1eee6", panel: "#f1eee6", text: "#111111", muted: "#55524a", border: "#111111", borderSubtle: "#c9c4b6", hover: "rgba(17, 17, 17, 0.06)", up: "#111111", down: "#111111", accent: "#111111", accentContrast: "#f1eee6" }, "#c9c4b6"),
    dark: modePreset({ bg: "#0a0a0a", panel: "#0a0a0a", text: "#f5f5f2", muted: "#9c9a94", border: "#f5f5f2", borderSubtle: "#3a3a37", hover: "rgba(245, 245, 242, 0.08)", up: "#f5f5f2", down: "#f5f5f2", accent: "#f5f5f2", accentContrast: "#0a0a0a" }, "#3a3a37"),
  },
};

/** Ce qu'un style résolu sait de son origine : l'objet enregistré, le mode affiché et celui du site. */
export interface ChartStyleMeta {
  raw: ChartStyleSettings;
  mode: ChartColorMode;
  host: ChartColorMode;
  /** Le mode affiché a des couleurs à lui (ou des couleurs d'avant les modes s'y appliquent). */
  hasModeColors: boolean;
}

const STYLE_META = new WeakMap<object, ChartStyleMeta>();

/** L'origine d'un style rendu par `resolveChartStyle`, ou `undefined` pour un autre objet. */
export function chartStyleMeta(style: ChartStyleSettings): ChartStyleMeta | undefined {
  return STYLE_META.get(style);
}

function withoutUndefined<T extends object>(obj: T): T {
  for (const key of Object.keys(obj) as (keyof T)[]) if (obj[key] === undefined) delete obj[key];
  return obj;
}

/** Le style à appliquer dans le mode courant : couleurs par défaut du mode imposé (s'il diffère du site), puis les
 *  réglages enregistrés, puis les couleurs propres au mode. `modeColors` n'y figure plus. */
export function resolveChartStyle(raw: ChartStyleSettings, host: ChartColorMode, palette: "color" | "eink" = "color"): ChartStyleSettings {
  const mode = raw.colorMode ?? host;
  const rest: ChartStyleSettings = { ...raw };
  delete rest.modeColors;
  delete rest.surfaceTokens;
  delete rest.resolvedMode;
  const forced = raw.colorMode !== undefined && raw.colorMode !== host ? MODE_PRESETS[palette][mode] : undefined;
  const bucket: ChartModeColors = { ...raw.modeColors?.[mode] };
  delete bucket.upColor;
  delete bucket.downColor;
  const style: ChartStyleSettings = withoutUndefined({ ...forced?.style, ...rest, ...bucket });
  if (forced) style.surfaceTokens = forced.tokens;
  style.resolvedMode = mode;
  const hasModeColors = Object.keys(raw.modeColors?.[mode] ?? {}).length > 0 || MODE_COLOR_KEYS.some((k) => rest[k] !== undefined);
  STYLE_META.set(style, { raw, mode, host, hasModeColors });
  return style;
}

/** Les couleurs d'avant les modes, recopiées dans les deux modes (sans écraser ce qu'un mode a déjà). */
export function migrateLegacyColors(
  buckets: ChartStyleSettings["modeColors"],
  legacy: ChartModeColors,
): { light: ChartModeColors; dark: ChartModeColors } {
  return { light: { ...legacy, ...buckets?.light }, dark: { ...legacy, ...buckets?.dark } };
}

function cleanBuckets(buckets: ChartStyleSettings["modeColors"]): ChartStyleSettings["modeColors"] | undefined {
  if (!buckets) return undefined;
  const out: NonNullable<ChartStyleSettings["modeColors"]> = {};
  for (const m of ["light", "dark"] as const) {
    const kept = withoutUndefined({ ...buckets[m] });
    if (Object.keys(kept).length > 0) out[m] = kept;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Les couleurs posées à la racine (réglages d'avant les modes). */
function legacyColorsOf(raw: ChartStyleSettings): ChartModeColors {
  const legacy: Record<string, unknown> = {};
  for (const k of MODE_COLOR_KEYS) if (raw[k] !== undefined) legacy[k] = raw[k];
  return legacy as ChartModeColors;
}

/** L'objet à enregistrer après un changement fait sur le style résolu `next` (fenêtre des paramètres, modèle) :
 *  les couleurs modifiées vont dans le mode courant, le reste à la racine. La première couleur modifiée recopie les
 *  couleurs d'avant les modes dans les deux modes, pour que l'autre mode garde ce qu'il affichait. Un style rendu tel
 *  quel par `resolveChartStyle` (« Annuler » de la fenêtre) rend son objet enregistré. */
export function storeChartStyle(raw: ChartStyleSettings, next: ChartStyleSettings, host: ChartColorMode, palette: "color" | "eink" = "color"): ChartStyleSettings {
  const meta = STYLE_META.get(next);
  if (meta) return meta.raw;
  const current = resolveChartStyle(raw, host, palette);
  const mode = raw.colorMode ?? host;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || key === "surfaceTokens" || key === "resolvedMode" || key === "modeColors" || MODE_COLOR_KEY_SET.has(key)) continue;
    out[key] = value;
  }
  const changed = MODE_COLOR_KEYS.filter((k) => next[k] !== current[k]);
  let legacy = legacyColorsOf(raw);
  let buckets = raw.modeColors;
  if (changed.length > 0) {
    const migrated = migrateLegacyColors(raw.modeColors, legacy);
    legacy = {};
    // Une couleur changée vaut pour les deux modes : c'est la couleur elle-même qui dit si elle diffère entre le jour
    // et la nuit (« Jour / nuit » ou « Auto » du sélecteur, écrite light-dark(…)). `mode` reste celui qui est affiché.
    const light: Record<string, unknown> = { ...migrated.light };
    const dark: Record<string, unknown> = { ...migrated.dark };
    for (const k of changed) {
      light[k] = next[k];
      dark[k] = next[k];
    }
    void mode;
    buckets = { light: light as ChartModeColors, dark: dark as ChartModeColors };
  }
  Object.assign(out, legacy);
  const cleaned = cleanBuckets(buckets);
  if (cleaned) out.modeColors = cleaned;
  return out as ChartStyleSettings;
}

/** L'objet enregistré avec une couleur du corps des bougies changée dans le mode `mode` (les couleurs d'avant les
 *  modes passent dans les deux modes, comme pour `storeChartStyle`). */
export function storeModeCandleColor(
  raw: ChartStyleSettings,
  mode: ChartColorMode,
  key: "upColor" | "downColor",
  color: string | undefined,
  legacyCandles: { upColor?: string; downColor?: string } = {},
): ChartStyleSettings {
  const out: ChartStyleSettings = { ...raw };
  for (const k of MODE_COLOR_KEYS) delete out[k];
  const migrated = migrateLegacyColors(raw.modeColors, withoutUndefined({ ...legacyColorsOf(raw), ...legacyCandles }));
  // Même règle que storeChartStyle : la couleur choisie vaut pour les deux modes (light-dark(…) pour les distinguer).
  void mode;
  const cleaned = cleanBuckets({ light: { ...migrated.light, [key]: color }, dark: { ...migrated.dark, [key]: color } });
  if (cleaned) out.modeColors = cleaned;
  else delete out.modeColors;
  return out;
}

/** L'objet enregistré une fois les couleurs du mode `mode` remises à zéro (bougies comprises) : les couleurs d'avant
 *  les modes passent dans l'autre mode, qui garde ainsi son apparence. */
export function resetModeColors(raw: ChartStyleSettings, mode: ChartColorMode, legacyCandles: { upColor?: string; downColor?: string } = {}): ChartStyleSettings {
  const out: ChartStyleSettings = { ...raw };
  for (const k of MODE_COLOR_KEYS) delete out[k];
  const migrated = migrateLegacyColors(raw.modeColors, withoutUndefined({ ...legacyColorsOf(raw), ...legacyCandles }));
  const cleaned = cleanBuckets({ ...migrated, [mode]: {} });
  if (cleaned) out.modeColors = cleaned;
  else delete out.modeColors;
  return out;
}

/** Un style sans ce qui ne va pas dans un modèle d'apparence (mode du graphique, couleurs par mode, jetons calculés). */
export function templateStyle(style: ChartStyleSettings): ChartStyleSettings {
  const out: ChartStyleSettings = { ...style };
  delete out.colorMode;
  delete out.modeColors;
  delete out.surfaceTokens;
  delete out.resolvedMode;
  return out;
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
/** Bougies affichées par la réinitialisation du zoom quand `resetZoomBars` n'est pas réglé. */
export const DEFAULT_RESET_ZOOM_BARS = 100;

export const CANVAS_STYLE_KEYS: (keyof ChartStyleSettings)[] = [
  "backgroundType",
  "backgroundColor",
  "backgroundColor2",
  "backgroundOpacity",
  "edgeToEdge",
  "vertGridVisible",
  "vertGridColor",
  "vertGridStyle",
  "horzGridVisible",
  "horzGridColor",
  "horzGridStyle",
  "paneSeparatorColor",
  "paneSeparatorWidth",
  "crosshairColor",
  "crosshairStyle",
  "crosshairWidth",
  "scaleTextColor",
  "scaleTextSize",
  "scaleLineColor",
  "marginTop",
  "marginBottom",
  "marginRightBars",
  "resetZoomBars",
  "navigationButtons",
  "paneButtons",
  "seriesLabelBg",
  "seriesLabelText",
  "crosshairPriceLabelBg",
  "crosshairPriceLabelText",
  "crosshairTimeLabelBg",
  "crosshairTimeLabelText",
  "colorMode",
  "surfaceTokens",
];

/** Le style effectivement appliqué : sans la personnalisation avancée, les réglages de la Toile sont ignorés. */
export function effectiveChartStyle(style: ChartStyleSettings, advanced: boolean): ChartStyleSettings {
  if (advanced) return style;
  const next: ChartStyleSettings = { ...style };
  for (const key of CANVAS_STYLE_KEYS) delete next[key];
  return next;
}

/** Couleurs des étiquettes des axes, par jeton (`data-lq-axis-labels`, lu par ChartCanvasOptions.css) et variable CSS
 *  (`--lq-chart-<jeton>`). La pastille du dernier prix prend la couleur de la ligne du dernier prix (hausse ou baisse),
 *  sauf si les valeurs des séries sont en « Personnalisée » (une seule couleur, pour toutes les valeurs) ; puis réticule. */
function axisLabelColors(s: ChartStyleSettings): [string, string | undefined][] {
  return [
    ["last-bg-up", s.seriesLabelBg ?? s.lastPriceLineUpColor ?? s.lastPriceLineColor],
    ["last-bg-down", s.seriesLabelBg ?? s.lastPriceLineDownColor ?? s.lastPriceLineColor],
    ["series-bg", s.seriesLabelBg],
    ["series-text", s.seriesLabelText],
    ["cross-y-label-bg", s.crosshairPriceLabelBg],
    ["cross-y-label-text", s.crosshairPriceLabelText],
    ["cross-x-label-bg", s.crosshairTimeLabelBg],
    ["cross-x-label-text", s.crosshairTimeLabelText],
  ];
}

/** Les couleurs d'étiquettes réglées, en jetons pour l'attribut `data-lq-axis-labels` de la zone du graphique (lu par
 *  ChartCanvasOptions.css) ; `undefined` quand aucune ne l'est. */
export function axisLabelsAttribute(style: ChartStyleSettings): string | undefined {
  const tokens = axisLabelColors(style).filter(([, c]) => c).map(([name]) => name);
  return tokens.length > 0 ? tokens.join(" ") : undefined;
}

/** Tirets du canvas d'un style de trait ; `fallback` pour un style absent. */
export function lineDash(style: ChartLineStyle | undefined, fallback: number[]): number[] {
  if (style === "solid") return [];
  if (style === "dashed") return [4, 4];
  if (style === "dotted") return [1.5, 3];
  return fallback;
}

/** Fond par défaut de chaque mode, sous une toile translucide (le site derrière). */
const MODE_BACKDROP: Record<ChartColorMode, string> = { light: "#ffffff", dark: "#0f1420" };

/**
 * Le fond réellement affiché sous les courbes : la couleur de la toile (résolue dans le mode), posée à son opacité sur
 * le fond du mode ; `undefined` sans couleur de toile réglée (le fond du thème, qui suit déjà le mode).
 */
export function chartSurfaceColor(style: ChartStyleSettings, backdrop?: string): string | undefined {
  const mode: ChartColorMode = style.resolvedMode ?? "light";
  if (!style.backgroundColor) return undefined;
  const bg = resolveThemedColor(style.backgroundColor, mode);
  const bg2 = style.backgroundType === "gradient" && style.backgroundColor2 ? resolveThemedColor(style.backgroundColor2, mode) : undefined;
  const base = backdrop || MODE_BACKDROP[mode];
  const top = blendColors(bg, base, Math.max(0, Math.min(100, style.backgroundOpacity ?? 100)) / 100);
  if (!bg2) return top;
  return blendColors(blendColors(bg2, base, Math.max(0, Math.min(100, style.backgroundOpacity ?? 100)) / 100), top, 0.5);
}

/** Le mode où se résolvent les couleurs « Auto » : celui du fond réellement affiché (une toile blanche en mode nuit
 *  est claire), sinon le mode du graphique. */
export function chartAutoMode(style: ChartStyleSettings | undefined): ThemedColorMode {
  const mode: ChartColorMode = style?.resolvedMode ?? "light";
  const surface = style ? chartSurfaceColor(style) : undefined;
  return (surface && surfaceModeOf(surface)) || mode;
}

/** Variables CSS et fond posés sur la zone du graphique : texte et lignes des échelles (lus par ChartAxis.css),
 *  fond uni ou dégradé, séparateurs des colonnes d'axe. Vide quand rien n'est réglé. */
export function chartStyleCssVars(raw: ChartStyleSettings): CSSProperties {
  // Couleurs jour / nuit résolues dans le mode affiché (les variables CSS sont lues aussi par le canvas).
  const style = raw.resolvedMode ? resolveThemedDeep(raw, raw.resolvedMode, chartAutoMode(raw)) : raw;
  const vars: Record<string, string> = {};
  // Les couleurs light-dark(…) restées dans le HTML du graphique (légende, étiquettes) suivent ce mode.
  if (raw.resolvedMode) vars.colorScheme = raw.resolvedMode;
  if (style.scaleTextColor) vars["--lq-chart-axis-color"] = style.scaleTextColor;
  if (style.scaleTextSize) vars["--lq-chart-axis-size"] = `${style.scaleTextSize}px`;
  if (style.scaleLineColor) vars["--lq-chart-domain-color"] = style.scaleLineColor;
  if (style.paneSeparatorColor) vars["--lq-chart-pane-separator-color"] = style.paneSeparatorColor;
  if (style.paneSeparatorWidth) vars["--lq-chart-pane-separator-width"] = `${style.paneSeparatorWidth}px`;
  if (style.watermarkColor) vars["--lq-chart-watermark-color"] = style.watermarkColor;
  for (const [name, color] of axisLabelColors(style)) if (color) vars[`--lq-chart-${name}`] = color;
  // Mode imposé différent de celui du site : la zone du graphique prend les jetons de surface de ce mode, pour que la
  // légende, les en-têtes de panneaux et les axes restent lisibles sur son fond.
  const t = style.surfaceTokens;
  if (t) {
    vars["--lq-color-bg"] = t.bg;
    vars["--lq-color-panel"] = t.panel;
    vars["--lq-color-text"] = t.text;
    vars["--lq-color-text-muted"] = t.muted;
    vars["--lq-color-border"] = t.border;
    vars["--lq-color-border-subtle"] = t.borderSubtle;
    vars["--lq-color-hover"] = t.hover;
    vars["--lq-chart-grid-color"] = t.borderSubtle;
    vars["--lq-color-up"] = t.up;
    vars["--lq-color-down"] = t.down;
    vars["--lq-color-accent"] = t.accent;
    vars["--lq-color-accent-contrast"] = t.accentContrast;
    vars["--lq-color-fill"] = t.accent;
    vars.color = t.text;
  }
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
  if (isTranslucentChart(style)) {
    const share = `${Math.max(0, Math.min(100, style.backgroundOpacity ?? 100))}%`;
    const mix = (c: string) => `color-mix(in srgb, ${c} ${share}, transparent)`;
    vars.background = style.backgroundColor
      ? style.backgroundType === "gradient" && style.backgroundColor2
        ? `linear-gradient(to bottom, ${mix(style.backgroundColor)}, ${mix(style.backgroundColor2)})`
        : mix(style.backgroundColor)
      : mix("var(--lq-color-bg)");
  }
  return vars as CSSProperties;
}

/** Fond translucide (opacité du fond sous 100 %) : le graphique et son espace de travail laissent leur fond plein. */
export function isTranslucentChart(style: ChartStyleSettings): boolean {
  return style.backgroundOpacity !== undefined && style.backgroundOpacity < 100;
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
