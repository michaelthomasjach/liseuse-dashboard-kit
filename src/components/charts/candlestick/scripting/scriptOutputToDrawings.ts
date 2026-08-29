import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import type { ScriptDrawingOutput } from "./interfaces/ScriptRunResult.interface";

/** `shape` (see `PlotSignalArg`/`plot.point`'s own doc) is only trusted when it names one of
 *  these — an arbitrary string reaching `TrendLineDrawing.lineType` unchecked could name a
 *  multi-point tool (`"channel"`, `"headShoulders"`...) that needs fields this single-point
 *  output never sets, silently producing a broken/invisible drawing instead of a clearly-marked
 *  one. */
const VALID_MARKER_SHAPES = new Set(["arrowUp", "arrowDown", "pin", "flagMark", "priceLabel"]);

function markerShape(d: ScriptDrawingOutput): TrendLineDrawing["lineType"] {
  if (d.shape && VALID_MARKER_SHAPES.has(d.shape)) return d.shape as TrendLineDrawing["lineType"];
  if (d.kind === "signal") return d.type === "SELL" ? "arrowDown" : "arrowUp";
  return "pin";
}

/** One `plot.signal/point/horizontal/vertical` output, converted into a `TrendLineDrawing` —
 *  reusing the drawing toolbar's own arrowUp/arrowDown/pin/horizontal/vertical rendering
 *  verbatim, the same "no new rendering primitive" reasoning
 *  `scriptOutputToCustomIndicatorDef.ts` follows for plotted series. Single-point markers mirror
 *  x1/y1 into x2/y2 (the same convention every hand-placed arrowUp/pin drawing already uses —
 *  see `TrendLineDrawing.lineType`'s own doc). `price` missing (only possible if `plot.signal`
 *  was called with no explicit price *and* the current bar's own close was somehow unavailable)
 *  falls back to 0 rather than producing a drawing with `NaN`/`undefined` coordinates. */
export function scriptDrawingToTrendLineDrawing(id: string, d: ScriptDrawingOutput): TrendLineDrawing {
  const date = new Date(d.date);
  const price = d.price ?? 0;
  if (d.kind === "horizontal") return { id, lineType: "horizontal", x1: date, y1: price, x2: date, y2: price, color: d.color, text: d.text };
  if (d.kind === "vertical") return { id, lineType: "vertical", x1: date, y1: 0, x2: date, y2: 0, color: d.color, text: d.text };
  return { id, lineType: markerShape(d), x1: date, y1: price, x2: date, y2: price, color: d.color, text: d.text };
}

/** Every drawing a run of `scriptId` produced, replacing whatever that same script produced last
 *  run — deterministic, positional ids (`script:<scriptId>:<index>`) rather than one keyed by
 *  bar/kind: two `plot.signal(...)` calls on the *same* bar are a real, valid scenario (a BUY and
 *  a SELL condition both firing isn't a bug the id scheme should collapse), and a script's own
 *  full output already fully replaces its previous run's every time (see this function's own
 *  full-replace strategy — a signal that stops firing at some bar must not leave a stale marker
 *  behind, same reasoning `upsertScriptCustomIndicators`'s own doc gives for plots). */
export function upsertScriptDrawings(existing: TrendLineDrawing[], scriptId: string, drawings: ScriptDrawingOutput[]): TrendLineDrawing[] {
  const prefix = `script:${scriptId}:`;
  const kept = existing.filter((d) => !d.id.startsWith(prefix));
  return [...kept, ...drawings.map((d, index) => scriptDrawingToTrendLineDrawing(`${prefix}${index}`, d))];
}
