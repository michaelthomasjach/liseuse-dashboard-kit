import type { Candle } from "./interfaces/Candle.interface";
import type { ValueFormat, ValueFormatSpec } from "./interfaces/ValueFormat.interface";

/** The live OHLC readout, top-left of the price plot — the hovered candle while hovering, the
 *  most recent one otherwise (so the readout is never blank). % is against the *previous*
 *  candle's close (not this candle's own open), matching how a trading platform's own top-bar
 *  readout reads "change since last close" rather than "change within this bar". */
export function computeOhlcReadout(data: Candle[], hoverIndex: number | null) {
  const index = hoverIndex !== null ? hoverIndex : data.length - 1;
  const candle = data[index];
  const prevClose = index > 0 ? data[index - 1].close : candle.open;
  const delta = candle.close - prevClose;
  const deltaPct = prevClose !== 0 ? (delta / prevClose) * 100 : 0;
  return { candle, delta, deltaPct, sign: delta >= 0 ? "+" : "" };
}

/** Picks whichever of black/white reads better against `hex` (a "#rrggbb" background), by
 *  perceived luminance (ITU-R BT.601 weights) rather than a plain average — the eye is far more
 *  sensitive to green than red/blue, so that's the split that actually predicts legibility. Used
 *  to keep a drawing's text label background editable without ever landing on an unreadable
 *  text/background pairing by accident. */
export function contrastingTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#000000" : "#ffffff";
}

/** Event kinds (`ChartEvent.kind`) are freeform app-supplied strings ("earnings", "dividend"…),
 *  always rendered Title Case wherever they're shown as a label — the events-visibility toggle in
 *  the toolbar (see ToolsRail) and its twin list in the chart-settings modal (see
 *  ChartSettingsModals) both read through this rather than each formatting it their own way. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Temps restant avant la fin de la bougie en cours. Bougies intrajournalières : date de la dernière bougie + l'écart
 *  entre les deux dernières. À partir du jour, la bougie suit le calendrier local : une bougie journalière se termine
 *  à minuit (à 11:05, il reste 12:55), une hebdomadaire le lundi suivant à 0 h, une mensuelle le 1er du mois suivant.
 *  Ajouter l'écart donnait « demain à l'heure d'ouverture » (21:53 restantes à 11:05 pour le CAC 40, daté de 9 h)
 *  et, après un week-end, un écart de trois jours. */
export function candleRemainingMs(lastDate: Date, prevDate: Date | null, now: number): number | null {
  if (!prevDate) return null;
  const gap = lastDate.getTime() - prevDate.getTime();
  if (gap <= 0) return null;
  const HOUR = 3_600_000;
  if (gap < 20 * HOUR) return lastDate.getTime() + gap - now;
  const today = new Date(now);
  let end: Date;
  if (gap < 5 * 24 * HOUR) {
    // Jour (y compris le saut d'un week-end ou d'un jour férié entre deux séances).
    end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  } else if (gap < 20 * 24 * HOUR) {
    // Semaine : jusqu'au lundi suivant, 0 h.
    const daysToMonday = ((8 - today.getDay()) % 7) || 7;
    end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToMonday);
  } else {
    // Mois (ou plus) : jusqu'au 1er du mois suivant, 0 h.
    end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  }
  return end.getTime() - now;
}

/** MM:SS, rounded up so a fresh 5-minute candle reads "05:00" (not "04:59") the instant it
 *  starts — ceil(ms / 1000) rather than floor. Negative/zero clamps to "00:00" rather than
 *  going negative, since nothing here forces a new candle to actually arrive on schedule. */
