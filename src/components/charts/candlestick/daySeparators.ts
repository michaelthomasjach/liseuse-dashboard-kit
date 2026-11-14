import type { RenderCandlestickChartParams } from "./interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "./interfaces/ChartCanvasStyle.interface";

/**
 * Séparateurs de jours (outil du rail de gauche) : un trait vertical à chaque changement de jour et, entre deux traits,
 * le nom du jour (« Lundi », « Mardi »…). Utile en intrajournalier ; sur une unité d'un jour ou plus chaque bougie est
 * déjà un jour, rien n'est dessiné.
 */
export interface DaySeparatorSettings {
  enabled: boolean;
  /** Position verticale du nom du jour dans le panneau des prix. */
  vAlign: "top" | "middle" | "bottom";
  /** Position horizontale du nom du jour entre ses deux traits. */
  hAlign: "left" | "center" | "right";
  /** Opacité de l'ensemble (traits et textes), 0–1. */
  opacity: number;
  textColor: string;
  lineColor: string;
  lineStyle: "solid" | "dashed" | "dotted";
  lineWidth: number;
  fontSize: number;
}

export const DEFAULT_DAY_SEPARATORS: DaySeparatorSettings = {
  enabled: false,
  vAlign: "bottom",
  hAlign: "center",
  opacity: 0.6,
  textColor: "#8a8f98",
  lineColor: "#8a8f98",
  lineStyle: "dashed",
  lineWidth: 1,
  fontSize: 12,
};

const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const DASHES: Record<DaySeparatorSettings["lineStyle"], number[]> = { solid: [], dashed: [6, 4], dotted: [1.5, 3] };

const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Des bougies de moins d'un jour : écart médian des premières bougies sous 20 h. */
function isIntraday(dates: Date[]): boolean {
  const gaps: number[] = [];
  for (let i = 1; i < Math.min(dates.length, 40); i++) gaps.push(dates[i].getTime() - dates[i - 1].getTime());
  if (!gaps.length) return false;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] < 20 * 3_600_000;
}

export function drawDaySeparators(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const s = params.daySeparators;
  if (!s?.enabled) return;
  const { data, zoomedXScale, dims, priceHeight, plotBoundedHeight } = params;
  if (data.length < 2 || priceHeight <= 0 || !isIntraday(data.map((c) => c.date))) return;

  const [d0, d1] = zoomedXScale.domain() as [number, number];
  const first = Math.max(1, Math.floor(d0));
  const last = Math.min(data.length - 1, Math.ceil(d1));
  // Début de chaque jour visible (index de sa première bougie), plus celui du jour déjà en cours à gauche.
  const starts: number[] = [];
  let lead = Math.max(0, Math.min(first - 1, data.length - 1));
  while (lead > 0 && dayKey(data[lead - 1].date) === dayKey(data[lead].date)) lead--;
  starts.push(lead);
  for (let i = first; i <= last; i++) if (dayKey(data[i].date) !== dayKey(data[i - 1].date)) starts.push(i);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, dims.boundedWidth, plotBoundedHeight);
  ctx.clip();
  ctx.globalAlpha = Math.max(0, Math.min(1, s.opacity));

  // Traits : sur toute la hauteur (prix, volume, panneaux), au bord gauche de la première bougie du jour.
  ctx.strokeStyle = s.lineColor || style.colorMuted;
  ctx.lineWidth = Math.max(0.5, s.lineWidth);
  ctx.setLineDash(DASHES[s.lineStyle] ?? []);
  for (const i of starts) {
    if (i === 0 && lead === 0 && d0 < 0) continue;
    const x = Math.round(zoomedXScale(i)) + 0.5;
    if (x < 0 || x > dims.boundedWidth) continue;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, plotBoundedHeight);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Noms des jours, entre deux traits, s'ils y tiennent.
  ctx.fillStyle = s.textColor || style.colorMuted;
  ctx.font = `600 ${Math.max(8, s.fontSize)}px ${style.fontFamily ?? "system-ui, sans-serif"}`;
  ctx.textBaseline = s.vAlign === "top" ? "top" : s.vAlign === "bottom" ? "bottom" : "middle";
  const y = s.vAlign === "top" ? 8 : s.vAlign === "bottom" ? priceHeight - 8 : priceHeight / 2;
  for (let k = 0; k < starts.length; k++) {
    const a = starts[k];
    const b = k + 1 < starts.length ? starts[k + 1] : data.length;
    const xs = Math.max(0, zoomedXScale(a));
    const xe = Math.min(dims.boundedWidth, zoomedXScale(b));
    const name = DAY_NAMES[data[a].date.getDay()];
    const w = ctx.measureText(name).width;
    if (xe - xs < w + 12) continue;
    let x: number;
    if (s.hAlign === "left") {
      ctx.textAlign = "left";
      x = xs + 6;
    } else if (s.hAlign === "right") {
      ctx.textAlign = "right";
      x = xe - 6;
    } else {
      ctx.textAlign = "center";
      x = (xs + xe) / 2;
    }
    ctx.fillText(name, x, y);
  }
  ctx.restore();
}
