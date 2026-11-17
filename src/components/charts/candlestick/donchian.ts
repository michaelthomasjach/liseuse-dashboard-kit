import type { Candle } from "./interfaces/Candle.interface";
import type { Indicator } from "./interfaces/Indicator.interface";
import type { IndicatorBand } from "./interfaces/IndicatorBand.interface";
import type { DonchianBackground, DonchianLineKey, IndicatorLineStyle } from "./interfaces/IndicatorLineStyle.interface";

/** Canaux de Donchian (`kind: "donchian"`) : sur les N dernières bougies, la bande supérieure est le plus haut des plus
 *  hauts, la bande inférieure le plus bas des plus bas, et la base le milieu des deux. Valeur au format `IndicatorBand`
 *  (`upper`, `middle` = la base, `lower`), comme les bandes de Bollinger. */

export const DONCHIAN_DEFAULT_PERIOD = 20;

/** Dans l'ordre des réglages : la base, puis les deux bandes. */
export const DONCHIAN_LINE_KEYS: DonchianLineKey[] = ["basis", "upper", "lower"];

export const DONCHIAN_LINE_DEFAULTS: Record<DonchianLineKey, Required<IndicatorLineStyle>> = {
  basis: { show: true, color: "#ff6d00", lineStyle: "solid", opacity: 100, width: 1 },
  upper: { show: true, color: "#2962ff", lineStyle: "solid", opacity: 100, width: 1 },
  lower: { show: true, color: "#2962ff", lineStyle: "solid", opacity: 100, width: 1 },
};

export const DONCHIAN_LINE_LABELS: Record<DonchianLineKey, string> = {
  basis: "Base (milieu du canal)",
  upper: "Bande supérieure",
  lower: "Bande inférieure",
};

export const DONCHIAN_BACKGROUND_DEFAULT: Required<DonchianBackground> = { show: true, color: "#2962ff", opacity: 8 };

/** Les canaux sur `period` bougies, décalés de `offset` bougies (positif : vers la droite, la valeur d'une bougie est
 *  celle calculée `offset` bougies plus tôt ; négatif : vers la gauche). Pas de valeur tant que la fenêtre n'est pas
 *  pleine, ni là où le décalage sort de l'historique. */
export function computeDonchianValues(data: Candle[], period: number, offset = 0): (IndicatorBand | null)[] {
  const n = data.length;
  const p = Math.max(1, Math.floor(period));
  const raw: (IndicatorBand | null)[] = new Array(n).fill(null);
  for (let i = p - 1; i < n; i++) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let k = i - p + 1; k <= i; k++) {
      if (data[k].high > hi) hi = data[k].high;
      if (data[k].low < lo) lo = data[k].low;
    }
    if (Number.isFinite(hi) && Number.isFinite(lo)) raw[i] = { upper: hi, middle: (hi + lo) / 2, lower: lo };
  }
  const shift = Math.round(offset);
  if (shift === 0) return raw;
  return raw.map((_, i) => {
    const from = i - shift;
    return from >= 0 && from < n ? raw[from] : null;
  });
}

export function resolveDonchianLine(indicator: Indicator, key: DonchianLineKey): Required<IndicatorLineStyle> {
  const own = indicator.donchianLines?.[key] ?? {};
  const def = DONCHIAN_LINE_DEFAULTS[key];
  return {
    show: own.show ?? def.show,
    color: own.color ?? def.color,
    lineStyle: own.lineStyle ?? def.lineStyle,
    opacity: Math.max(0, Math.min(100, own.opacity ?? def.opacity)),
    width: own.width ?? def.width,
  };
}

export function resolveDonchianBackground(indicator: Indicator): Required<DonchianBackground> {
  const own = indicator.donchianBackground ?? {};
  return {
    show: own.show ?? DONCHIAN_BACKGROUND_DEFAULT.show,
    color: own.color ?? DONCHIAN_BACKGROUND_DEFAULT.color,
    opacity: Math.max(0, Math.min(100, own.opacity ?? DONCHIAN_BACKGROUND_DEFAULT.opacity)),
  };
}
