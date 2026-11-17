import type { Indicator } from "./interfaces/Indicator.interface";
import type { IndicatorStyleRule, StyleRuleOperand } from "./interfaces/IndicatorStyleRule.interface";
import type { IndicatorAreaFill } from "./interfaces/IndicatorAreaFill.interface";
import { scriptIdFromIndicatorId } from "./scripting/scriptOutputToCustomIndicatorDef";

/*
 * Réglages d'un indicateur retenus par type (comme TradingView) : les derniers réglages de chaque type deviennent ceux du
 * prochain indicateur du même type, et des modèles nommés se rappliquent depuis la fenêtre de paramètres. Seuls les
 * réglages voyagent (périodes, seuils, couleurs, opacités, épaisseurs, lignes affichées, style conditionnel…), jamais ce
 * qui est propre à un exemplaire (id, panneau d'attache, unité de temps, symbole corrélé, visibilité…).
 */

/** Réglages d'un indicateur, sans ce qui est propre à un exemplaire (voir `INDICATOR_INSTANCE_KEYS`). */
export type IndicatorSettings = Partial<Omit<Indicator, (typeof INDICATOR_INSTANCE_KEYS)[number]>>;

/** Derniers réglages par type d'indicateur (clé : voir `indicatorSettingsKey`). */
export type IndicatorSettingsByKind = Record<string, IndicatorSettings>;

/** Un modèle de configuration d'indicateur (menu « Modèles » de ses paramètres). */
export interface IndicatorTemplate {
  id: string;
  name: string;
  /** Le type auquel il s'applique (voir `indicatorSettingsKey`) : un modèle de RSI ne se propose que sur un RSI. */
  kind: string;
  settings: IndicatorSettings;
}

/** Champs propres à un exemplaire : jamais retenus ni recopiés d'un indicateur à l'autre. */
export const INDICATOR_INSTANCE_KEYS = [
  "id",
  "kind",
  "customData",
  "sourceId",
  "timeframe",
  "hidden",
  "paneCollapsed",
  "legendHidden",
  "priceOverlay",
  "recognitionDateLimit",
  "correlationSymbol",
  "correlationSymbolName",
  "correlationData",
] as const satisfies readonly (keyof Indicator)[];

/** Le type d'un indicateur, clé de ses réglages retenus et de ses modèles : son `kind` (« rsi », « macd »…) ; suivi de
 *  « @pane » pour une moyenne posée sur le panneau d'un autre indicateur (ses réglages ne sont pas ceux d'une moyenne
 *  des prix) ; « script:Nom » pour la sortie d'un script (le nom de son panneau) ; « custom:id » pour un indicateur
 *  fourni par l'application (`customIndicators`). */
export function indicatorSettingsKey(ind: Pick<Indicator, "kind" | "customData" | "sourceId">): string {
  if (ind.customData) {
    return scriptIdFromIndicatorId(ind.customData.id) !== null ? `script:${ind.customData.label}` : `custom:${ind.customData.id}`;
  }
  return ind.sourceId ? `${ind.kind}@pane` : ind.kind;
}

/** Une référence à une courbe qui vise un autre indicateur (par son id) n'a pas de sens sur un autre exemplaire. */
function foreignRef(op: StyleRuleOperand | undefined, ownId: string): boolean {
  return !!op && "indicatorId" in op && op.indicatorId !== undefined && op.indicatorId !== ownId;
}
/** La référence à l'indicateur lui-même devient implicite (`indicatorId` absent), pour suivre l'exemplaire suivant. */
function ownRef<T extends StyleRuleOperand | undefined>(op: T, ownId: string): T {
  if (!op || !("indicatorId" in op) || op.indicatorId !== ownId) return op;
  const next = { ...op } as Record<string, unknown>;
  delete next.indicatorId;
  return next as T;
}

/** Les réglages d'un indicateur, prêts à être retenus ou enregistrés dans un modèle : sans les champs propres à
 *  l'exemplaire ni les valeurs absentes ; les règles de style qui citent un autre indicateur sont écartées, celles qui
 *  le citent lui-même le font sans son id. */
export function indicatorSettingsOf(ind: Indicator): IndicatorSettings {
  const out: Record<string, unknown> = {};
  const skip = new Set<string>(INDICATOR_INSTANCE_KEYS);
  for (const [k, v] of Object.entries(ind)) {
    if (skip.has(k) || v === undefined || typeof v === "function") continue;
    out[k] = v;
  }
  if (ind.styleRules) {
    out.styleRules = ind.styleRules
      .filter((r) => !foreignRef(r.a, ind.id) && !foreignRef(r.b, ind.id) && !foreignRef(r.c, ind.id))
      .map((r): IndicatorStyleRule => ({ ...r, a: ownRef(r.a, ind.id), b: ownRef(r.b, ind.id), ...(r.c ? { c: ownRef(r.c, ind.id) } : {}) }));
  }
  if (ind.areaFills) {
    out.areaFills = ind.areaFills.filter((f) => !foreignRef(f.to, ind.id)).map((f): IndicatorAreaFill => ({ ...f, to: ownRef(f.to, ind.id) }));
  }
  return out as IndicatorSettings;
}

/** L'indicateur habillé de réglages retenus ou d'un modèle : `base` (ses valeurs par défaut, identité comprise) puis les
 *  réglages ; ce qui est propre à l'exemplaire reste celui de `ind`. */
export function withIndicatorSettings(ind: Indicator, base: Indicator, settings: IndicatorSettings): Indicator {
  const own: Record<string, unknown> = {};
  for (const k of INDICATOR_INSTANCE_KEYS) if (ind[k] !== undefined) own[k] = ind[k];
  return { ...base, ...(settings as Partial<Indicator>), ...(own as Partial<Indicator>) } as Indicator;
}

/** JSON aux clés triées : deux réglages égaux s'écrivent pareil, quel que soit l'ordre de leurs champs. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return v;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(v as Record<string, unknown>).sort()) sorted[key] = (v as Record<string, unknown>)[key];
    return sorted;
  });
}

export function sameIndicatorSettings(a: IndicatorSettings | undefined, b: IndicatorSettings | undefined): boolean {
  if (!a || !b) return a === b;
  return stableJson(a) === stableJson(b);
}
