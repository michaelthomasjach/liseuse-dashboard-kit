import type { Candle } from "./interfaces/Candle.interface";
import type { Indicator } from "./interfaces/Indicator.interface";
import type { IndicatorValue } from "./interfaces/IndicatorValue.interface";
import type { StyleRuleSeriesRef } from "./interfaces/IndicatorStyleRule.interface";
import type {
  CandleColorCondition,
  CandleColorMetric,
  CandleColorOverride,
  CandleColorRule,
  CandleIconMark,
} from "./interfaces/CandleColorRule.interface";
import type { ScriptCandleColorOutput } from "./scripting/interfaces/ScriptRunResult.interface";
import { indicatorCatalogEntry, indicatorLabel } from "./indicatorCatalog";
import { indicatorSeriesFields, resolvedRuleIcon, seriesFieldValue } from "./styleRules";

/**
 * Style conditionnel des bougies (Paramètres du graphique → Bougies, et `plot.candleColor` d'un script) : ce que
 * l'éditeur et le rendu partagent — les mesures proposées, la lecture d'une condition sur une bougie, les modèles en un
 * clic, le calcul de la couleur de chaque bougie et celui des icônes posées sur les bougies (`computeCandleIcons`).
 *
 * Ordre de priorité, du plus fort au plus faible :
 *  1. les règles des paramètres du graphique, dans l'ordre de la liste (la première qui s'applique gagne) ;
 *  2. les couleurs posées par les scripts (`plot.candleColor`) ; entre deux scripts, le dernier ajouté l'emporte, et
 *     dans un même script le dernier appel sur une bougie ;
 *  3. les couleurs haussière / baissière habituelles.
 * Les règles des paramètres passent devant parce qu'elles sont le choix explicite de la personne qui regarde le
 * graphique ; un script ne colore que les bougies qu'aucune règle active ne colore.
 */

/** Les mesures chiffrées (comparées à un seuil) ; les autres sont vraies ou fausses. */
const NUMERIC_METRICS = new Set<CandleColorMetric>(["changeOpen", "changePrev", "range", "body", "gap", "volume"]);

export function isNumericMetric(metric: CandleColorMetric): boolean {
  return NUMERIC_METRICS.has(metric);
}

/** Les mesures qui lisent un nombre de bougies (`period`). */
export function metricUsesPeriod(metric: CandleColorMetric): boolean {
  return metric === "volume" || metric === "highest" || metric === "lowest";
}

/** Les mesures qui lisent une courbe d'indicateur (`series`). */
export function metricUsesSeries(metric: CandleColorMetric): boolean {
  return metric === "closeAbove" || metric === "closeBelow";
}

/** Libellés des mesures, dans l'ordre du menu. `unit` : ce que vaut le seuil. */
export const CANDLE_COLOR_METRICS: { value: CandleColorMetric; label: string; unit?: string }[] = [
  { value: "changeOpen", label: "Variation (clôture vs ouverture)", unit: "%" },
  { value: "changePrev", label: "Variation (vs clôture précédente)", unit: "%" },
  { value: "range", label: "Amplitude (haut − bas)", unit: "%" },
  { value: "body", label: "Corps en % de l'amplitude", unit: "%" },
  { value: "gap", label: "Gap à l'ouverture", unit: "%" },
  { value: "volume", label: "Volume / moyenne", unit: "×" },
  { value: "closeAbove", label: "Clôture au-dessus de" },
  { value: "closeBelow", label: "Clôture en dessous de" },
  { value: "highest", label: "Plus haut des N bougies" },
  { value: "lowest", label: "Plus bas des N bougies" },
  { value: "bullish", label: "Bougie haussière" },
  { value: "bearish", label: "Bougie baissière" },
];

/** Une courbe du panneau principal qu'une condition « clôture au-dessus / en dessous de » peut citer. */
export interface CandleSeriesOption {
  key: string;
  ref: StyleRuleSeriesRef;
  label: string;
}

