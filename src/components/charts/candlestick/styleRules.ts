import type { Indicator } from "./interfaces/Indicator.interface";
import type { IndicatorFill } from "./interfaces/IndicatorFill.interface";
import type { IndicatorAreaFill } from "./interfaces/IndicatorAreaFill.interface";
import type { IndicatorValue } from "./interfaces/IndicatorValue.interface";
import type {
  IndicatorStyleRule,
  RuleIcon,
  StyleRuleCondition,
  StyleRuleEffect,
  StyleRuleOperand,
  StyleRuleLevelRef,
  StyleRuleSeriesRef,
} from "./interfaces/IndicatorStyleRule.interface";
import { indicatorCatalogEntry, indicatorLabel } from "./indicatorCatalog";
import { VOLUME_PANE_ID, mainValue } from "./attachedIndicators";

/**
 * Règles de couleur des indicateurs (onglet Style, « Style conditionnel ») : ce que l'éditeur et le rendu
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

/** Taille par défaut d'une icône de règle, en pixels CSS, et ses bornes. */
export const RULE_ICON_SIZE = 14;
export const RULE_ICON_MIN_SIZE = 8;
export const RULE_ICON_MAX_SIZE = 40;

/** L'icône proposée quand on choisit « Ajouter une icône » : un triangle sous la courbe qui croise à la hausse, au-dessus
 *  de celle qui croise à la baisse, sinon une flèche vers le haut au-dessus du point. */
export function defaultRuleIcon(condition: StyleRuleCondition): RuleIcon {
  if (condition === "crossUp") return { name: "triangle-up", size: RULE_ICON_SIZE, position: "below" };
  if (condition === "crossDown") return { name: "triangle-down", size: RULE_ICON_SIZE, position: "above" };
  return { name: "arrow-up", size: RULE_ICON_SIZE, position: "above" };
}

/** L'icône d'une règle, complétée de ses défauts. */
export function resolvedRuleIcon(icon: RuleIcon | null | undefined): Required<Omit<RuleIcon, "color">> & { color?: string } {
  const size = Math.min(RULE_ICON_MAX_SIZE, Math.max(RULE_ICON_MIN_SIZE, icon?.size ?? RULE_ICON_SIZE));
  return { name: icon?.name || "circle-filled", size, position: icon?.position ?? "above", ...(icon?.color ? { color: icon.color } : {}) };
}

/** L'ancien effet « marquer d'un point » (retiré du menu) lu comme une icône « Point » centrée sur la courbe, de la
 *  taille de l'ancien point : même dessin, et la règle s'édite comme les autres. Les autres règles passent telles
 *  quelles (même objet). */
