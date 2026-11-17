import type { ScaleLinear } from "d3";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorBand } from "../interfaces/IndicatorBand.interface";
import { DONCHIAN_LINE_KEYS, resolveDonchianBackground, resolveDonchianLine } from "../donchian";
import { applyLineStyle } from "./drawPriceCandles";

const FIELD = { upper: "upper", basis: "middle", lower: "lower" } as const;

/** Les canaux de Donchian sur les prix : le fond entre les bandes, puis la base et les deux bandes, chacune avec sa
 *  couleur, son épaisseur, son style et son opacité (onglet Style). */
export function drawDonchianBand(
  ctx: CanvasRenderingContext2D,
  indicator: Indicator,
  points: { i: number; value: IndicatorBand }[],
  xAt: (i: number) => number,
  yAt: ScaleLinear<number, number>,
  isEink: boolean,
  inkColor: string,
) {
  if (points.length === 0) return;
  ctx.save();
  const bg = resolveDonchianBackground(indicator);
  if (bg.show && bg.opacity > 0 && !isEink) {
    ctx.globalAlpha = bg.opacity / 100;
    ctx.fillStyle = bg.color;
    ctx.beginPath();
    points.forEach((p, k) => {
      const x = xAt(p.i + 0.5);
      const y = yAt(p.value.upper);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    for (let k = points.length - 1; k >= 0; k--) ctx.lineTo(xAt(points[k].i + 0.5), yAt(points[k].value.lower));
    ctx.closePath();
    ctx.fill();
  }
  for (const key of DONCHIAN_LINE_KEYS) {
    const line = resolveDonchianLine(indicator, key);
    if (!line.show || line.opacity <= 0) continue;
    ctx.globalAlpha = line.opacity / 100;
    ctx.strokeStyle = isEink ? inkColor : line.color;
    ctx.lineWidth = line.width;
    applyLineStyle(ctx, line.lineStyle);
    ctx.beginPath();
    points.forEach((p, k) => {
      const x = xAt(p.i + 0.5);
      const y = yAt(p.value[FIELD[key]]);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.restore();
}
