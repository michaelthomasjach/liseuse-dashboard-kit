import type { Indicator } from "./interfaces/Indicator.interface";
import type { IndicatorFill } from "./interfaces/IndicatorFill.interface";
import type { IndicatorValue } from "./interfaces/IndicatorValue.interface";
import type {
  IndicatorStyleRule,
  StyleRuleCondition,
  StyleRuleEffect,
  StyleRuleOperand,
  StyleRuleSeriesRef,
} from "./interfaces/IndicatorStyleRule.interface";
import { indicatorCatalogEntry, indicatorLabel } from "./indicatorCatalog";
import { VOLUME_PANE_ID, mainValue } from "./attachedIndicators";

/**
 * Règles de couleur des indicateurs (onglet Style, « Couleurs conditionnelles ») : ce que l'éditeur et le rendu
 * partagent — les courbes d'un panneau qu'une règle peut citer, la lecture d'une valeur, la conversion des anciennes
 * zones colorées, les modèles en un clic.
 */

export const RULE_UP = "#26a69a";
export const RULE_DOWN = "#ef5350";

/** Opacité par défaut d'une règle, en %, selon ce qu'elle peint : un remplissage reste translucide pour laisser lire
 *  les courbes, un fond encore plus, une ligne ou un point est plein. */
export function defaultRuleOpacity(effect: StyleRuleEffect): number {
  if (effect === "fill") return 25;
  if (effect === "background") return 12;
  return 100;
}

/** Les croisements : un effet ponctuel, sans « sinon ». */
export function isCrossCondition(condition: StyleRuleCondition): boolean {
  return condition === "crossUp" || condition === "crossDown";
}

/** « entre » / « hors de » : deux bornes. */
export function isRangeCondition(condition: StyleRuleCondition): boolean {
  return condition === "between" || condition === "outside";
}

/** Indicateurs qui ne sont pas une courbe : rien à comparer ni à colorer. */
const NOT_A_LINE = new Set<string>([
  "zigzag",
  "tpo",
  "supportResistance",
  "patternRecognition",
  "candleRecognition",
  "gaps",
  "pivotPoints",
  "parabolicSar",
  "headShoulders",
  "cupHandle",
  "chandelierExit",
]);

/** Les lignes d'un indicateur qu'une règle peut citer : `field` (absent : la ligne principale) et son nom. */
export function indicatorSeriesFields(indicator: Indicator): { field?: string; label: string }[] {
  if (NOT_A_LINE.has(indicator.kind)) return [];
  const custom = indicator.customData;
  if (custom?.draw === "multi") {
    return (custom.multiSeries ?? []).filter((s) => s.draw !== "band").map((s, k) => ({ field: s.key, label: s.label || `Série ${k + 1}` }));
  }
  if (indicator.kind === "macd") {
    return [
      { field: "macd", label: "MACD" },
      { field: "signal", label: "signal" },
      { field: "histogram", label: "histogramme" },
    ];
  }
  if (indicator.kind === "adx") {
    return [
      { field: "adx", label: "ADX" },
      { field: "plusDI", label: "+DI" },
      { field: "minusDI", label: "-DI" },
    ];
  }
  if (indicator.kind === "ichimoku") {
    return [
      { field: "conversion", label: "Tenkan" },
      { field: "base", label: "Kijun" },
      { field: "spanA", label: "Span A" },
      { field: "spanB", label: "Span B" },
    ];
  }
  if (indicator.kind === "bollinger" || custom?.draw === "band") {
    return [
      { field: "upper", label: "bande haute" },
      { field: "middle", label: "médiane" },
      { field: "lower", label: "bande basse" },
    ];
  }
  return [{ label: indicatorLabel(indicator) }];
}

/** Un indicateur qui peut porter des règles de couleur : il trace au moins une courbe. */
export function supportsStyleRules(indicator: Indicator): boolean {
  return indicatorSeriesFields(indicator).length > 0;
}

/** Le panneau d'un indicateur : principal (sur les prix), Volume, ou le sien (RSI, MACD… et ce qui y est posé). */
export function stylePaneKind(indicator: Indicator): "price" | "volume" | "own" {
  if (indicator.sourceId === VOLUME_PANE_ID) return "volume";
  if (indicator.sourceId) return "own";
  return indicatorCatalogEntry(indicator).pane === "price" ? "price" : "own";
}

/** Les indicateurs qui partagent le panneau de `owner` (lui d'abord) : sur les prix, toutes les courbes du panneau
 *  principal ; sur un panneau séparé, l'indicateur du panneau et ceux posés dessus ; sur le volume, les moyennes du
 *  volume. `owner` peut être un brouillon (réglages en cours) : il remplace sa version de `indicators`. */
