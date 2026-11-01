/** Axe des flèches qui font circuler : `"horizontal"` (← →), `"vertical"` (↑ ↓) ou `"both"` (les
 *  quatre, comme un groupe radio natif). */
export type RovingAxis = "horizontal" | "vertical" | "both";

/**
 * Index visé par une touche de navigation dans une liste à focus itinérant (onglets, groupe radio,
 * menu) : flèches selon `axis`, Début/Fin. La liste boucle aux deux bouts et saute les entrées
 * désactivées. Renvoie `null` quand la touche ne concerne pas la liste — l'appelant laisse alors
 * l'événement suivre son cours au lieu d'appeler `preventDefault`.
 */
export function rovingTarget(
  key: string,
  current: number,
  count: number,
  axis: RovingAxis,
  isDisabled: (index: number) => boolean = () => false
): number | null {
  if (count === 0) return null;
  const prevKeys = axis === "horizontal" ? ["ArrowLeft"] : axis === "vertical" ? ["ArrowUp"] : ["ArrowLeft", "ArrowUp"];
  const nextKeys = axis === "horizontal" ? ["ArrowRight"] : axis === "vertical" ? ["ArrowDown"] : ["ArrowRight", "ArrowDown"];

  let start: number;
  let step: number;
  if (key === "Home") {
    start = 0;
    step = 1;
  } else if (key === "End") {
    start = count - 1;
    step = -1;
  } else if (nextKeys.includes(key)) {
    start = current + 1;
    step = 1;
  } else if (prevKeys.includes(key)) {
    start = current - 1;
    step = -1;
  } else {
    return null;
  }

  for (let n = 0; n < count; n++) {
    const i = (((start + n * step) % count) + count) % count;
    if (!isDisabled(i)) return i;
  }
  return null;
}
