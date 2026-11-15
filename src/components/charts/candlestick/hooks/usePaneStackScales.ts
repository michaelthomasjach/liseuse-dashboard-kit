import { useMemo, useRef } from "react";
import * as d3 from "d3";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import type { IndicatorMACD } from "../interfaces/IndicatorMACD.interface";
import type { IndicatorBand } from "../interfaces/IndicatorBand.interface";

export interface UsePaneStackScalesArgs {
  ownPaneIndicators: Indicator[];
  indicatorPaneHeights: number[];
  visibleIndicators: { indicator: Indicator; points: { i: number; value: IndicatorValue }[] }[];
  paneYTransform: Record<string, d3.ZoomTransform>;
  /** Pixel space reserved at the *top* of every pane's own range, so its highest plotted value
   *  lands this far below the pane's own top edge instead of right at it — 0 (the range stays
   *  `[height, 0]`, unchanged) for the bottom stack, whose header text floats over the canvas with
   *  no background of its own. A docked column's own header (see ChartSidePaneColumn.tsx) reads
   *  the value-at-hover next to the pane's own name, dense enough that a value line passing
   *  directly behind it reads as clutter rather than merely "behind text" — reserving real space
   *  for it (SUB_PANE_COLLAPSED_HEIGHT, passed by useDockedPaneColumnsState.ts) keeps the two
   *  visually separate instead of overlapping. Default 0 (existing bottom-stack behavior). */
  headerReserve?: number;
}

/** One pane *stack*'s own Y-scale per "own"-pane indicator in it — extracted out of
 *  `useIndicatorPaneScales` (which still calls this once, for the bottom stack — see its own doc)
 *  so a `plot.pane(name, { dock: "left"|"right" })` script pane's own column can get the exact
 *  same scale logic for its own (much smaller) subset of indicators, called directly a fixed two
 *  more times in `CandlestickChart.tsx`, without redoing `computeIndicatorValues` for every
 *  indicator a second and third time — that expensive, dock-independent pass stays computed
 *  exactly once, in `useIndicatorPaneScales`, and its result (`visibleIndicators`, covering every
 *  indicator regardless of which stack it ends up in) is simply passed into each of these three
 *  calls instead. See `useIndicatorPaneScales.ts`'s own doc on `ownPaneScales` for what "auto-fit"
 *  means per indicator kind — unchanged here, just parametrized by which stack's own indicators/
 *  heights/transform to run it over. */
/** Margin above and below a fitted pane's visible values: four tenths of their spread on each side,
 *  so the lines keep to the middle of the pane (a little over half its height) — clear of its header at the top and of
 *  the next pane at the bottom — instead of touching both edges. A flat series (a quarterly figure
 *  that holds over the whole window) has no spread: a tenth of its own size then, so the line sits
 *  in the middle of the pane on a readable scale, rather than ±1 around 18 billion. */
export function paneFitPad(lo: number, hi: number): number {
  return (hi - lo) * 0.4 || Math.abs(hi) * 0.1 || 1;
}

/** Le domaine de base de chaque axe Y de sous-panneau (volume, indicateur), selon son mode.
 *
 *  - Automatique (aucune entrée dans `manual`) : le domaine ajusté aux seules données visibles en X
 *    (`auto`), recalculé à chaque déplacement ou zoom horizontal.
 *  - Manuel (l'utilisateur a glissé ou zoomé cet axe : `manual[id]` existe — c'est `paneYTransform`) :
 *    le domaine automatique tel qu'il était au moment de ce premier geste, figé. Le réglage de
 *    l'utilisateur est une transformation appliquée *sur* ce domaine : s'il continuait de suivre les
 *    données visibles, l'échelle choisie bougerait à chaque déplacement en X, ce qui n'est justement
 *    plus voulu. Le double-clic sur l'axe retire l'entrée de `manual` : l'axe repart sur `auto`.
 *
 *  Les deux références gardent, par axe, le dernier domaine automatique (celui sur lequel portait la
 *  transformation quand le geste a commencé) et le domaine figé ; elles ne dépendent que de leurs
 *  entrées, donc un double appel du mémo (mode strict de React) donne le même résultat. */
export function useFrozenDomains(auto: Record<string, [number, number]>, manual: Record<string, unknown>): Record<string, [number, number]> {
  const lastAutoRef = useRef<Record<string, [number, number]>>({});
  const frozenRef = useRef<Record<string, [number, number]>>({});
  return useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const id of Object.keys(auto)) {
      if (id in manual) {
        const frozen = frozenRef.current[id] ?? lastAutoRef.current[id] ?? auto[id];
        frozenRef.current[id] = frozen;
        out[id] = frozen;
      } else {
        delete frozenRef.current[id];
        lastAutoRef.current[id] = auto[id];
        out[id] = auto[id];
      }
    }
    return out;
  }, [auto, manual]);
}