/** Clé stable d'une courbe pour un menu. */
export function candleSeriesKey(ref: StyleRuleSeriesRef | undefined): string {
  if (!ref || ref.source !== "indicator") return "";
  return `${ref.indicatorId ?? ""}:${ref.field ?? ""}`;
}

/** Les courbes tracées sur les prix (moyennes, bandes, VWAP, overlays d'un script…), dans l'ordre des indicateurs. */
export function candleSeriesOptions(indicators: Indicator[]): CandleSeriesOption[] {
  const options: CandleSeriesOption[] = [];
  for (const indicator of indicators) {
    if (indicator.sourceId || indicatorCatalogEntry(indicator).pane !== "price") continue;
    const fields = indicatorSeriesFields(indicator);
    const name = indicatorLabel(indicator);
    const short = indicatorCatalogEntry(indicator).shortLabel;
    for (const f of fields) {
      const ref: StyleRuleSeriesRef = { source: "indicator", indicatorId: indicator.id, ...(f.field ? { field: f.field } : {}) };
      const label = fields.length === 1 ? name : f.label.startsWith(short) ? f.label : `${short} ${f.label}`;
      options.push({ key: candleSeriesKey(ref), ref, label });
    }
  }
  return options;
}

let ruleCounter = 0;
export function newCandleColorRuleId(): string {
  ruleCounter += 1;
  return `candle-rule-${Date.now().toString(36)}-${ruleCounter}`;
}

/** Une nouvelle règle, prête à lire : « variation (clôture vs ouverture) > 0,3 % → orange ». */
export function defaultCandleColorRule(): CandleColorRule {
  return { id: newCandleColorRuleId(), conditions: [{ metric: "changeOpen", operator: "gt", value: 0.3 }], color: "#f5a623" };
}

/** Une nouvelle condition ajoutée à une règle. */
export function defaultCandleColorCondition(): CandleColorCondition {
  return { metric: "volume", operator: "gt", value: 2, period: 20 };
}

/** Un modèle de règle en un clic, proposé sous la liste. */
export interface CandleColorRuleTemplate {
  id: string;
  label: string;
  rule: () => CandleColorRule;
}

export const CANDLE_COLOR_RULE_TEMPLATES: CandleColorRuleTemplate[] = [
  {
    id: "strong-up",
    label: "Forte hausse > +0,3 %",
    rule: () => ({ id: newCandleColorRuleId(), name: "Forte hausse", conditions: [{ metric: "changeOpen", operator: "gt", value: 0.3 }], color: "#00c853" }),
  },
  {
    id: "strong-down",
    label: "Forte baisse < −0,3 %",
    rule: () => ({ id: newCandleColorRuleId(), name: "Forte baisse", conditions: [{ metric: "changeOpen", operator: "lt", value: -0.3 }], color: "#d50000" }),
  },
  {
    id: "volume-x2",
    label: "Volume ×2",
    rule: () => ({ id: newCandleColorRuleId(), name: "Volume ×2", conditions: [{ metric: "volume", operator: "gt", value: 2, period: 20 }], color: "#2962ff" }),
  },
  {
    id: "doji",
    label: "Doji",
    rule: () => ({ id: newCandleColorRuleId(), name: "Doji", conditions: [{ metric: "body", operator: "lt", value: 10 }], color: "#9e9e9e", wickColor: "#616161" }),
  },
  {
    id: "new-high",
    label: "Plus haut sur 20 bougies",
    rule: () => ({ id: newCandleColorRuleId(), name: "Plus haut 20", conditions: [{ metric: "highest", period: 20 }], color: "#ffab00" }),
  },
];

function pct(a: number, b: number): number | null {
  return b !== 0 && Number.isFinite(a) && Number.isFinite(b) ? ((a - b) / b) * 100 : null;
}

/** Ce qu'il faut pour lire les conditions : les bougies, la somme cumulée des volumes (moyennes en temps constant) et
 *  les valeurs complètes des indicateurs (pas seulement la partie visible). */
