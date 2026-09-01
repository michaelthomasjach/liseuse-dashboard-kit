import { useEffect, useRef } from "react";
import * as d3 from "d3";
import "./ChartAxis.css";

export interface ChartAxisProps<Domain extends d3.AxisDomain = d3.AxisDomain> {
  scale: d3.AxisScale<Domain>;
  orientation: "bottom" | "left" | "right";
  transform?: string;
  ticks?: number;
  tickFormat?: (value: Domain, index: number) => string;
  /** Explicit tick positions, e.g. one per visible bar on an index-based categorical axis.
   *  Overrides the automatic `ticks` count when provided. */
  tickValues?: Domain[];
  tickSizeOuter?: number;
  /** Overrides where the domain *line* itself starts and ends, in the axis group's own local
   *  coordinates (the same space as `scale.range()`, which is what it defaults to). For an axis
   *  whose scale is deliberately ranged to less than the box it belongs to — a docked column's own
   *  price axis reserves room at the top of its range so plotted values clear the pane header, see
   *  `usePaneStackScales`'s own `headerReserve` — this keeps the drawn line spanning the full box
   *  while ticks and data still land on the (shorter) scale. */
  domainExtent?: [number, number];
  grid?: boolean;
  /** Length of grid lines (usually the plot's bounded width/height). Required when `grid` is true. */
  gridLength?: number;
}

/**
 * Thin React wrapper around d3-axis: d3 owns the tick DOM inside a single
 * `<g>`, React owns everything else. This is the one place components in
 * this file "hand off" to imperative D3, which is the idiomatic way to mix
 * the two without them fighting over the same nodes.
 */
export function ChartAxis<Domain extends d3.AxisDomain = d3.AxisDomain>({
  scale,
  orientation,
  transform,
  ticks = 5,
  tickFormat,
  tickValues,
  tickSizeOuter = 0,
  domainExtent,
  grid = false,
  gridLength = 0,
}: ChartAxisProps<Domain>) {
  const ref = useRef<SVGGElement>(null);

  useEffect(() => {
    const g = ref.current;
    if (!g) return;

    const axis =
      orientation === "bottom" ? d3.axisBottom<Domain>(scale) : orientation === "right" ? d3.axisRight<Domain>(scale) : d3.axisLeft<Domain>(scale);
    if (tickValues) axis.tickValues(tickValues);
    else axis.ticks(ticks);
    axis.tickSizeOuter(tickSizeOuter);
    if (tickFormat) axis.tickFormat(tickFormat);
    if (grid) axis.tickSizeInner(-gridLength);

    const selection = d3.select(g);
    selection.call(axis);
    // `.classed(name, true)` (add a class) rather than `.attr("class", name)` (replace the whole
    // attribute) — d3-axis's own re-entry logic finds its previous domain path via `.domain`
    // (a class selector, unlike its tick lookup below which matches by tag name and so isn't
    // affected). Overwriting that class here used to strip it away every time, so on the next
    // re-render (this effect has no dependency array — it re-runs on every render) d3-axis could
    // no longer find the path it drew last time and inserted a brand new one instead of updating
    // it in place, silently piling up duplicate overlapping domain paths for as long as the axis
    // stayed mounted.
    selection.select(".domain").classed("lq-chart-axis__domain", true);
    // Rewrite the line d3 just drew between `scale.range()[0]` and `[1]` (see `domainExtent`'s own
    // doc). Same shape d3-axis itself emits at `tickSizeOuter: 0` — including its half-pixel
    // `offset`, which is what keeps a 1px stroke landing on a whole device pixel rather than
    // straddling two and rendering as a blurry 2px line.
    if (domainExtent) {
      const [from, to] = domainExtent;
      const offset = typeof window !== "undefined" && window.devicePixelRatio > 1 ? 0 : 0.5;
      selection.select(".domain").attr("d", orientation === "bottom" ? `M${from},${offset}H${to}` : `M${offset},${from}V${to}`);
    }
    selection.selectAll(".tick line").attr("class", grid ? "lq-chart-axis__grid-line" : "lq-chart-axis__tick-line");
    selection.selectAll(".tick text").attr("class", "lq-chart-axis__label");

    // A label is centered on its tick, so it can visually spill past the axis's own valid
    // range even while the tick itself stays inside it — most obviously the first/last tick,
    // sitting right at the domain's edge, whose label extends half its width/height past that
    // edge. Hide any label whose own rendered extent falls outside `scale.range()` (converted
    // to screen space via the axis group's CTM, since the range is expressed in the group's
    // local coordinates). Judged purely against the axis's own bounds, tick by tick — not
    // against neighboring labels: an earlier version hid labels based on collisions with their
    // neighbors, which made hiding order-dependent and could hide labels that weren't actually
    // overflowing anything.
    const svg = g.ownerSVGElement;
    const ctm = g.getScreenCTM();
    if (svg && ctm) {
      const horizontal = orientation === "bottom";
      const [r0, r1] = scale.range() as unknown as [number, number];
      const p1 = svg.createSVGPoint();
      const p2 = svg.createSVGPoint();
      if (horizontal) {
        p1.x = r0;
        p1.y = 0;
        p2.x = r1;
        p2.y = 0;
      } else {
        p1.x = 0;
        p1.y = r0;
        p2.x = 0;
        p2.y = r1;
      }
      const s1 = p1.matrixTransform(ctm);
      const s2 = p2.matrixTransform(ctm);
      const zoneStart = horizontal ? Math.min(s1.x, s2.x) : Math.min(s1.y, s2.y);
      const zoneEnd = horizontal ? Math.max(s1.x, s2.x) : Math.max(s1.y, s2.y);

      selection.selectAll<SVGTextElement, unknown>(".tick text").each(function () {
        // `visibility`, not `display: none` — a display:none element has an empty
        // getBoundingClientRect() (all zeros), so once hidden it would measure as
        // trivially overflowing forever (0 < zoneStart is almost always true) and could
        // never be re-measured back into view on a later tick. visibility:hidden keeps
        // the real box available to measure while still not painting it.
        const rect = this.getBoundingClientRect();
        const start = horizontal ? rect.left : rect.top;
        const end = horizontal ? rect.right : rect.bottom;
        this.style.visibility = start < zoneStart || end > zoneEnd ? "hidden" : "";
      });
    }
  });

  return <g ref={ref} className="lq-chart-axis" transform={transform} />;
}
