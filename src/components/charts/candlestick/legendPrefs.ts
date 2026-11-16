import type { Indicator } from "./interfaces/Indicator.interface";
import { indicatorLabel } from "./indicatorCatalog";
import { VOLUME_PANE_ID } from "./attachedIndicators";

/**
 * Préférences d'affichage des légendes, à retenir sur le compte plutôt qu'avec un graphique : elles valent pour tous
 * les symboles et survivent à un rechargement, quels que soient les ids des indicateurs (un indicateur de module, de
 * setup ou de script est recréé à chaque chargement, avec un id qui peut changer).
 *
 * Clés : « price » (la légende en haut à gauche), « volume », sinon la clé stable d'un indicateur
 * (`indicatorLegendKey` : son libellé, qui dit son type et ses paramètres, « RSI(14) », « MACD(12,26,9) », ou le nom du
 * script ; pour un indicateur posé sur un panneau, la clé du panneau puis la sienne).
 */
export interface ChartLegendPrefs {
  /** Listes d'indicateurs repliées (chevron) : la légende des prix (« price ») et celle de chaque panneau. */
  collapsed?: Record<string, boolean>;
  /** Légendes masquées (« Masquer la légende du… ») : celle du volume (« volume ») et celle de chaque indicateur. */
  hidden?: Record<string, boolean>;
  /** Sorties de script masquées par l'œil de leur légende (« script:Nom ») : recréées à chaque exécution et à chaque
   *  chargement, elles le restent après un rechargement. Les indicateurs ajoutés gardent leur `hidden` avec eux. */
  indicatorHidden?: Record<string, boolean>;
}

/** La clé stable d'un indicateur pour ses préférences de légende. `all` : les indicateurs du graphique, pour nommer le
 *  panneau qui porte un indicateur posé dessus. */
export function indicatorLegendKey(ind: Indicator, all: Indicator[]): string {
  const own = ind.customData ? `script:${ind.customData.label}` : indicatorLabel(ind);
  if (!ind.sourceId) return own;
  if (ind.sourceId === VOLUME_PANE_ID) return `volume › ${own}`;
  const host = all.find((i) => i.id === ind.sourceId && i.id !== ind.id);
  return `${host ? indicatorLegendKey(host, all.filter((i) => i.id !== ind.id)) : ind.sourceId} › ${own}`;
}

/** La clé d'une zone de légende : « price », « volume », ou celle de l'indicateur d'id `paneId`. */
export function legendZoneKey(paneId: string, all: Indicator[]): string | null {
  if (paneId === "price" || paneId === VOLUME_PANE_ID) return paneId;
  const ind = all.find((i) => i.id === paneId);
  return ind ? indicatorLegendKey(ind, all) : null;
}

/** Les indicateurs masqués ou affichés (œil) selon les préférences, quand elles en disent quelque chose. */
export function withHiddenPrefs(list: Indicator[], all: Indicator[], hidden: Record<string, boolean> | undefined): Indicator[] {
  if (!hidden || Object.keys(hidden).length === 0) return list;
  let changed = false;
  const out = list.map((ind) => {
    const pref = hidden[indicatorLegendKey(ind, all)];
    if (pref === undefined || (ind.hidden === true) === pref) return ind;
    changed = true;
    return { ...ind, hidden: pref || undefined };
  });
  return changed ? out : list;
}

/** Les indicateurs avec leur légende masquée ou non selon les préférences (quand elles en disent quelque chose). */
export function withLegendPrefs(list: Indicator[], all: Indicator[], hidden: Record<string, boolean> | undefined): Indicator[] {
  if (!hidden || Object.keys(hidden).length === 0) return list;
  let changed = false;
  const out = list.map((ind) => {
    const pref = hidden[indicatorLegendKey(ind, all)];
    if (pref === undefined || (ind.legendHidden === true) === pref) return ind;
    changed = true;
    return { ...ind, legendHidden: pref || undefined };
  });
  return changed ? out : list;
}
