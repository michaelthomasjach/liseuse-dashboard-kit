import type { ChartDisplayMode } from "./ChartDisplayMode.interface";

/** One point of a symbol-comparison overlay's own series (see `TrendLineDrawing.overlayData` and
 *  `CandlestickChartProps.onAddSymbolOverlay`) — `value` (the close) is the only field every
 *  overlay is guaranteed to have; `open`/`high`/`low` are optional, supplied only by a caller
 *  whose data source actually has full OHLC bars for the compared instrument, and only then does
 *  the edit modal offer any `overlayDisplayMode` besides "line" for it. */
export interface OverlayDataPoint {
  date: Date;
  value: number;
  open?: number;
  high?: number;
  low?: number;
}

export interface TrendLineDrawing {
  id: string;
  x1: Date;
  y1: number;
  x2: Date;
  y2: number;
  /** Optional label rendered near the line — see textHorizontalAlign/textVerticalAlign for where
   *  exactly, and textSize/textBold/textItalic/textAlignWithLine/textBackgroundColor for how. */
  text?: string;
  /** CSS color. Defaults to the theme's accent color. Also the text's own color. */
  color?: string;
  /** Line thickness in px. Default 1.5. */
  strokeWidth?: number;
  /** @deprecated Superseded by `lineStyle` — kept only so a `dashed: true` drawing saved before
   *  `lineStyle` existed keeps rendering dashed. Only read as a fallback when `lineStyle` itself
   *  is unset; setting `lineStyle` at all (including to `"solid"`) always wins over this. */
  dashed?: boolean;
  /** Solid or one of a few dash patterns. Default "solid" — except when unset *and* `dashed` is
   *  true, which reads as "dashed" (see `dashed` above). */
  lineStyle?: "solid" | "dashed" | "dotted" | "dashdot";
  /** How far past its own two defining points (x1/y1–x2/y2) the line is drawn — "none" stops
   *  exactly on them (a regular trend line's default), "left"/"right" extend past just that one
   *  edge, "both" past both (what the "extended" tool sets at creation). Kept independent of
   *  `lineType` so any two-point line can be extended after the fact from the edit modal's Style
   *  tab, not only ones drawn with the dedicated tool — rendering falls back to `lineType ===
   *  "extended" ? "both" : "none"` when this itself is unset, for the same saved-before-this-
   *  field-existed reason as `dashed`/`lineStyle` above. Only meaningful for a free two-point
   *  line (no lineType, or "extended"); ignored by every other lineType. */
  extend?: "none" | "left" | "right" | "both";
  /** Arrowhead at whichever endpoint sits further left/right *on screen* (not tied to which one
   *  is x1/y1 vs x2/y2 — a line drawn right-to-left still gets "arrowLeft" at its visual left
   *  end), same screen-space convention as `extend`. Only offered in the edit modal when `extend`
   *  is "none" — an infinitely-extended end has nothing meaningful to put an arrowhead on.
   *  Ignored by every lineType except a free two-point line (undefined, or "extended"). */
  arrowLeft?: boolean;
  arrowRight?: boolean;
  /** Font size, in px, for `text`. Default 11. */
  textSize?: number;
  /** Default true (matches the weight text has always rendered at). */
  textBold?: boolean;
  textItalic?: boolean;
  /** Rotates the text to match the line's own on-screen slope instead of staying upright.
   *  Default false. */
  textAlignWithLine?: boolean;
  /** Position along the line's own length. Default "center". */
  textHorizontalAlign?: "left" | "center" | "right";
  /** Position relative to the line itself — "top"/"bottom" sit just clear of it, "center" sits
   *  right on it. Default "top". */
  textVerticalAlign?: "top" | "center" | "bottom";
  /** Painted behind the text as a small padded rect. Unset (default): no background. */
  textBackgroundColor?: string;
  /** The text's own color. Unset (default): falls back to `color` (the line's own color), same
   *  as before this field existed. The edit modal's background-color picker overwrites this with
   *  whichever of black/white contrasts better (see contrastingTextColor) every time the
   *  background changes, so the label stays readable without the user having to think about
   *  it — still freely overridable by hand afterward via its own picker. */
  textColor?: string;
  /** Constrains the line to one axis instead of a free-form two-point line: "horizontal" keeps
   *  y1 === y2 and can only be dragged vertically (its price/volume changes, never its date
   *  span, which always covers the full width); "vertical" keeps x1 === x2 and can only be
   *  dragged horizontally (its date changes, never its price span, which always covers the full
   *  height); "ray" is a "horizontal" that starts at x1 instead of the dataset's own start —
   *  drawn from there to the right edge only, not spanning the full width — draggable in both
   *  price and its start date, unlike "horizontal"/"vertical"'s single-axis handle. "pitchfork"/
   *  "schiffPitchfork"/"modifiedSchiffPitchfork"/"insidePitchfork" all share the same 3-point
   *  shape — x1/y1 (P0, the "handle"), x2/y2 (P1), extraPoints[0] (P2) — and the same two parallel
   *  "tine" lines through P1/P2, differing only in where their own median line starts from (see
   *  pitchforkGeometry.ts): "pitchfork" (the standard/Andrews' form) starts at P0 itself, heading
   *  through the midpoint of P1-P2; "schiffPitchfork" starts at the midpoint of P0-P1 instead;
   *  "modifiedSchiffPitchfork" starts at the midpoint of P0 and the midpoint of P1-P2 (a point
   *  between the standard and Schiff starting points); "insidePitchfork" swaps the median's own
   *  start/target entirely, starting at the midpoint of P1-P2 and heading through P0. "extended" is
   *  a free two-point line like a regular trend line, except it's drawn all the way to the
   *  price section's left/right edges instead of stopping at x1/x2 — those two points still
   *  define its slope and are still what's draggable, the line just keeps going past them.
   *  "channel" draws a second line parallel to x1/y1–x2/y2, offset by `channelOffset` (a plain
   *  price delta, not a true perpendicular distance — same convention most trading platforms
   *  use for this tool) — both lines are segments matching x1/x2's own date span, neither
   *  extends. Omitted for a regular hand-drawn trend line — set automatically by the axis "+"
   *  buttons. "fibonacci" is a free two-point line like a regular trend line (same two draggable
   *  endpoints, no extra points needed) whose price range between y1 (0%) and y2 (100%) is
   *  sliced into the standard retracement ratios (see FIBONACCI_LEVELS) — each drawn as its own
   *  horizontal segment spanning x1/x2's date range, labeled with its ratio and price.
   *  "fibonacciExtension"/"elliottCorrection"/"elliottImpulse"/"disjointChannel" need more than
   *  two points — x1/y1 and x2/y2 are still the first two (placed the same way), the rest live
   *  in `extraPoints`, in click order. "disjointChannel" is a "channel" whose second line isn't
   *  forced parallel: the 3rd click still sets a price offset exactly like "channel", but instead
   *  of applying it as a constant shift, the offset's *far* point (extraPoints[0], lined up with
   *  x2/y2) is computed the same way channel's line 2 would be, while the *near* point
   *  (extraPoints[1], lined up with x1/y1) is mirrored — reflected across that far point's own
   *  price level — so line 2 slopes the opposite way from line 1 instead of running parallel to
   *  it. Both extraPoints are then just regular, independently draggable points like any other
   *  multi-point tool's, letting the mirrored angle be reshaped by hand afterward. "rectangle" is
   *  a free two-point shape (x1/y1 and x2/y2 as opposite corners) drawn as a stroked box with a
   *  faint fill of its own `color`. "elbowArrow" is an open-ended polyline (x1/y1, x2/y2, then as
   *  many `extraPoints` as were clicked — unlike every other multi-point tool, which needs a
   *  fixed number of clicks known in advance, the tool stays active and keeps appending a point
   *  per click until Escape commits whatever's been placed so far, same as an app's usual
   *  "polyline"/pen tool) drawn as a straight segment between each consecutive point, with a
   *  single arrowhead at the last one. "brush" is a freehand stroke: x1/y1 is where the drag
   *  started, x2/y2 where it ended, every point sampled in between lives in `extraPoints`, in
   *  order — unlike elbowArrow's clicked vertices, its points aren't independently draggable one
   *  at a time (there can be dozens of them), only the whole stroke together. "arrowUp"/
   *  "arrowDown" are single-point markers (x2/y2 always mirrors x1/y1, same convention as
   *  "horizontal") drawn as a small triangle pointing up/down, anchored just clear of the point
   *  itself. "headShoulders" is the same fixed-click-count shape as elliottImpulse/
   *  elliottCorrection, just with more points — x1/y1, x2/y2, then 5 `extraPoints`, the pattern's
   *  own 7 vertices in path order: 1 (the low right before the pattern starts), 2 (left shoulder),
   *  3 (the trough between the two peaks), 4 (head), 5 (the trough after it), 6 (right shoulder),
   *  7 (a confirmation point past the right shoulder) — drawn as one connected polyline through
   *  all seven (see drawHeadShoulders.ts), every vertex numbered, the three peaks additionally
   *  named with their own pill badge. A dashed horizontal line marks the head's own price level,
   *  and a dotted "neckline" — a straight line through points 1 and 5, not a stored point of its
   *  own, always derived from them — extends indefinitely rightward past point 7 for as long as
   *  point 7 itself hasn't closed below it; once it has (a confirmed breakout), the neckline stops
   *  extending past point 7 instead of projecting indefinitely into a pattern that's already
   *  resolved. The region between the polyline and the neckline is filled. "forecast" is a
   *  free two-point tool like a plain trend line, but drawn as a curved (not straight) arrow from
   *  x1/y1 to x2/y2, each end labeled with its own price/date, and the end additionally with the
   *  price change and elapsed time from the start — a price-projection annotation, not a support/
   *  resistance line. "rangeForecast" only takes 2 clicks — x1/y1 (the starting/"Current" point)
   *  and a 2nd "direction" click that's never itself stored, only used to *derive* x2/y2 (the
   *  "Max" target) and extraPoints[0] (the "Min" target) — see rangeForecastMaxMin — each then an
   *  ordinary, independently draggable point like any other tool's. Drawn as three straight lines
   *  fanning out from the same start point to Max, to Min, and to their own midpoint ("Avg",
   *  dotted) — Avg is never a stored point of its own, always recomputed from Max/Min at render/
   *  hit-test time, so dragging Max or Min alone keeps it correct with no extra bookkeeping. The
   *  triangular area between the Max and Min lines is filled, and every end is labeled with its
   *  own price and % change from the start. "longPosition"/"shortPosition" are a single-click
   *  risk/reward box: x1/y1 is the entry (the click itself), x2/y2 the profit target, extraPoints[0]
   *  the stop — target/stop each independently draggable in both date and price like any other
   *  tool's points, defaulting on placement to a fixed reward/risk ratio (see
   *  `longShortPositionDefaults`) with target above entry and stop below for "longPosition" (a long
   *  profits as price rises), the mirror image for "shortPosition". Drawn as two filled horizontal
   *  bands from entry to each point (spanning that point's own date range, independently of the
   *  other) — target's band always the theme's "up" color, stop's always "down", regardless of
   *  which tool this is or which price is actually numerically higher, since the *role* (reward
   *  vs. risk) never changes even if a point gets dragged past entry by hand. Each band is labeled
   *  with its own price and % change from entry, plus the entry itself labeled with the computed
   *  reward:risk ratio. "text"/"comment" are single-point markers like arrowUp/arrowDown (x2/y2
   *  mirrors x1/y1) placed via a live on-canvas text entry instead of the edit modal (see
   *  useDrawingState's own `textEntry`) — `text` itself, plus every textSize/textBold/textItalic/
   *  textColor/textBackgroundColor field above, is the exact same styling every other tool's own
   *  label already uses, just with nothing else drawn alongside it. "text" renders through the
   *  same plain `drawDrawingText` every other tool's label already does (a rect background when
   *  textBackgroundColor is set); "comment" always renders inside a rounded speech-bubble instead,
   *  its own tail pointing at x1/y1 — textBackgroundColor still styles the bubble itself (falling
   *  back to the theme's accent color rather than "no background" when unset, since a comment
   *  reads as empty air without one), textColor the text inside it. "note"/"priceNote" take 2
   *  clicks like a plain trend line — x1/y1 the anchor (a small hollow marker, never itself
   *  labeled), x2/y2 where the live text entry opens (see useDrawingState's own `textEntry`,
   *  whose `anchorPoint` this is what threads x1/y1 through as) — connected by a plain straight
   *  line, same shape a regular trend line already is, just with a label at one end instead of
   *  along it. "priceNote" is identical except its own label always leads with the anchor's own
   *  current price (recomputed from `dr.y1` at render time, so dragging the anchor keeps it
   *  correct) ahead of whatever text was typed, rather than the text alone. "pin"/"flagMark" are
   *  single-point markers exactly like arrowUp/arrowDown (x2/y2 mirrors x1/y1, single click,
   *  single handle) — no text of their own, just a small icon (a map-pin teardrop, tip planted
   *  exactly at the point; a flag on a pole, its own base planted there) drawn a fixed size in
   *  `color`, unrelated to strokeWidth. "signpost" is a single-point label like "text" (same live
   *  entry, x1/y1 the label's own point), but with a vertical connector down to whatever candle's
   *  own close sits at x1's date — never a stored point of its own, always looked up fresh at
   *  render/hit-test time (see drawSignpost.ts), so dragging the label along the date axis keeps
   *  the connector attached to the candle actually under it instead of a stale one. "priceLabel"
   *  is a single-click, single-point marker like "pin"/"flagMark" (no live text entry — there's
   *  nothing to type, see drawPriceLabel.ts) whose own speech bubble (drawSpeechBubble, same shape
   *  "comment" uses) always shows its own current price, recomputed from `dr.y1` every render so
   *  dragging it keeps the shown value correct with no extra bookkeeping. "table" is a free
   *  two-point shape like "rectangle" (x1/y1 and x2/y2 as opposite corners), subdivided into
   *  `tableRows` × `tableCols` even cells (see `tableCells`) — its own grid lines and per-cell text
   *  drawn by drawTable.ts. Each cell is edited in place (double-click a cell, same live-input
   *  mechanism "text" uses, just sized to fill that one cell instead of anchored to a point — see
   *  useDrawingState's own `editingCell`) rather than through the edit modal's Texte tab, which a
   *  whole grid of independent strings has no single field for. */
  lineType?:
    | "horizontal"
    | "vertical"
    | "ray"
    | "extended"
    | "channel"
    | "disjointChannel"
    | "fibonacci"
    | "fibonacciExtension"
    | "elliottImpulse"
    | "elliottCorrection"
    | "rectangle"
    | "elbowArrow"
    | "brush"
    | "arrowUp"
    | "arrowDown"
    | "zones"
    | "headShoulders"
    | "cupHandle"
    | "forecast"
    | "rangeForecast"
    | "longPosition"
    | "shortPosition"
    | "pitchfork"
    | "schiffPitchfork"
    | "modifiedSchiffPitchfork"
    | "insidePitchfork"
    | "text"
    | "comment"
    | "note"
    | "priceNote"
    | "pin"
    | "flagMark"
    | "signpost"
    | "priceLabel"
    | "table"
    | "symbolOverlay";
  /** Which pane's own value scale y is expressed in — "price" (default), "volume", or the id of
   *  an "own"-pane indicator (RSI/CHOP/MACD) to anchor a "horizontal"/"ray" line to that pane
   *  instead — a single click (no pending-point/preview phase to thread pane state through,
   *  unlike a two-point tool) placed wherever the click landed. Every other lineType (a free
   *  two-point line, channel, fibonacci, elliott, rectangle, elbowArrow, brush, arrow markers)
   *  stays price-only for now and ignores this field even if somehow set — "vertical" too, in
   *  practice, since it already spans the plot's full height regardless of pane. */
  valueAxis?: string;
  /** "channel" only: the second line's constant price offset from the first (x1/y1–x2/y2),
   *  set by the tool's third click. */
  channelOffset?: number;
  /** Points beyond x1/y1 (the 1st) and x2/y2 (the 2nd), in click order — "fibonacciExtension"
   *  needs 1 (its 3rd point), "elliottCorrection" 2, "elliottImpulse" 4, "disjointChannel" 2
   *  (line 2's own two points — see `lineType` above for how they're derived), "headShoulders" 5
   *  (points 3 through 7 — see `lineType` above for the pattern's own full 7-point shape and how
   *  its neckline is derived from points 1/5), "cupHandle" 3 (points C through E — see `lineType`
   *  above for the pattern's own full 5-point shape), every pitchfork variant 1 (P2), "rangeForecast" 1
   *  (its own Min — see `lineType` above for how it and x2/y2's own Max are first derived).
   *  Unused otherwise. */
  extraPoints?: { x: Date; y: number }[];
  /** "zones" only: x1/y1 and x2/y2 are still opposite corners like "rectangle", but split the
   *  price pane into three horizontal bands instead of one filled box — above the higher of the
   *  two into "positive", below the lower one into "negative", the box itself staying "neutral".
   *  Its two horizontal boundaries (at y1 and y2) always draw; the rectangle's left/right sides
   *  only draw when this is true (default false/hidden — the positive/negative bands read as
   *  unbounded regions, not a box, without them cluttering the two edges that actually matter). */
  showZoneSides?: boolean;
  /** "zones" only: independent fill for each of its three bands. Each falls back to a theme
   *  color living up to its name (`--lq-color-up`/`-down`, muted) when unset, so the tool reads
   *  as "positive/neutral/negative" correctly without the caller having to touch a color picker
   *  first. The boundary/side lines themselves still use the regular `color` field, same as
   *  every other tool. */
  positiveColor?: string;
  negativeColor?: string;
  neutralColor?: string;
  /** Every pitchfork variant only: independent show/hide for each of the 3 parallel lines (the
   *  dashed median plus its two solid tines — see pitchforkGeometry.ts's own `PitchforkLines`),
   *  not the A-B/tine-anchor-pair construction segments alongside them. Each defaults to visible
   *  (true) when unset, so an existing drawing saved before these fields existed renders exactly
   *  as before. */
  pitchforkShowMedian?: boolean;
  pitchforkShowTine1?: boolean;
  pitchforkShowTine2?: boolean;
  /** "table" only: how many even rows/columns its own x1/y1–x2/y2 box is subdivided into.
   *  Defaults to 3/3 (see the tool's own placement in useDrawingInteractions) when unset. Changing
   *  either from the edit modal never reflows `tableCells` — a cell's own index (row * tableCols +
   *  col) simply lands on a different string than before whenever tableCols changes, same
   *  trade-off resizing a spreadsheet's own columns makes. */
  tableRows?: number;
  tableCols?: number;
  /** "table" only: row-major (index = row * tableCols + col), one entry per cell — a missing or
   *  short array (a freshly-placed table, or one whose row/col count just grew) reads as "every
   *  cell past the end is blank" rather than needing every slot pre-filled. Written one cell at a
   *  time by double-clicking it (see useDrawingState's own `editingCell`/`commitCellEntry`), never
   *  through the edit modal. */
  tableCells?: string[];
  /** "symbolOverlay" only: a second instrument's own price series, plotted for comparison against
   *  `data` — added via the "+" button next to a result in the symbol-search modal (see
   *  `CandlestickChartProps.onAddSymbolOverlay`), never by clicking the chart, so it has no
   *  placement flow of its own in `handleOverlayClick`. x1/y1/x2/y2 are still set (to
   *  `overlayData`'s own first/last point) purely so every drawing has *some* value for them —
   *  nothing reads them for this lineType, `overlayData` is what actually renders. Same stance as
   *  `data`/`fundamentals`: the library has no data source of its own, this is the app's own
   *  fetched series, just plotted and interacted with. */
  overlaySymbol?: string;
  overlaySymbolName?: string;
  /** `value` (the close) is what every point rebases *against* regardless of display mode (see
   *  overlayProjections' own doc) and what `overlayDisplayMode: "line"` plots. `open`/`high`/
   *  `low` are optional (see OverlayDataPoint) — the edit modal only offers a non-"line"
   *  `overlayDisplayMode` once they're actually present. */
  overlayData?: OverlayDataPoint[];
  /** How this comparison overlay itself renders — same catalog of modes as
   *  `CandlestickChartProps.defaultChartDisplayMode`, all computed from the
   *  overlay's own rebased OHLC instead of `data`'s: "line" (default) draws its rebased close
   *  through every point, same as before this field existed; "candle"/"heikinAshi" draw full
   *  bars, "renko"/"lineBreak" draw bricks (same ATR(14)/3-line settings as the main series' own
   *  defaults — no separate configuration for an overlay). Every mode besides "line" is styled
   *  hollow (stroked, never filled) in the overlay's own `color` rather than the theme's up/down
   *  hues, so it reads as "a comparison instrument", not a second primary series competing with
   *  `data`'s own candles — and so two overlays in the same non-line mode still stay visually
   *  distinct from each other by outline color. Falls back to "line" if `overlayData` turns out
   *  not to actually carry open/high/low (see its own doc). */
  overlayDisplayMode?: ChartDisplayMode;
  /** Hides a drawing without deleting it — like an indicator's own `hidden`, but generic here
   *  since (unlike indicators) most drawing types have never needed one: only "symbolOverlay"'s
   *  own legend entry exposes a toggle for it today, though nothing stops another drawing type
   *  from using it later. Default false (visible). */
  hidden?: boolean;
}