export function usePaneStackScales({
  ownPaneIndicators,
  indicatorPaneHeights,
  visibleIndicators,
  paneYTransform,
  headerReserve = 0,
}: UsePaneStackScalesArgs) {
  // Domaine automatique de chaque panneau, sur les seules valeurs visibles — recalculé quand la plage
  // visible change (pan/zoom en X), jamais pendant un glisser de l'axe Y lui-même.
  const autoDomains = useMemo(() => {
    const domains: Record<string, [number, number]> = {};
    ownPaneIndicators.forEach((ind) => {
      // A profile pane is drawn against the *main chart's* own price scale, not one fitted to its
      // own data (see CustomIndicatorDef.profile's own doc) — that shared scale is what makes a
      // peak land at the height of the price it describes. Nothing to build here for it.
      if (ind.customData?.draw === "profile") return;
      if (ind.kind === "rsi" || ind.kind === "chop" || ind.kind === "adx") {
        domains[ind.id] = [0, 100];
      } else if (ind.kind === "correlation") {
        domains[ind.id] = [-1, 1];
      } else if (ind.kind === "macd") {
        const points = (visibleIndicators.find((v) => v.indicator.id === ind.id)?.points ?? []) as { i: number; value: IndicatorMACD }[];
        let lo = 0;
        let hi = 0;
        for (const p of points) {
          lo = Math.min(lo, p.value.macd, p.value.signal ?? p.value.macd, p.value.histogram ?? 0);
          hi = Math.max(hi, p.value.macd, p.value.signal ?? p.value.macd, p.value.histogram ?? 0);
        }
        const pad = (hi - lo) * 0.1 || 1;
        domains[ind.id] = [lo - pad, hi + pad];
      } else if (ind.customData?.draw === "multi") {
        const points = (visibleIndicators.find((v) => v.indicator.id === ind.id)?.points ?? []) as {
          i: number;
          value: { multi: Record<string, number | IndicatorBand | null> };
        }[];
        // Fitted to the visible values, like a single-series pane: zero is kept only when a series
        // is drawn from it (bars, areas). Starting at 0 unconditionally pinned a line of positive
        // values (a free cash flow of 18 B$) to the top of its pane over an empty band down to 0.
        const fromZero = (ind.customData.multiSeries ?? []).some((s) => s.draw === "histogram" || s.draw === "area");
        let lo = fromZero ? 0 : Infinity;
        let hi = fromZero ? 0 : -Infinity;
        for (const p of points) {
          for (const sub of Object.values(p.value.multi)) {
            if (sub === null) continue;
            if (typeof sub === "number") {
              lo = Math.min(lo, sub);
              hi = Math.max(hi, sub);
            } else {
              lo = Math.min(lo, sub.upper, sub.lower);
              hi = Math.max(hi, sub.upper, sub.lower);
            }
          }
        }
        if (!isFinite(lo) || !isFinite(hi)) {
          lo = 0;
          hi = 1;
        }
        const pad = paneFitPad(lo, hi);
        // Des barres partent de zéro : la marge ne passe pas de l'autre côté de zéro. Un volume (tout positif) gardait
        // sinon un axe négatif de 40 % de sa hauteur (« −200G … 0 … 200G ») sous des barres qui n'y descendent jamais.
        const bottom = fromZero && lo >= 0 ? 0 : lo - pad;
        const top = fromZero && hi <= 0 ? 0 : hi + pad;
        domains[ind.id] = [bottom, top];
      } else {
        const points = (visibleIndicators.find((v) => v.indicator.id === ind.id)?.points ?? []) as { i: number; value: number }[];
        let lo = Infinity;
        let hi = -Infinity;
        for (const p of points) {
          lo = Math.min(lo, p.value);
          hi = Math.max(hi, p.value);
        }
        if (!isFinite(lo) || !isFinite(hi)) {
          lo = 0;
          hi = 1;
        }
        const pad = paneFitPad(lo, hi);
        domains[ind.id] = [lo - pad, hi + pad];
      }
    });
    return domains;
  }, [ownPaneIndicators, visibleIndicators]);

  // Figé dès que l'utilisateur règle l'axe à la main (voir useFrozenDomains), libéré au double-clic.
  const domains = useFrozenDomains(autoDomains, paneYTransform);

  const ownPaneScales = useMemo(() => {
    const scales: Record<string, d3.ScaleLinear<number, number>> = {};
    ownPaneIndicators.forEach((ind, idx) => {
      const domain = domains[ind.id];
      if (domain) scales[ind.id] = d3.scaleLinear().domain(domain).range([indicatorPaneHeights[idx], headerReserve]);
    });
    return scales;
  }, [ownPaneIndicators, indicatorPaneHeights, domains, headerReserve]);



  const zoomedOwnPaneScales = useMemo(() => {
    const scales: Record<string, d3.ScaleLinear<number, number>> = {};
    ownPaneIndicators.forEach((ind) => {
      const base = ownPaneScales[ind.id];
      if (base) scales[ind.id] = (paneYTransform[ind.id] ?? d3.zoomIdentity).rescaleY(base);
    });
    return scales;
  }, [ownPaneIndicators, ownPaneScales, paneYTransform]);

  return { ownPaneScales, zoomedOwnPaneScales };
}