interface EvalContext {
  data: Candle[];
  volumeSums: number[];
  volumeCounts: number[];
  indicatorValues: Map<string, (IndicatorValue | null)[]>;
}

/** La mesure chiffrée d'une condition sur la bougie `i`, ou null quand elle n'a pas de sens (pas de bougie précédente,
 *  amplitude nulle, volume absent…). */
export function candleMetricValue(metric: CandleColorMetric, ctx: EvalContext, i: number, period: number): number | null {
  const d = ctx.data[i]!;
  const prev = i > 0 ? ctx.data[i - 1] : undefined;
  switch (metric) {
    case "changeOpen":
      return pct(d.close, d.open);
    case "changePrev":
      return prev ? pct(d.close, prev.close) : null;
    case "range":
      return d.open !== 0 ? ((d.high - d.low) / d.open) * 100 : null;
    case "body": {
      const range = d.high - d.low;
      return range > 0 ? (Math.abs(d.close - d.open) / range) * 100 : 0;
    }
    case "gap":
      return prev ? pct(d.open, prev.close) : null;
    case "volume": {
      if (d.volume === undefined || !Number.isFinite(d.volume)) return null;
      const n = Math.max(1, Math.round(period));
      if (i < n) return null;
      const sum = ctx.volumeSums[i]! - ctx.volumeSums[i - n]!;
      const count = ctx.volumeCounts[i]! - ctx.volumeCounts[i - n]!;
      if (count === 0) return null;
      const mean = sum / count;
      return mean > 0 ? d.volume / mean : null;
    }
    default:
      return null;
  }
}

function conditionHolds(cond: CandleColorCondition, ctx: EvalContext, i: number): boolean {
  const d = ctx.data[i]!;
  const period = cond.period ?? 20;
  if (isNumericMetric(cond.metric)) {
    const v = candleMetricValue(cond.metric, ctx, i, period);
    if (v === null) return false;
    const a = cond.value ?? 0;
    const op = cond.operator ?? "gt";
    if (op === "gt") return v > a;
    if (op === "lt") return v < a;
    const b = cond.value2 ?? a;
    return v >= Math.min(a, b) && v <= Math.max(a, b);
  }
  switch (cond.metric) {
    case "bullish":
      return d.close > d.open;
    case "bearish":
      return d.close < d.open;
    case "highest":
    case "lowest": {
      const n = Math.max(1, Math.round(period));
      if (i < n - 1) return false;
      for (let k = i - n + 1; k < i; k++) {
        const c = ctx.data[k]!;
        if (cond.metric === "highest" ? c.high > d.high : c.low < d.low) return false;
      }
      return true;
    }
    case "closeAbove":
    case "closeBelow": {
      const ref = cond.series;
      if (!ref || ref.source !== "indicator" || !ref.indicatorId) return false;
      const values = ctx.indicatorValues.get(ref.indicatorId);
      const v = seriesFieldValue(values?.[i] ?? null, ref.field);
      if (v === null) return false;
      return cond.metric === "closeAbove" ? d.close > v : d.close < v;
    }
    default:
      return false;
  }
}

/** La règle s'applique-t-elle à la bougie `i` ? Une règle sans condition ne s'applique jamais. */
function ruleHolds(rule: CandleColorRule, ctx: EvalContext, i: number): boolean {
  if (rule.conditions.length === 0) return false;
  return rule.combine === "or" ? rule.conditions.some((c) => conditionHolds(c, ctx, i)) : rule.conditions.every((c) => conditionHolds(c, ctx, i));
}

