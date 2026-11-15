import type { Indicator } from "./interfaces/Indicator.interface";
import type { IndicatorWatermark } from "./interfaces/IndicatorWatermark.interface";
import { indicatorLabel } from "./indicatorCatalog";

export const DEFAULT_PANE_WATERMARK_OPACITY = 0.08;

/** Le filigrane réglé (celui de l'utilisateur, sinon celui du script), tel quel — sans le défaut du texte. */
export function indicatorWatermarkSetting(ind: Indicator): IndicatorWatermark | undefined {
  const fromScript = ind.customData?.watermark;
  if (!ind.watermark && !fromScript) return undefined;
  return { ...fromScript, ...ind.watermark };
}

/** Ce que le panneau affiche en fond, ou null : texte (le nom de l'indicateur par défaut), opacité, taille. */
export function resolveIndicatorWatermark(ind: Indicator): { text: string; opacity: number; size: number } | null {
  const w = indicatorWatermarkSetting(ind);
  if (!w || w.visible === false) return null;
  const text = w.text?.trim() || indicatorLabel(ind);
  return { text, opacity: w.opacity ?? DEFAULT_PANE_WATERMARK_OPACITY, size: w.size ?? 100 };
}