export function stylePaneMembers(owner: Indicator, indicators: Indicator[]): Indicator[] {
  const others = indicators.filter((i) => i.id !== owner.id);
  let members: Indicator[];
  if (owner.sourceId === VOLUME_PANE_ID) members = others.filter((i) => i.sourceId === VOLUME_PANE_ID);
  else if (owner.sourceId) members = others.filter((i) => i.id === owner.sourceId || i.sourceId === owner.sourceId);
  else if (indicatorCatalogEntry(owner).pane === "price") members = others.filter((i) => !i.sourceId && indicatorCatalogEntry(i).pane === "price");
  else members = others.filter((i) => i.sourceId === owner.id);
  return [owner, ...members.filter(supportsStyleRules)];
}

/** Une courbe proposée dans les menus d'une règle. `key` : sa valeur dans le menu (voir `seriesRefKey`). */
export interface StyleSeriesOption {
  key: string;
  ref: StyleRuleSeriesRef;
  label: string;
}

/** Clé stable d'une courbe pour un menu : l'indicateur qui porte la règle est noté « self », qu'il soit cité par
 *  son id ou sans id. */
export function seriesRefKey(ref: StyleRuleSeriesRef, ownerId: string): string {
  if (ref.source !== "indicator") return ref.source;
  const id = !ref.indicatorId || ref.indicatorId === ownerId ? "self" : ref.indicatorId;
  return `indicator:${id}:${ref.field ?? ""}`;
}

/** Toutes les courbes du panneau de `owner` qu'une règle peut citer, dans l'ordre des menus. */
export function styleSeriesOptions(owner: Indicator, indicators: Indicator[]): StyleSeriesOption[] {
  const options: StyleSeriesOption[] = [];
  for (const member of stylePaneMembers(owner, indicators)) {
    const fields = indicatorSeriesFields(member);
    const isOwner = member.id === owner.id;
    const name = isOwner ? indicatorLabel(owner) : indicatorLabel(member);
    for (const f of fields) {
      const ref: StyleRuleSeriesRef = { source: "indicator", ...(isOwner ? {} : { indicatorId: member.id }), ...(f.field ? { field: f.field } : {}) };
      // Une courbe simple porte le nom de l'indicateur ; une ligne d'un indicateur à plusieurs lignes, le nom de
      // l'indicateur suivi de celui de la ligne (« MACD signal », « BB(20,2) bande haute »).
      const short = indicatorCatalogEntry(member).shortLabel;
      const label = fields.length === 1 ? name : f.label.startsWith(short) ? f.label : `${short} ${f.label}`;
      options.push({ key: seriesRefKey(ref, owner.id), ref, label });
    }
  }
  const pane = stylePaneKind(owner);
  if (pane === "price") options.push({ key: "close", ref: { source: "close" }, label: "Cours de clôture" });
  if (pane === "volume") options.push({ key: "volume", ref: { source: "volume" }, label: "Volume" });
  return options;
}