/** Le contexte de lecture des conditions : sommes cumulées des volumes et valeurs complètes des indicateurs. */
function buildEvalContext(data: Candle[], indicatorValues: { indicator: Indicator; values: (IndicatorValue | null)[] }[]): EvalContext {
  const volumeSums = new Array<number>(data.length + 1);
  const volumeCounts = new Array<number>(data.length + 1);
  // Sommes décalées d'un cran : `volumeSums[i] - volumeSums[i - n]` est la somme des n bougies AVANT i.
  volumeSums[0] = 0;
  volumeCounts[0] = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i]!.volume;
    const ok = v !== undefined && Number.isFinite(v);
    volumeSums[i + 1] = volumeSums[i]! + (ok ? v! : 0);
    volumeCounts[i + 1] = volumeCounts[i]! + (ok ? 1 : 0);
  }
  return { data, volumeSums, volumeCounts, indicatorValues: new Map(indicatorValues.map((e) => [e.indicator.id, e.values])) };
}

function overrideOf(color: string, wick?: string | null, border?: string | null): CandleColorOverride {
  return { body: color, wick: wick || color, border: border || color };
}

/**
 * La couleur de chaque bougie recolorée, par index dans `data` ; les autres gardent leurs couleurs habituelles. `null`
 * quand rien n'est recoloré (le cas courant : le rendu garde alors son chemin le plus rapide). Voir l'ordre de priorité
 * en tête de ce fichier.
 */
export function computeCandleColors({
  data,
  rules,
  indicatorValues,
  scriptColors,
}: {
  data: Candle[];
  rules: CandleColorRule[] | undefined;
  indicatorValues: { indicator: Indicator; values: (IndicatorValue | null)[] }[];
  scriptColors: ScriptCandleColorOutput[];
}): Map<number, CandleColorOverride> | null {
  const active = (rules ?? []).filter((r) => r.enabled !== false && r.recolor !== false && r.conditions.length > 0 && typeof r.color === "string");
  if (active.length === 0 && scriptColors.length === 0) return null;
  const out = new Map<number, CandleColorOverride>();

  if (scriptColors.length > 0) {
    const indexByTime = new Map<number, number>();
    data.forEach((d, i) => indexByTime.set(d.date.getTime(), i));
    for (const s of scriptColors) {
      const i = indexByTime.get(s.date);
      if (i === undefined) continue;
      if (s.color === null) out.delete(i);
      else out.set(i, overrideOf(s.color, s.wick, s.border));
    }
  }

  if (active.length > 0) {
    const ctx = buildEvalContext(data, indicatorValues);
    for (let i = 0; i < data.length; i++) {
      for (const rule of active) {
        if (ruleHolds(rule, ctx, i)) {
          out.set(i, overrideOf(rule.color, rule.wickColor, rule.borderColor));
          break;
        }
      }
    }
  }
  return out.size > 0 ? out : null;
}

/**
 * Les icônes posées sur les bougies par les règles qui en ont une (« Ajouter une icône ») : une par règle et par bougie
 * où elle s'applique — contrairement à la couleur, une règle placée avant ne les empêche pas. Plusieurs icônes du même
 * côté d'une bougie s'empilent (voir le rendu). `null` quand aucune règle active n'a d'icône (le cas courant).
 */
export function computeCandleIcons({
  data,
  rules,
  indicatorValues,
}: {
  data: Candle[];
  rules: CandleColorRule[] | undefined;
  indicatorValues: { indicator: Indicator; values: (IndicatorValue | null)[] }[];
}): CandleIconMark[] | null {
  const withIcon = (rules ?? []).filter((r) => r.enabled !== false && r.icon && r.conditions.length > 0);
  if (withIcon.length === 0) return null;
  const ctx = buildEvalContext(data, indicatorValues);
  const out: CandleIconMark[] = [];
  for (const rule of withIcon) {
    const icon = resolvedRuleIcon(rule.icon);
    const position = icon.position === "below" ? "below" : "above";
    const color = icon.color ?? rule.color;
    for (let i = 0; i < data.length; i++) {
      if (ruleHolds(rule, ctx, i)) out.push({ index: i, icon: icon.name, color, size: icon.size, position });
    }
  }
  return out.length > 0 ? out : null;
}
