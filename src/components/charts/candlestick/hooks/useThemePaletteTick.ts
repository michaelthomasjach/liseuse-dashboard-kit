import { useEffect, useState } from "react";
import type { RefObject } from "react";

/** The candles/volume/crosshair/drawings are drawn on a <canvas> for performance with large
 *  datasets (versus one SVG node per candle). Canvas has no live binding to CSS custom
 *  properties, so redraws re-read them from the DOM — this observer just triggers that redraw
 *  (by bumping a counter the draw effect depends on) whenever the active palette/surface
 *  actually changes. */
export function useThemePaletteTick(ref: RefObject<HTMLDivElement>): number {
  const [themeTick, setThemeTick] = useState(0);

  useEffect(() => {
    const el = ref.current;
    const root = el?.closest(".lq-root");
    if (!root) return;
    const observer = new MutationObserver(() => setThemeTick((t) => t + 1));
    // Tout ce qui, sur la racine du thème, peut changer les variables CSS lues par le canvas : la
    // palette et la surface, mais aussi la police, une classe de thème d'application (`.mon-theme.lq-root`)
    // ou des variables posées en style. Le canvas ne relit ses couleurs qu'à ce signal.
    observer.observe(root, { attributes: true, attributeFilter: ["data-lq-palette", "data-lq-surface", "data-lq-font", "class", "style"] });
    return () => observer.disconnect();
  }, [ref]);

  return themeTick;
}
