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
  /** Extra class on the axis group (e.g. `lq-chart__axis--hidden`: grid lines only, no labels or axis line). */
  className?: string;
}

/** Bumped once web fonts finish loading: label widths change then, so an axis whose ticks did not
 *  move still has to re-measure which edge labels overflow (part of its draw signature below). */
let fontsGeneration = 0;
if (typeof document !== "undefined" && document.fonts) {
  document.fonts.addEventListener?.("loadingdone", () => {
    fontsGeneration++;
  });
}

/** What a label's width depends on, read once from its computed style. */
interface LabelStyle {
  font: string;
  /** Font size in px: the height of a side axis label's line box. */
  size: number;
  letterSpacing: string;
  textTransform: string;
}

function readLabelStyle(label: SVGTextElement): LabelStyle {
  const cs = getComputedStyle(label);
  const size = parseFloat(cs.fontSize) || 11;
  // `font` is empty in some engines when a longhand is not representable in the shorthand.
  const font = cs.font || `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return { font, size, letterSpacing: cs.letterSpacing, textTransform: cs.textTransform };
}

let measureContext: CanvasRenderingContext2D | null | undefined;
const widthCache = new Map<string, number>();

/** Rendered width of a label, measured on an offscreen canvas (no layout) and cached. */
function labelWidth(text: string, style: LabelStyle): number {
  const shown = style.textTransform === "uppercase" ? text.toUpperCase() : style.textTransform === "lowercase" ? text.toLowerCase() : text;
  const key = `${style.font}|${style.letterSpacing}|${shown}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  if (measureContext === undefined) measureContext = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  let width = shown.length * style.size * 0.6;
  if (measureContext) {
    measureContext.font = style.font;
    width = measureContext.measureText(shown).width;
    const spacing = parseFloat(style.letterSpacing);
    if (Number.isFinite(spacing)) width += spacing * shown.length;
  }
  if (widthCache.size > 4000) widthCache.clear();
  widthCache.set(key, width);
  return width;
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
  className,
}: ChartAxisProps<Domain>) {
  const ref = useRef<SVGGElement>(null);
  const drawnRef = useRef<string | null>(null);
  const labelStyleRef = useRef<(LabelStyle & { key: string }) | null>(null);

  useEffect(() => {
    const g = ref.current;
    if (!g) return;

    // Skip the rebuild when nothing it draws has changed. The parent hands over a fresh scale and
    // tickFormat closure on every render — a chart re-renders on every mouse move for its
    // crosshair — and the work below is far from free: d3 rewrites every tick, then each label is
    // measured (getScreenCTM, getBoundingClientRect), which forces a synchronous layout of the
    // whole page right after those writes. Eight axes (price, dates, volume, panes) did that on
    // every move. The signature is what actually ends up on screen: tick positions, their labels,
    // the range and every option; same signature, same DOM.
    const values = (tickValues ?? (("ticks" in scale && typeof scale.ticks === "function" ? (scale.ticks as (n: number) => Domain[])(ticks) : scale.domain()) as Domain[])) as Domain[];
    const fmt = tickFormat ?? ("tickFormat" in scale && typeof scale.tickFormat === "function" ? (scale.tickFormat as (n: number) => (v: Domain) => string)(ticks) : (v: Domain) => String(v));
    const signature = [
      orientation,
      transform ?? "",
      ticks,
      tickSizeOuter,
      grid ? gridLength : "-",
      domainExtent ? domainExtent.join(",") : "",
      (scale.range() as unknown as number[]).join(","),
      fontsGeneration,
      values.map((v, i) => `${scale(v) ?? ""}:${fmt(v, i)}`).join("|"),
    ].join(";");
    if (drawnRef.current === signature && g.childNodes.length > 0) return;
    drawnRef.current = signature;

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
    // edge. Hide any label whose own extent falls outside `scale.range()`. Judged purely against
    // the axis's own bounds, tick by tick — not against neighboring labels: an earlier version hid
    // labels based on collisions with their neighbors, which made hiding order-dependent and could
    // hide labels that weren't actually overflowing anything.
    //
    // Computed, not measured. Reading each label's box (getBoundingClientRect) right after d3
    // rewrote the ticks forced a synchronous layout of the whole page, once per axis: while
    // panning, every axis moves on every frame, and those forced layouts were the largest single
    // cost of a drag on a phone. The extent along the axis is the tick position plus the label's
    // width (text measured on a canvas, cached) or its line box — no layout involved. The label
    // font is read once per axis setup (style only, no layout), not on every frame.
    const labels = selection.selectAll<SVGTextElement, Domain>(".tick text");
    const first = labels.node();
    if (!first) return;
    const styleKey = [orientation, className ?? "", fontsGeneration].join(";");
    if (labelStyleRef.current?.key !== styleKey) labelStyleRef.current = { key: styleKey, ...readLabelStyle(first) };
    const style = labelStyleRef.current;
    const horizontal = orientation === "bottom";
    const [r0, r1] = scale.range() as unknown as [number, number];
    const zoneStart = Math.min(r0, r1);
    const zoneEnd = Math.max(r0, r1);
    const band = "bandwidth" in scale && typeof scale.bandwidth === "function" ? (scale.bandwidth as () => number)() / 2 : 0;
    labels.each(function (d) {
      const at = (scale(d) ?? 0) + band;
      const text = this.textContent ?? "";
      // Bottom axis: centered on the tick (text-anchor middle). Side axes: d3 sets dy=0.32em, so
      // the baseline sits 0.32em below the tick; the glyph box runs from the ascent above it to
      // the descent below (≈ 0.94em and 0.24em for the UI fonts in use).
      const [start, end] = horizontal
        ? [at - labelWidth(text, style) / 2, at + labelWidth(text, style) / 2]
        : [at + (0.32 - 0.94) * style.size, at + (0.32 + 0.24) * style.size];
      // `visibility`, not `display: none`: a hidden label keeps its place for when it fits again.
      const next = start < zoneStart || end > zoneEnd ? "hidden" : "";
      if (this.style.visibility !== next) this.style.visibility = next;
    });
  });

  return <g ref={ref} className={["lq-chart-axis", className].filter(Boolean).join(" ")} transform={transform} />;
}
