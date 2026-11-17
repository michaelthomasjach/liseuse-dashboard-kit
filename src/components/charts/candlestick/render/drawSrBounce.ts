import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorBounceZone } from "../interfaces/IndicatorBounceZone.interface";
import { SR_BOUNCE_DEFAULTS, srBounceLabel } from "../srBounce";
import { drawPriceBoxes, type PriceBox } from "./drawPriceBoxes";

/** « Probabilité de rebond » : chaque zone en rectangle, de son premier pivot au bord droit du graphique (un niveau se
 *  projette vers l'avenir), en vert sous le prix (support) et en rouge au-dessus (résistance), d'autant plus opaque que
 *  la probabilité de rebond est forte. Le libellé — rôle, prix, probabilité — est écrit à droite, au bord de la zone ;
 *  avec « Détail du calcul », les facteurs qui pèsent le plus suivent en dessous. */
export function drawSrBounce(
  ctx: CanvasRenderingContext2D,
  points: { i: number; value: IndicatorBounceZone[] }[],
  indicator: Indicator,
  params: RenderCandlestickChartParams,
  style: ChartCanvasStyle,
) {
  const zones = points.length > 0 ? points[points.length - 1].value : [];
  if (zones.length === 0) return;
  const d = SR_BOUNCE_DEFAULTS;
  const supportColor = indicator.srbSupportColor ?? d.supportColor;
  const resistanceColor = indicator.srbResistanceColor ?? d.resistanceColor;
  const opacity = Math.min(100, Math.max(0, indicator.srbOpacity ?? d.opacity)) / 100;
  const showLabels = indicator.srbShowLabels ?? d.showLabels;
  const showFactors = indicator.srbShowFactors ?? false;
  const colorOf = (z: IndicatorBounceZone) => (style.isEink ? style.colorText : z.role === "support" ? supportColor : resistanceColor);
  const farRight = params.data.length + 10_000;

  const boxes: PriceBox[] = zones.map((z) => ({
    fromIndex: z.startIndex,
    toIndex: farRight,
    top: z.top,
    bottom: z.bottom,
    color: colorOf(z),
    // Plus la probabilité est forte, plus la zone est marquée (entre la moitié et une fois et demie l'opacité réglée).
    fillOpacity: opacity * (0.5 + z.probability / 100),
    dashed: z.probability < 50,
  }));
  drawPriceBoxes(ctx, boxes, params, style);
  if (!showLabels) return;

  const { zoomedPriceScale, dims } = params;
  ctx.save();
  ctx.textAlign = "right";
  // Liseré de la couleur du fond : le libellé reste lisible quand il passe sur les bougies.
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = style.colorBg;
  const write = (text: string, x: number, y: number) => {
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  };
  // De haut en bas ; un libellé qui chevaucherait celui de la zone du dessus (zones proches) descend juste en dessous.
  const LABEL_H = 13;
  const FACTORS_H = 13;
  let blockBottom = -Infinity;
  const ordered = [...zones].sort((a, b) => b.top - a.top);
  for (const z of ordered) {
    const yTop = zoomedPriceScale(z.top);
    if (!Number.isFinite(yTop)) continue;
    const baseline = Math.max(yTop - 3, blockBottom + LABEL_H);
    const color = colorOf(z);
    ctx.fillStyle = color;
    ctx.font = `600 11px ${style.fontFamily}`;
    ctx.textBaseline = "bottom";
    write(srBounceLabel(z), dims.boundedWidth - 8, baseline);
    blockBottom = baseline + 1;
    if (showFactors) {
      const top = [...z.factors].filter((f) => f.effect !== 0).sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)).slice(0, 3);
      if (top.length > 0) {
        ctx.font = `500 10px ${style.fontFamily}`;
        ctx.textBaseline = "top";
        write(top.map((f) => `${f.label} ${f.effect > 0 ? "+" : "−"}${Math.abs(f.effect)}`).join(" · "), dims.boundedWidth - 8, baseline + 3);
        blockBottom = baseline + 3 + FACTORS_H;
      }
    }
  }
  ctx.restore();
}
