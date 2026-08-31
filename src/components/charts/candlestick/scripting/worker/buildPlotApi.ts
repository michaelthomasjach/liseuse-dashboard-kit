import type {
  ScriptDrawingOutput,
  ScriptLabelOutput,
  ScriptPaneSeries,
  ScriptPaneSubSeries,
  ScriptTableOutput,
  ScriptTableRow,
  ScriptXYChartOutput,
} from "../interfaces/ScriptRunResult.interface";

/** Hard caps on `plot.table()`/`plot.xy()`'s own output — the `plot.*` calls whose size a script
 *  directly controls (an accidental `rows`/`x`/`y` from an unbounded loop or a huge literal array)
 *  rather than it being naturally bounded by the replay length the way `plots`/`drawings` already
 *  are. Silent truncation (not a thrown error) matches every other size limit this engine already
 *  has (`market.series()`'s own `maxSeriesLength`) — a script that exceeds one still runs. */
const MAX_TABLE_ROWS = 50;
const MAX_TABLE_CELL_LENGTH = 200;
const MAX_XY_POINTS = 2000;

function truncateCell(value: string): string {
  return value.length > MAX_TABLE_CELL_LENGTH ? `${value.slice(0, MAX_TABLE_CELL_LENGTH - 1)}…` : value;
}

export interface PlotSeriesOptions {
  color?: string;
  /** Stroke width in px — default 1.5, matching every built-in line-shaped indicator's own
   *  hardcoded width (see `CustomIndicatorDef.lineWidth`'s own doc, which this ends up on). No
   *  effect on `histogram` (bars, not a stroke). */
  lineWidth?: number;
  /** Default `"solid"`. */
  lineStyle?: "solid" | "dashed" | "dotted";
}
export interface PlotBandOptions {
  color?: string;
  /** Width in px of the band's own upper/lower lines (the middle line is drawn slightly thicker,
   *  same relationship the built-in Bollinger Bands rendering already has). Default 1. */
  lineWidth?: number;
}
export interface PlotLabelOptions {
  /** Position within *this pane's own* box (not the whole chart — unlike `plot.table`'s corner
   *  anchoring) — `overlay`'s box is the price pane, `pane`'s is that pane's own strip. `unit`
   *  picks how `x`/`y` are read: `"%"` (default) is relative to the pane's own width/height (0-100
   *  each way), `"px"` is an absolute pixel offset from the pane's own top-left corner. */
  x: number;
  y: number;
  unit?: "px" | "%";
  /** Degrees, clockwise, around the label's own center. Default 0. */
  rotation?: number;
  color?: string;
  fontSize?: number;
  align?: "left" | "center" | "right";
}
export interface PlotXYOptions {
  color?: string;
  /** Points joined by a line (a function's own curve), or drawn as unconnected dots (a scatter of
   *  independent measurements). Default `"line"`. */
  draw?: "line" | "scatter";
  xLabel?: string;
  yLabel?: string;
  title?: string;
}
export interface PlotSignalArg {
  type?: string;
  price?: number;
  color?: string;
  shape?: string;
  /** A short label rendered next to the marker — `type: "BUY"` alone only picks the arrow's own
   *  direction, this is what actually puts the word "BUY" on the chart next to it. */
  text?: string;
}

/** The handle `plot.pane(name)`/`plot.overlay(name)` returns — draw one or more of this pane's own
 *  named series on it. Calling the same series `name` again (same bar or a later one) extends that
 *  one series rather than starting a new one, same upsert rule the old flat `plot.line`/etc. always
 *  had; a pane with just one series behaves identically to that old API, a pane with 2+ becomes one
 *  multi-series indicator sharing this one pane/scale (see `scriptPaneToCustomIndicatorDef.ts`). */
export interface PaneSeriesHandle {
  line(name: string, value: number, options?: PlotSeriesOptions): void;
  area(name: string, value: number, options?: PlotSeriesOptions): void;
  histogram(name: string, value: number, options?: PlotSeriesOptions): void;
  /** A translucent fill between two curves, plus thin upper/lower lines and a computed middle
   *  line — same rendering Bollinger Bands already uses. */
  band(name: string, upper: number, lower: number, options?: PlotBandOptions): void;
  /** A single element positioned precisely within this pane's own box, in pixels or percent, with
   *  an optional rotation — unlike `line`/`area`/`histogram`/`band`, not tied to a bar index or
   *  value at all. See `PlotLabelOptions`'s own doc. "Latest call for this `name` wins," same
   *  upsert-by-name rule as every other method here. */
  label(name: string, text: string, options: PlotLabelOptions): void;
}