export function migrateStyleRule(rule: IndicatorStyleRule): IndicatorStyleRule {
  if (rule.effect !== "marker") return rule;
  return { ...rule, effect: "icon", icon: rule.icon ?? { name: "circle-filled", size: 10, position: "on" } };
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
  "expectedVolatility",
  "rangeDetection",
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
export function seriesRefKey(ref: StyleRuleSeriesRef | StyleRuleLevelRef, ownerId: string): string {
  if (ref.source === "level") return levelKey(ref.level);
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
 *  modification dans l'onglet Style). Les règles « marquer d'un point » sont lues comme des icônes (`migrateStyleRule`). */
export function indicatorStyleRules(indicator: Indicator): IndicatorStyleRule[] {
  if (indicator.styleRules) return indicator.styleRules.some((r) => r.effect === "marker") ? indicator.styleRules.map(migrateStyleRule) : indicator.styleRules;
  return (indicator.fills ?? []).map(legacyFillToRule);
}

/** Les zones remplies d'un indicateur : les siennes (`areaFills`, réglées dans les paramètres du panneau), sinon celles
 *  de son script (`customData.areaFills`, `pane.fillBetween`). */
export function indicatorAreaFills(indicator: Indicator): IndicatorAreaFill[] {
  return indicator.areaFills ?? indicator.customData?.areaFills ?? [];
}

/** Une zone remplie dans le format des règles, que le rendu sait déjà peindre (découpée aux croisements, derrière les
 *  lignes) : « [ligne] au-dessus de [bord] → remplir en [au-dessus], sinon en [en dessous] ». L'opacité est dans les
 *  couleurs, la règle est donc pleine. Une zone sans aucune couleur ne peint rien. */
export function areaFillToRule(fill: IndicatorAreaFill): IndicatorStyleRule | null {
  const a: StyleRuleSeriesRef = { source: "indicator", ...(fill.field ? { field: fill.field } : {}) };
  const base = { id: `area-${fill.id}`, enabled: fill.enabled, a, b: fill.to, effect: "fill" as const, opacity: 100 };
  if (fill.aboveColor) return { ...base, condition: "above", color: fill.aboveColor, elseColor: fill.belowColor ?? null };
  if (fill.belowColor) return { ...base, condition: "below", color: fill.belowColor };
  return null;
}

/** Ce que le rendu peint pour un indicateur : ses zones remplies d'abord (sous tout le reste), puis ses règles de
 *  couleur. */
export function renderedStyleRules(indicator: Indicator): IndicatorStyleRule[] {
  const fills = indicatorAreaFills(indicator);
  const rules = indicatorStyleRules(indicator);
  if (fills.length === 0) return rules;
  return [...fills.map(areaFillToRule).filter((r): r is IndicatorStyleRule => r !== null), ...rules];
}

let areaFillCounter = 0;
/** Un id de zone remplie, unique dans la session. */
export function newAreaFillId(): string {
  areaFillCounter += 1;
  return `fill-${Date.now().toString(36)}-${areaFillCounter}`;
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

/** Valeur d'un niveau d'un indicateur (voir `StyleRuleLevelRef`) : undefined s'il n'a pas de niveaux. */
export function indicatorLevelValue(ind: Indicator, level: "upper" | "lower" | "middle"): number | undefined {
  if (ind.kind === "rsi") return level === "upper" ? (ind.rsiOverbought ?? 70) : level === "lower" ? (ind.rsiOversold ?? 30) : 50;
  if (ind.kind === "chop") return level === "upper" ? (ind.chopUpperThreshold ?? 61.8) : level === "lower" ? (ind.chopLowerThreshold ?? 38.2) : 50;
  return undefined;
}

/** Un niveau proposé dans les menus de référence d'une règle (« le seuil de surachat (70) »). */
export interface StyleLevelOption {
  key: string;
  label: string;
  ref: StyleRuleOperand;
}

/** Clé de menu d'un niveau. */
export function levelKey(level: "upper" | "lower" | "middle"): string {
  return `level:${level}`;
}

/** Les niveaux de l'indicateur qui porte la règle, utilisables comme référence ou borne. */
export function styleLevelOptions(owner: Indicator): StyleLevelOption[] {
  if (owner.kind !== "rsi" && owner.kind !== "chop") return [];
  const names =
    owner.kind === "rsi"
      ? { upper: "le seuil de surachat", lower: "le seuil de survente", middle: "la ligne médiane" }
      : { upper: "le seuil haut", lower: "le seuil bas", middle: "la ligne médiane" };
  return (["upper", "lower", "middle"] as const).map((level) => ({
    key: levelKey(level),
    label: `${names[level]} (${String(indicatorLevelValue(owner, level)).replace(".", ",")})`,
    ref: { source: "level", level },
  }));
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
    templates.push({
      id: "overbought",
      label: "Surachat / survente",
      rules: () => [
        // Les seuils de l'indicateur, pas leur valeur du moment : la règle suit un seuil déplacé.
        { id: newRuleId(), a, condition: "above", b: { source: "level", level: "upper" }, effect: "fill", color: RULE_DOWN, opacity: 35 },
        { id: newRuleId(), a, condition: "below", b: { source: "level", level: "lower" }, effect: "fill", color: RULE_UP, opacity: 35 },
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
        { id: newRuleId(), a, condition: "crossUp", b: other.ref, effect: "icon", icon: defaultRuleIcon("crossUp"), color: RULE_UP, opacity: 100 },
        { id: newRuleId(), a, condition: "crossDown", b: other.ref, effect: "icon", icon: defaultRuleIcon("crossDown"), color: RULE_DOWN, opacity: 100 },
      ],
    });
  }
  return templates;
}

/** Ce qu'une règle d'un AUTRE indicateur peut viser, pour la montrer dans les paramètres de la cible (« Règles liées ») :
 *  une courbe d'un indicateur, le cours de clôture (paramètres du symbole) ou le volume (paramètres du Volume). */
export type StyleRuleTarget = { kind: "indicator"; id: string } | { kind: "close" } | { kind: "volume" };

/** Vrai si la référence désigne la cible. Une référence d'indicateur sans `indicatorId` désigne l'indicateur qui porte
 *  la règle : elle ne vise donc jamais un autre indicateur. */
function refTargets(ref: StyleRuleOperand | undefined, target: StyleRuleTarget): boolean {
  if (!ref) return false;
  if (target.kind === "indicator") return ref.source === "indicator" && ref.indicatorId === target.id;
  return ref.source === target.kind;
}

/** Les règles d'un indicateur propriétaire qui citent la cible (en courbe A, référence B ou borne C). */
export interface LinkedStyleRuleGroup {
  owner: Indicator;
  /** Toutes les règles du propriétaire (pour réécrire sa liste) et, parmi elles, celles qui citent la cible. */
  allRules: IndicatorStyleRule[];
  rules: IndicatorStyleRule[];
}

/**
 * « Règles liées » : les règles de style conditionnel des autres indicateurs qui citent la cible — la SMA(50) qui
 * remplit entre elle et la SMA(20), vue depuis les paramètres de la SMA(20). Regroupées par indicateur propriétaire,
 * dans l'ordre des indicateurs ; la cible elle-même est exclue (ses règles sont les siennes).
 */
export function linkedStyleRuleGroups(target: StyleRuleTarget, indicators: Indicator[]): LinkedStyleRuleGroup[] {
  const groups: LinkedStyleRuleGroup[] = [];
  for (const owner of indicators) {
    if (target.kind === "indicator" && owner.id === target.id) continue;
    const allRules = indicatorStyleRules(owner);
    const rules = allRules.filter((r) => refTargets(r.a, target) || refTargets(r.b, target) || (isRangeCondition(r.condition) && refTargets(r.c, target)));
    if (rules.length > 0) groups.push({ owner, allRules, rules });
  }
  return groups;
}

/** Le compteur de la rubrique « Style conditionnel » : « 2 », ou « 0 + 2 liées » quand d'autres indicateurs ont des
 *  règles qui citent celui-ci. */
export function styleRulesCountLabel(own: number, linked: number): string | number {
  if (linked === 0) return own;
  return `${own} + ${linked} ${linked > 1 ? "liées" : "liée"}`;
}
