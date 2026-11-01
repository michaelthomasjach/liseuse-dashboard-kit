import type { ReactNode } from "react";

/** Ce que Slider et RangeSlider partagent : l'arrondi au pas, le clavier, la liste des graduations
 *  (leur rendu est dans SliderMarks.tsx). Les deux composants lisent aussi la même feuille
 *  (Slider.css) pour la piste, la poignée et la bulle. */

export interface SliderMarkLike {
  value: number;
  label?: ReactNode;
}

function decimalsOf(n: number): number {
  const s = String(n);
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
}

/** Ramène `raw` sur la grille du pas (comptée depuis `min`) et dans les bornes, sans les résidus de
 *  virgule flottante (0.1 + 0.2) qu'un `Math.round` seul laisserait passer dans `aria-valuenow`. */
export function snapToStep(raw: number, min: number, max: number, step: number): number {
  const stepped = Math.round((raw - min) / step) * step + min;
  const clamped = Math.min(max, Math.max(min, stepped));
  return Number(clamped.toFixed(Math.max(decimalsOf(step), decimalsOf(min))));
}

/** Enlève le bruit flottant d'une somme de valeurs déjà sur la grille. */
export function cleanFloat(v: number, step: number, min: number): number {
  return Number(v.toFixed(Math.max(decimalsOf(step), decimalsOf(min))));
}

/** La valeur visée par une touche, ou `null` si la touche ne concerne pas le curseur. Flèches : un
 *  pas (droite et haut augmentent, quelle que soit l'orientation) ; PageUp / PageDown : `pageStep`,
 *  par défaut un dixième de l'étendue arrondi au pas ; Début / Fin : `low` / `high`. */
export function keyTarget(
  key: string,
  value: number,
  { min, max, step, pageStep, low = min, high = max }: { min: number; max: number; step: number; pageStep?: number; low?: number; high?: number }
): number | null {
  const big = pageStep ?? Math.max(step, snapToStep(min + (max - min) / 10, min, max, step) - min);
  let next: number;
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      next = value + step;
      break;
    case "ArrowLeft":
    case "ArrowDown":
      next = value - step;
      break;
    case "PageUp":
      next = value + big;
      break;
    case "PageDown":
      next = value - big;
      break;
    case "Home":
      next = low;
      break;
    case "End":
      next = high;
      break;
    default:
      return null;
  }
  return Math.min(high, Math.max(low, snapToStep(next, min, max, step)));
}

/** `marks={true}` → un trait par pas (aucun au-delà de 100 crans : ils se toucheraient) ; une liste →
 *  ses positions comprises entre les bornes. */
export function resolveMarks(marks: boolean | SliderMarkLike[] | undefined, min: number, max: number, step: number): SliderMarkLike[] {
  if (marks === true) {
    const count = Math.floor((max - min) / step);
    const list: SliderMarkLike[] = [];
    if (count <= 100) for (let i = 0; i <= count; i++) list.push({ value: snapToStep(min + i * step, min, max, step) });
    return list;
  }
  return Array.isArray(marks) ? marks.filter((m) => m.value >= min && m.value <= max) : [];
}

export function hasMarkLabels(list: SliderMarkLike[]): boolean {
  return list.some((m) => m.label !== undefined && m.label !== null && m.label !== "");
}