export interface PlotApi {
  /** Creates (or, called again with the same name — including on a later bar, since the whole
   *  script re-runs from the top every bar — re-opens) a sub-pane of its own to draw on. Draw one
   *  series on it for a plain single-line/area/histogram pane; draw several for a pane where they
   *  all share one Y-scale, each keeping its own name for its own legend entry. */
  pane(name: string): PaneSeriesHandle;
  /** Same handle, drawn on the price section instead of a sub-pane of its own — the `pane`
   *  counterpart for an overlay (a moving average, a volatility envelope around price, a
   *  high/low channel: anything that *is* a price rather than an oscillator). */
  overlay(name: string): PaneSeriesHandle;
  /** `arg` may be a bare `"BUY"`/`"SELL"`-style string (the platform's own shorthand — see the
   *  first example in its spec) or the full options object; `price` defaults to the current
   *  bar's own close when omitted, via `getCurrentClose`. */
  signal(arg: string | PlotSignalArg): void;
  point(value: number, options?: { color?: string; shape?: string; text?: string }): void;
  horizontal(price: number, options?: { color?: string }): void;
  vertical(options?: { color?: string }): void;
  /** A table overlay anchored to a corner of the price pane — neither a continuous series nor a
   *  per-bar marker, see `ScriptTableOutput`'s own doc: only the *most recent* call's own table is
   *  ever kept, so call this unconditionally every bar (like `plot.overlay`) rather than gating it
   *  behind `bar.isNew()`. `rows`/each cell string are silently truncated past this engine's own
   *  size limits rather than rejected. */
  table(rows: ScriptTableRow[], options?: { title?: string; columns?: string[]; position?: ScriptTableOutput["position"] }): void;
  /** A free-standing X/Y chart, decoupled from the bar-by-bar replay entirely — pass whole arrays
   *  at once (a function's own curve, a scatter of measurements), not one point per bar the way
   *  `pane.line`/`overlay.line` accumulate. Same "the latest call for a given name wins" rule as
   *  `table` (not an accumulating series) — call unconditionally, no need to gate behind
   *  `bar.isNew()`. Never rendered on the real candlestick chart itself; only ever shown inline as
   *  a cell's own output in the script editor's notebook mode. `x`/`y` must be the same length;
   *  both are silently truncated to `MAX_XY_POINTS` past that size rather than rejected. */
  xy(name: string, x: number[], y: number[], options?: PlotXYOptions): void;
}

// Same slug shape `scriptPaneToCustomIndicatorDef.ts` uses for a pane's own id — duplicated here
// (rather than imported) since this file runs inside the worker, that one on the main thread; a
// one-line pure function isn't worth a cross-thread-boundary import for.
function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "series";
}

/** `plot.*`, closed over the current bar's own date/close (via the same kind of callback
 *  `market.*`/`chart.*` use for "which bar is this") and a pair of accumulators mutated across
 *  the whole replay loop — `getResult()` reads them once, after the loop in runScript.ts has
 *  finished, not per bar. `plot.pane`/`plot.overlay` upsert into `panesByName` by their own name
 *  (recreated every bar since the whole script re-runs from the top each time, same idempotent-
 *  by-name rule the old flat API already had), each returning a handle that itself upserts into
 *  that one pane's own `subSeriesByName` (or `labelsByName` for `.label`, upserted the same way);
 *  a discrete marker (`signal`/`point`/`horizontal`/`vertical`) just appends to `drawings`, one
 *  entry per call. */
