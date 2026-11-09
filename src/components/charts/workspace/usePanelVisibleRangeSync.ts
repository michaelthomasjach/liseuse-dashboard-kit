import { useCallback, useRef, useState } from "react";
import type { ChartVisibleRange } from "../candlestick/interfaces/ChartVisibleRange.interface";

export interface UsePanelVisibleRangeSyncArgs {
  /** Link groups already clamped to the live panel count, each a list of panel indices. */
  groups: number[][];
  /** Which group a panel belongs to, or null when it is in none. */
  groupIndexOfPanel: (panelIndex: number) => number | null;
}

/** Le dernier geste qui a déplacé la vue d'un panneau lié : qui, quelle plage, et sous quels groupes. */
interface RangeGesture {
  panelIndex: number;
  range: ChartVisibleRange;
  /** Les groupes tels qu'ils étaient au moment du geste (voir `groupsKey`). */
  groupsKey: string;
}

/** La fenêtre visible partagée entre les panneaux d'un même groupe lié — le pendant de
 *  `usePanelCrosshairSync` pour le déplacement et le zoom : quand l'utilisateur déplace un panneau,
 *  les autres panneaux de son groupe montrent la même plage de dates (voir
 *  CandlestickChartProps.syncedVisibleRange / onVisibleRangeChange).
 *
 *  Un seul geste retenu pour tout l'espace de travail, pas un par panneau : on ne déplace qu'un
 *  graphique à la fois, et celui qu'on déplace mène. Chaque autre panneau de SON groupe reçoit sa
 *  plage ; lui-même, les panneaux hors de son groupe et ceux d'aucun groupe reçoivent `null`, qui ne
 *  déplace rien — passer à un autre groupe laisse donc chaque groupe où il en était. Des dates plutôt
 *  qu'une transformation en pixels : chaque panneau a ses propres bougies (symbole, unité de temps,
 *  historique) et se cale dessus lui-même.
 *
 *  Le geste ne vaut que pour les groupes sous lesquels il a été fait : lier, délier ou regrouper des
 *  panneaux ne déplace rien tant que l'utilisateur ne touche pas de nouveau à l'un d'eux, plutôt que
 *  d'aligner d'un coup un panneau tout juste lié sur un geste fait quand il ne l'était pas. Pas de
 *  boucle possible : un panneau qui applique une plage reçue ne la rapporte jamais (le graphique
 *  n'appelle `onVisibleRangeChange` que pour un geste de l'utilisateur). */
export function usePanelVisibleRangeSync({ groups, groupIndexOfPanel }: UsePanelVisibleRangeSyncArgs) {
  const groupsKey = groups.map((group) => group.join(",")).join("|");
  const [lastGesture, setLastGesture] = useState<RangeGesture | null>(null);

  // Lus par `reportVisibleRange`, stable (useCallback sans dépendance) : tenus à jour pendant le rendu,
  // comme le fait useHoverSync pour ses propres rappels.
  const liveRef = useRef({ groupsKey, groupIndexOfPanel });
  liveRef.current = { groupsKey, groupIndexOfPanel };

  /** Appelé par un panneau à chaque image d'un geste qui change sa plage visible. Ignoré pour un
   *  panneau hors de tout groupe : personne ne le suit, et retenir son geste ferait redessiner tout
   *  l'espace de travail à chaque image pour rien. */
  const reportVisibleRange = useCallback((panelIndex: number, range: ChartVisibleRange) => {
    const { groupsKey: key, groupIndexOfPanel: groupOf } = liveRef.current;
    if (groupOf(panelIndex) === null) return;
    setLastGesture((prev) =>
      prev &&
      prev.panelIndex === panelIndex &&
      prev.groupsKey === key &&
      prev.range.start.getTime() === range.start.getTime() &&
      prev.range.end.getTime() === range.end.getTime()
        ? prev
        : { panelIndex, range, groupsKey: key }
    );
  }, []);

  /** La plage qu'un panneau doit reproduire : celle du dernier geste fait sur un AUTRE panneau de son
   *  groupe, ou null (il est lui-même le meneur, le geste vient d'ailleurs, ou il n'est dans aucun
   *  groupe). */
  function syncedRangeForPanel(panelIndex: number): ChartVisibleRange | null {
    if (!lastGesture || lastGesture.groupsKey !== groupsKey || lastGesture.panelIndex === panelIndex) return null;
    const groupIndex = groupIndexOfPanel(panelIndex);
    if (groupIndex === null || !groups[groupIndex].includes(lastGesture.panelIndex)) return null;
    return lastGesture.range;
  }

  return { reportVisibleRange, syncedRangeForPanel };
}
