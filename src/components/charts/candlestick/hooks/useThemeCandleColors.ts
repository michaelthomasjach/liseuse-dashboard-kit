import { useEffect, useState } from "react";
import type { RefObject } from "react";

/** The theme's own up / down candle colours (`--lq-color-up` / `--lq-color-down`), resolved live from
 *  the DOM like useDefaultDrawingColor — the defaults a compared symbol's candles are drawn in when
 *  neither they nor the main series have their own (see TrendLineDrawing.overlayUpColor). */
export function useThemeCandleColors(ref: RefObject<HTMLDivElement>, themeTick: number): { up: string; down: string } {
  const [colors, setColors] = useState({ up: "#26a69a", down: "#ef5350" });
  useEffect(() => {
    if (!ref.current) return;
    const css = getComputedStyle(ref.current);
    setColors({ up: css.getPropertyValue("--lq-color-up").trim() || "#26a69a", down: css.getPropertyValue("--lq-color-down").trim() || "#ef5350" });
  }, [ref, themeTick]);
  return colors;
}
