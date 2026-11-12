import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { HOVER_PARAM_KEYS, renderCandlestickChart, renderCrosshair } from "../render/renderChart";
import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { readChartCanvasStyle } from "../render/readChartCanvasStyle";

export interface UseRenderCandlestickChartArgs extends RenderCandlestickChartParams {
  canvasRef: RefObject<HTMLCanvasElement>;
  /** The thin canvas stacked over `canvasRef` that carries only the hover crosshair. */
  crosshairCanvasRef: RefObject<HTMLCanvasElement>;
  wrapperRef: RefObject<HTMLDivElement>;
  /** Forces a re-render on theme/palette change even though nothing here reads it directly —
   *  renderCandlestickChart pulls its own colors straight off the DOM's CSS custom properties at
   *  draw time (canvas has no live binding to them the way SVG/CSS elements do), so nothing in
   *  `RenderCandlestickChartParams` itself would otherwise change when only the palette does. */
  themeTick: number;
}

const HOVER_KEYS = new Set<string>(HOVER_PARAM_KEYS);

/** CandlestickChart's canvas painting, in two layers.
 *
 *  The main canvas (candles, volume, panes, drawings…) is repainted only when something it shows
 *  changes: its effect depends on every param *except* the six hover fields. The crosshair goes on
 *  its own canvas above, repainted on every hover: a handful of dashed lines. Before this split a
 *  mouse move repainted everything, every candle and every pane, up to sixty times a second.
 *
 *  `params`' own keys are a fixed set (RenderCandlestickChartParams' own shape never changes
 *  between renders), so the value lists below are same-length arrays every call — valid (if
 *  eslint-illegible) dependency lists covering every one of their fields at once. */
export function useRenderCandlestickChart({ canvasRef, crosshairCanvasRef, wrapperRef, themeTick, ...params }: UseRenderCandlestickChartArgs) {
  const styleRef = useRef<ChartCanvasStyle | null>(null);
  // Couleurs du thème lues sur le DOM une fois par thème, pas à chaque image : relire les variables
  // CSS forçait un recalcul de style de la page à chaque repeint — en plein glisser, à chaque image.
  // `themeTick` change dès que la palette, la surface, la police, la classe ou le style de la racine
  // du thème changent (useThemePaletteTick).
  const themeStyleRef = useRef<{ key: string; style: ChartCanvasStyle } | null>(null);
  const entries = Object.entries(params);
  const baseDeps = entries.filter(([k]) => !HOVER_KEYS.has(k)).map(([, v]) => v);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const key = `${themeTick}|${params.upColorOverride ?? ""}|${params.downColorOverride ?? ""}`;
    if (themeStyleRef.current?.key !== key) themeStyleRef.current = { key, style: readChartCanvasStyle(wrapper, params.upColorOverride, params.downColorOverride) };
    styleRef.current = renderCandlestickChart(canvas, wrapper, params, themeStyleRef.current.style);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, wrapperRef, themeTick, ...baseDeps]);

  // After the main canvas' effect (declaration order), so the colours it just read are current.
  useEffect(() => {
    const canvas = crosshairCanvasRef.current;
    if (!canvas) return;
    renderCrosshair(canvas, params, styleRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crosshairCanvasRef, themeTick, ...entries.map(([, v]) => v)]);
}