export function formatCountdown(ms: number): string {
  // Sous l'heure « MM:SS » ; au-delà « H:MM:SS » ; au-delà d'un jour « 2 j 16:06:28 » — une bougie journalière
  // affichait sinon « 3846:28 », des minutes qu'on ne pouvait pas lire comme telles.
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = Math.floor(totalSeconds / 86_400);
  const h = Math.floor((totalSeconds % 86_400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (totalSeconds < 3600) return `${pad(m)}:${pad(s)}`;
  if (d === 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${d} j ${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** A raw price (or "equivalent price", see `overlayProjections`) reinterpreted as a % change from
 *  a reference price — what the whole price axis reads in once `compareMode` is active, instead
 *  of `pFmt`'s plain currency. Signed (a leading "+" on a gain, matching the OHLC readout's own
 *  `ohlcSign` convention) since "up or down from the reference" is the entire point of this view. */
export function formatPercentFromReference(value: number, reference: number): string {
  if (reference === 0) return "0.0%";
  const pct = (value / reference - 1) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/** Le signe moins typographique (U+2212), celui des axes d3 : « −200M », « −12.50 ». */
const MINUS = "−";

/** Remplace le trait d'union d'un nombre négatif par le vrai signe moins, et retire celui d'un zéro arrondi
 *  (« -0.00 » → « 0.00 »). */
function withMinus(text: string): string {
  if (!text.startsWith("-")) return text;
  return /^-0*\.?0*$/.test(text) ? text.slice(1) : MINUS + text.slice(1);
}

/** Les unités de la notation compacte, de la plus grande à la plus petite : B pour les milliards (jamais le G du
 *  préfixe SI de `d3.format("s")`). */
const COMPACT_UNITS: [number, string][] = [
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "k"],
];

/** Seuil de la notation compacte : en dessous, le nombre s'écrit en entier (1000 reste « 1000 »). */
export const COMPACT_THRESHOLD = 10_000;

/**
 * Le format de toutes les valeurs d'indicateur, de volume et de panneau (axes, en-têtes, badges) : le nombre tel
 * quel sous 10 000 en valeur absolue (avec les décimales du contexte, `formatSmall`, deux par défaut), puis
 * k / M / B / T à trois chiffres significatifs au plus, sans zéros finaux.
 *   100 → « 100 » (selon `formatSmall`) · 12 345 → « 12.3k » · 100 000 → « 100k » · 999 999 → « 1M »
 *   1 000 000 000 → « 1B » · 10 100 000 000 → « 10.1B » · −200 000 000 → « −200M »
 * L'arrondi qui atteint 1000 passe à l'unité suivante (999 999 donne « 1M », pas « 1000k »).
 */
export function formatCompactNumber(value: number, formatSmall: (value: number) => string = (v) => v.toFixed(2)): string {
  if (!Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);
  if (abs < COMPACT_THRESHOLD) return withMinus(formatSmall(value));
  let unit = COMPACT_UNITS.findIndex(([size]) => abs >= size);
  let scaled = Number((abs / COMPACT_UNITS[unit][0]).toPrecision(3));
  if (scaled >= 1000 && unit > 0) {
    unit -= 1;
    scaled = Number((abs / COMPACT_UNITS[unit][0]).toPrecision(3));
  }
  return `${value < 0 ? MINUS : ""}${scaled}${COMPACT_UNITS[unit][1]}`;
}

/** Un nombre sans zéros inutiles : deux décimales au plus à partir de 1, trois chiffres significatifs en dessous
 *  (0.0035 reste lisible), 0 → « 0 ». La partie « petite » du format des volumes et des profils. */
export function formatPlainNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  const text = abs >= 1 ? String(Number(abs.toFixed(2))) : String(Number(abs.toPrecision(3)));
  return text === "0" ? "0" : (value < 0 ? MINUS : "") + text;
}

/** Le format par défaut d'un volume (axe, en-tête, badges du panneau Volume) : 100 → « 100 », 1000 → « 1000 »,
 *  100 000 → « 100k », 1 000 000 000 → « 1B ». Remplace l'ancien `d3.format(".2s")` qui écrivait « 200G ». */
export function formatVolumeValue(value: number): string {
  return formatCompactNumber(value, formatPlainNumber);
}

/** Un format de valeurs (réglage d'un indicateur ou option d'un script, voir `ValueFormat`) lu sans planter sur une
 *  donnée persistée ou envoyée par un script : tout ce qui n'est pas reconnu revient à "auto". */
export function normalizeValueFormat(format: unknown): ValueFormat {
  if (format === "integer" || format === "percent" || format === "raw" || format === "auto") return format;
  if (format === "compact") return "auto";
  if (format && typeof format === "object") {
    const o = format as Record<string, unknown>;
    const spec: ValueFormatSpec = {};
    if (typeof o.decimals === "number" && Number.isFinite(o.decimals)) spec.decimals = Math.max(0, Math.min(10, Math.round(o.decimals)));
    if (typeof o.compact === "boolean") spec.compact = o.compact;
    if (typeof o.prefix === "string") spec.prefix = o.prefix.slice(0, 8);
    if (typeof o.suffix === "string") spec.suffix = o.suffix.slice(0, 8);
    return spec;
  }
  return "auto";
}

/** Écrit un nombre selon un `ValueFormat` (voir son doc pour chaque cas). */
export function formatWithValueFormat(value: number, format: ValueFormat | undefined): string {
  const f = normalizeValueFormat(format);
  if (!Number.isFinite(value)) return String(value);
  if (f === "auto") return formatCompactNumber(value);
  if (f === "integer") return formatCompactNumber(value, (v) => Math.round(v).toFixed(0));
  if (f === "percent") return `${withMinus(value.toFixed(2))}%`;
  if (f === "raw") return withMinus(String(value));
  const decimals = f.decimals ?? 2;
  const body = f.compact === false ? withMinus(value.toFixed(decimals)) : formatCompactNumber(value, (v) => v.toFixed(decimals));
  const negative = body.startsWith(MINUS);
  return `${negative ? MINUS : ""}${f.prefix ?? ""}${negative ? body.slice(1) : body}${f.suffix ?? ""}`;
}

/** Le formateur d'un `ValueFormat` explicite, ou null pour "auto" / absent : chaque endroit garde alors son format
 *  automatique (précision du pas pour un axe, deux décimales pour une légende), tous deux compacts dès 10 000. */
export function valueFormatter(format: ValueFormat | undefined): ((value: number) => string) | null {
  const f = normalizeValueFormat(format);
  return f === "auto" ? null : (v) => formatWithValueFormat(v, f);
}

/** Les graduations d'un axe de panneau : la notation compacte à partir de 10 000, sinon la précision que d3 déduit
 *  du pas entre graduations, sans séparateur de milliers (« 5000 », « 0.0012 », « 20 »). */
export function compactAxisTickFormat(scale: { tickFormat: (count?: number, specifier?: string) => (v: number) => string }, ticks: number) {
  const small = scale.tickFormat(ticks, "f");
  return (value: number) => formatCompactNumber(value, small);
}

export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateInputValue(text: string, fallback: Date): Date {
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return fallback;
  const next = new Date(fallback);
  next.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return next;
}

/** A `Date` as an `<input type="date">` value — `yyyy-mm-dd` in *local* time, deliberately not
 *  `toISOString().slice(0, 10)`, which converts to UTC first and so reports the previous day for
 *  anyone east of Greenwich in the evening. */
export function toDayInputValue(date: Date | undefined): string {
  if (!date) return "";
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

/** Which candle a day picked in an `<input type="date">` resolves to: the last one at or before the
 *  end of that day. A day with no candle of its own — a weekend, a holiday, a gap in the data —
 *  therefore lands on the session before it rather than being rejected, which is what someone
 *  typing a date actually means. `null` when the value is unparseable or falls before the first
 *  candle. Assumes `data` is ascending by date, as every candle array in this library is. */
export function candleIndexForDay(data: Candle[], value: string): number | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
  let index = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i].date.getTime() > endOfDay) break;
    index = i;
  }
  return index >= 0 ? index : null;
}