/** Une ligne d'un point d'indicateur : `field` absent, sa valeur principale. */
export function seriesFieldValue(v: IndicatorValue | null | undefined, field: string | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (!field) return mainValue(v);
  if (typeof v === "number") return field === "value" && Number.isFinite(v) ? v : null;
  const o = v as unknown as Record<string, unknown>;
  if (o.multi && typeof o.multi === "object") {
    const sub = (o.multi as Record<string, unknown>)[field];
    if (typeof sub === "number") return Number.isFinite(sub) ? sub : null;
    return mainValue(sub as IndicatorValue | null | undefined);
  }
  const x = o[field];
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

/** Le niveau du milieu d'un oscillateur borné (50), 0 sinon : la valeur la plus parlante pour une nouvelle règle. */
function middleLevel(indicator: Indicator): number {
  return (["rsi", "chop", "stochastic", "mfi", "williamsR"] as string[]).includes(indicator.kind) ? 50 : 0;
}

let ruleCounter = 0;
function newRuleId(): string {
  ruleCounter += 1;
  return `rule-${Date.now().toString(36)}-${ruleCounter}`;
}

/** Une ancienne zone colorée (courbe ↔ niveau ou clôture, une couleur au-dessus, une autre en dessous) dans le
 *  nouveau format : « au-dessus de la référence → remplir en [au-dessus], sinon en [en dessous] » — exactement le même
 *  dessin. Une zone sans couleur au-dessus devient « en dessous de… » ; une zone sans aucune couleur reste, décochée. */
export function legacyFillToRule(fill: IndicatorFill): IndicatorStyleRule {
  const b: StyleRuleOperand = fill.reference === "close" ? { source: "close" } : { source: "value", value: fill.level ?? 0 };
  const base = { id: fill.id, a: { source: "indicator" } as StyleRuleSeriesRef, b, effect: "fill" as const, opacity: fill.opacity ?? defaultRuleOpacity("fill") };
  if (fill.aboveColor) return { ...base, condition: "above", color: fill.aboveColor, elseColor: fill.belowColor ?? null };
  if (fill.belowColor) return { ...base, condition: "below", color: fill.belowColor };
  return { ...base, condition: "above", color: RULE_UP, enabled: false };
}

/** Les règles de couleur d'un indicateur : `styleRules`, ou à défaut ses anciennes zones colorées converties (les
 *  réglages enregistrés avant les règles s'affichent à l'identique ; ils passent au nouveau format à la première
 *  modification dans l'onglet Style). */
export function indicatorStyleRules(indicator: Indicator): IndicatorStyleRule[] {
  if (indicator.styleRules) return indicator.styleRules;
  return (indicator.fills ?? []).map(legacyFillToRule);
}

/** Une nouvelle règle, prête à lire : avec une autre courbe dans le panneau, « [l'indicateur] au-dessus de [l'autre]
 *  → remplir en vert, sinon en rouge » ; sinon la même chose face au milieu de son échelle (50 pour un RSI, 0 pour une
 *  MACD) ou face au cours pour une moyenne tracée sur les prix. */
export function defaultStyleRule(owner: Indicator, indicators: Indicator[]): IndicatorStyleRule {
  const options = styleSeriesOptions(owner, indicators);
  const a = options[0]?.ref ?? { source: "indicator" };
  const aKey = seriesRefKey(a, owner.id);
  const pane = stylePaneKind(owner);
  if (pane === "price") {
    // Moyenne au-dessus du cours : baissier (rouge), en dessous : haussier (vert), comme les anciennes zones.
    return { id: newRuleId(), a, condition: "above", b: { source: "close" }, effect: "fill", color: RULE_DOWN, elseColor: RULE_UP, opacity: 25 };
  }
  if (pane === "volume") {
    return { id: newRuleId(), a, condition: "above", b: { source: "volume" }, effect: "fill", color: RULE_DOWN, elseColor: RULE_UP, opacity: 20 };
  }
  const other = options.find((o) => o.key !== aKey && o.ref.source === "indicator" && o.ref.indicatorId);
  const b: StyleRuleOperand = other ? other.ref : { source: "value", value: middleLevel(owner) };
  return { id: newRuleId(), a, condition: "above", b, effect: "fill", color: RULE_UP, elseColor: RULE_DOWN, opacity: 25 };
}

/** Un modèle de règles en un clic, proposé sous la liste quand il a un sens pour ce panneau. */
export interface StyleRuleTemplate {
  id: string;
  label: string;
  rules: () => IndicatorStyleRule[];
}

export function styleRuleTemplates(owner: Indicator, indicators: Indicator[]): StyleRuleTemplate[] {
  const options = styleSeriesOptions(owner, indicators);
  if (options.length === 0) return [];
  const a = options[0]!.ref;
  const aKey = seriesRefKey(a, owner.id);
  // L'autre courbe la plus naturelle : une moyenne posée dessus, une autre courbe du panneau principal, le signal
  // d'une MACD… à défaut le cours (panneau principal) ou le volume.
  const other =
    options.find((o) => o.key !== aKey && o.ref.source === "indicator" && o.ref.indicatorId) ??
    options.find((o) => o.key !== aKey && o.ref.source === "indicator") ??
    options.find((o) => o.key !== aKey);
  const templates: StyleRuleTemplate[] = [];
  if (owner.kind === "rsi" && !owner.sourceId) {
    const high = owner.rsiOverbought ?? 70;
    const low = owner.rsiOversold ?? 30;
    templates.push({
      id: "overbought",
      label: "Surachat / survente",
      rules: () => [
        { id: newRuleId(), a, condition: "above", b: { source: "value", value: high }, effect: "fill", color: RULE_DOWN, opacity: 35 },
        { id: newRuleId(), a, condition: "below", b: { source: "value", value: low }, effect: "fill", color: RULE_UP, opacity: 35 },
      ],
    });
  }
  if (other) {
    templates.push({
      id: "between-curves",
      label: "Remplir entre deux courbes",
      rules: () => [{ id: newRuleId(), a, condition: "above", b: other.ref, effect: "fill", color: RULE_UP, elseColor: RULE_DOWN, opacity: 25 }],
    });
    templates.push({
      id: "line-vs",
      label: other.ref.source === "close" ? "Courbe au-dessus / en dessous du cours" : "Courbe au-dessus / en dessous de l'autre",
      rules: () => [{ id: newRuleId(), a, condition: "above", b: other.ref, effect: "line", color: RULE_UP, elseColor: RULE_DOWN, opacity: 100 }],
    });
    templates.push({
      id: "cross",
      label: "Croisements",
      rules: () => [
        { id: newRuleId(), a, condition: "crossUp", b: other.ref, effect: "marker", color: RULE_UP, opacity: 100 },
        { id: newRuleId(), a, condition: "crossDown", b: other.ref, effect: "marker", color: RULE_DOWN, opacity: 100 },
      ],
    });
  }
  return templates;
}