export function buildPlotApi(
  getCurrentDate: () => number,
  getCurrentClose: () => number | null
): {
  api: PlotApi;
  getResult: () => {
    panes: ScriptPaneSeries[];
    drawings: ScriptDrawingOutput[];
    table: ScriptTableOutput | null;
    xyCharts: ScriptXYChartOutput[];
    labels: ScriptLabelOutput[];
  };
} {
  interface PaneEntry {
    name: string;
    pane: ScriptPaneSeries["pane"];
    subSeriesByName: Map<string, ScriptPaneSubSeries>;
    labelsByName: Map<string, ScriptLabelOutput>;
  }
  const panesByName = new Map<string, PaneEntry>();
  const drawings: ScriptDrawingOutput[] = [];
  let table: ScriptTableOutput | null = null;
  const xyChartsByName = new Map<string, ScriptXYChartOutput>();

  function makeHandle(paneEntry: PaneEntry): PaneSeriesHandle {
    function upsert(
      name: string,
      draw: ScriptPaneSubSeries["draw"],
      point: { date: number; value: number } | { date: number; upper: number; lower: number },
      options: PlotSeriesOptions | PlotBandOptions | undefined
    ) {
      let sub = paneEntry.subSeriesByName.get(name);
      if (!sub) {
        sub = {
          key: slugify(name),
          name,
          draw,
          color: options?.color,
          lineWidth: options?.lineWidth,
          lineStyle: (options as PlotSeriesOptions | undefined)?.lineStyle,
          points: [],
        };
        paneEntry.subSeriesByName.set(name, sub);
      }
      (sub.points as { date: number; value: number }[] | { date: number; upper: number; lower: number }[]).push(point as never);
    }
    return {
      line: (name, value, options) => upsert(name, "line", { date: getCurrentDate(), value }, options),
      area: (name, value, options) => upsert(name, "area", { date: getCurrentDate(), value }, options),
      histogram: (name, value, options) => upsert(name, "histogram", { date: getCurrentDate(), value }, options),
      band: (name, upper, lower, options) => upsert(name, "band", { date: getCurrentDate(), upper, lower }, options),
      label: (name, text, options) => {
        paneEntry.labelsByName.set(name, {
          paneName: paneEntry.name,
          paneType: paneEntry.pane,
          name,
          text,
          x: options.x,
          y: options.y,
          unit: options.unit ?? "%",
          rotation: options.rotation ?? 0,
          color: options.color,
          fontSize: options.fontSize,
          align: options.align,
        });
      },
    };
  }

  function getOrCreatePane(name: string, pane: ScriptPaneSeries["pane"]): PaneSeriesHandle {
    let entry = panesByName.get(name);
    if (!entry) {
      entry = { name, pane, subSeriesByName: new Map(), labelsByName: new Map() };
      panesByName.set(name, entry);
    }
    return makeHandle(entry);
  }

  const api: PlotApi = {
    pane: (name) => getOrCreatePane(name, "own"),
    overlay: (name) => getOrCreatePane(name, "overlay"),
    signal: (arg) => {
      const normalized: PlotSignalArg = typeof arg === "string" ? { type: arg } : arg;
      drawings.push({
        kind: "signal",
        date: getCurrentDate(),
        price: normalized.price ?? getCurrentClose() ?? undefined,
        type: normalized.type,
        color: normalized.color,
        shape: normalized.shape,
        text: normalized.text,
      });
    },
    point: (value, options) => {
      drawings.push({ kind: "point", date: getCurrentDate(), price: value, color: options?.color, shape: options?.shape, text: options?.text });
    },
    horizontal: (price, options) => {
      drawings.push({ kind: "horizontal", date: getCurrentDate(), price, color: options?.color });
    },
    vertical: (options) => {
      drawings.push({ kind: "vertical", date: getCurrentDate(), color: options?.color });
    },
    table: (rows, options) => {
      table = {
        title: options?.title,
        columns: options?.columns,
        position: options?.position,
        rows: rows.slice(0, MAX_TABLE_ROWS).map((row) => ({ cells: row.cells.map(truncateCell), color: row.color })),
      };
    },
    xy: (name, x, y, options) => {
      xyChartsByName.set(name, {
        name,
        x: x.slice(0, MAX_XY_POINTS),
        y: y.slice(0, MAX_XY_POINTS),
        color: options?.color,
        draw: options?.draw,
        xLabel: options?.xLabel,
        yLabel: options?.yLabel,
        title: options?.title,
      });
    },
  };

  return {
    api,
    getResult: () => ({
      panes: [...panesByName.values()].map((entry) => ({ name: entry.name, pane: entry.pane, series: [...entry.subSeriesByName.values()] })),
      drawings,
      table,
      xyCharts: [...xyChartsByName.values()],
      labels: [...panesByName.values()].flatMap((entry) => [...entry.labelsByName.values()]),
    }),
  };
}
