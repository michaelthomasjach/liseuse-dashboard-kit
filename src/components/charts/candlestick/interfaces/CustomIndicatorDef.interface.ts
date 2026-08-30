export interface CustomIndicatorDataPoint {
  date: Date;
  value: number;
}

/** A band-shaped data point — only used when `draw: "band"`, in place of the plain-`value` shape
 *  above. Renders exactly like a built-in Bollinger Bands reading (translucent fill between
 *  `upper`/`lower`, thin upper/lower lines, a computed middle line) — see `computeIndicatorValues`'s
 *  own `"bollinger"` case and `drawPriceCandles.ts`'s own band-rendering branch, both reused
 *  verbatim for this rather than duplicated. */
export interface CustomIndicatorBandDataPoint {
  date: Date;
  upper: number;
  lower: number;
}

/** A caller-supplied series the library knows nothing about ahead of time — the open-ended
 *  escape hatch for whatever data an app has (a fundamentals metric beyond the built-in eight,
 *  a proprietary score, anything else that's one number per reporting date) without needing a
 *  new `IndicatorKind` and a new hand-written `compute*Values` for every single one. Passed via
 *  `CandlestickChartProps.customIndicators` — each entry shows up in the "Ajouter un indicateur"
 *  picker exactly like a built-in one, grouped by its own `section`. */
export interface CustomIndicatorDef {
  /** Unique id — becomes `Indicator.customData.id` once added (see that field's own doc for why
   *  a full copy of this def is carried on the `Indicator` rather than just this id), and this
   *  def's own React key in the picker. */
  id: string;
  label: string;
  /** Short form for the legend/pane header, where `label` might not fit. Defaults to `label`. */
  shortLabel?: string;
  /** Grouping shown in the picker — freeform (unlike the built-in catalog's own closed category
   *  union), since a custom series can be anything: `"fundamentals"` for e.g. gross margin,
   *  dividend yield, income tax, or any other metric not already in the built-in eight, but just
   *  as well a proprietary section of your own. */
  section: string;
  /** "overlay": drawn on the price section itself, in the top-left legend — the same slot
   *  SMA/EMA/Bollinger use. "own": its own sub-pane below price/volume, with a pane header,
   *  like RSI/CHOP/MACD/the built-in fundamentals. */
  type: "overlay" | "own";
  /** How to draw it: a continuous line (moving-average style), the area under that line filled
   *  down to the pane's own floor, a bar per reporting date (volume-style), or a translucent band
   *  filled between two curves (Bollinger-style — see `CustomIndicatorBandDataPoint`). */
  draw: "line" | "area" | "histogram" | "band";
  /** The series itself — one point per reporting date, not required to be sorted. Forward-filled
   *  onto every candle the same step-function way the built-in fundamentals already are (sparse,
   *  quarterly-style reporting is the expected shape, not one point per candle) — see
   *  `computeCustomIndicatorValues`. `CustomIndicatorBandDataPoint[]` only when `draw === "band"`,
   *  `CustomIndicatorDataPoint[]` for every other `draw` value — not a real discriminated union
   *  TypeScript can narrow on its own (the discriminant lives on a sibling field), so
   *  `computeCustomIndicatorValues` checks `draw` at runtime before reading either shape. */
  data: CustomIndicatorDataPoint[] | CustomIndicatorBandDataPoint[];
  /** Formats the value in badges/legend/pane-axis ticks. Default: 2 decimals. Meaningless for
   *  `draw: "band"` (a band has no single value to format). */
  formatValue?: (value: number) => string;
  color?: string;
  /** Stroke width in px for `line`/`area`'s own outline/`band`'s own upper-lower lines. Default 1.5
   *  (matches every built-in line-shaped indicator's own hardcoded width). Meaningless for
   *  `histogram` (bars, not a stroke). */
  lineWidth?: number;
  /** Default `"solid"`. `"dashed"`/`"dotted"` reuse the same `ctx.setLineDash` mechanism several
   *  built-in indicators already use for their own fixed-style lines (Ichimoku's chikou span, pivot
   *  levels, support/resistance) — here exposed as a caller choice instead of hardcoded per kind. */
  lineStyle?: "solid" | "dashed" | "dotted";
}
