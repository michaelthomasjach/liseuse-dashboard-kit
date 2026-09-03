import type { Candle } from "./interfaces/Candle.interface";

/** The live OHLC readout, top-left of the price plot — the hovered candle while hovering, the
 *  most recent one otherwise (so the readout is never blank). % is against the *previous*
 *  candle's close (not this candle's own open), matching how a trading platform's own top-bar
 *  readout reads "change since last close" rather than "change within this bar". */
export function computeOhlcReadout(data: Candle[], hoverIndex: number | null) {
  const index = hoverIndex !== null ? hoverIndex : data.length - 1;
  const candle = data[index];
  const prevClose = index > 0 ? data[index - 1].close : candle.open;
  const delta = candle.close - prevClose;
  const deltaPct = prevClose !== 0 ? (delta / prevClose) * 100 : 0;
  return { candle, delta, deltaPct, sign: delta >= 0 ? "+" : "" };
}

/** Picks whichever of black/white reads better against `hex` (a "#rrggbb" background), by
 *  perceived luminance (ITU-R BT.601 weights) rather than a plain average — the eye is far more
 *  sensitive to green than red/blue, so that's the split that actually predicts legibility. Used
 *  to keep a drawing's text label background editable without ever landing on an unreadable
 *  text/background pairing by accident. */
export function contrastingTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#000000" : "#ffffff";
}

/** Event kinds (`ChartEvent.kind`) are freeform app-supplied strings ("earnings", "dividend"…),
 *  always rendered Title Case wherever they're shown as a label — the events-visibility toggle in
 *  the toolbar (see ToolsRail) and its twin list in the chart-settings modal (see
 *  ChartSettingsModals) both read through this rather than each formatting it their own way. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** MM:SS, rounded up so a fresh 5-minute candle reads "05:00" (not "04:59") the instant it
 *  starts — ceil(ms / 1000) rather than floor. Negative/zero clamps to "00:00" rather than
 *  going negative, since nothing here forces a new candle to actually arrive on schedule. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** A raw price (or "equivalent price", see `overlayProjections`) reinterpreted as a % change from
 *  a reference price — what the whole price axis reads in once `compareMode` is active, instead
 *  of `pFmt`'s plain currency. Signed (a leading "+" on a gain, matching the OHLC readout's own
 *  `ohlcSign` convention) since "up or down from the reference" is the entire point of this view. */
export function formatPercentFromReference(value: number, reference: number): string {
  if (reference === 0) return "0.0%";
  const pct = (value / reference - 1) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/** Plain two-decimal number below 10 000 (i.e. 4 or fewer integer digits) — past that, truncated
 *  to two decimals with a K/M/B/T suffix (thousand/million/billion/trillion) instead of the raw
 *  digit string, e.g. 4522582677.17 → "4.52B". Used wherever a pane's own value (an own-pane
 *  indicator's hover/permanent axis badge, a fundamental's magnitude) could otherwise run long
 *  enough to overflow its badge. */
export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs < 10_000) return value.toFixed(2);
  const units: [number, string][] = [
    [1_000_000_000_000, "T"],
    [1_000_000_000, "B"],
    [1_000_000, "M"],
    [1_000, "K"],
  ];
  for (const [threshold, suffix] of units) {
    if (abs >= threshold) return `${(value / threshold).toFixed(2)}${suffix}`;
  }
  return value.toFixed(2);
}

export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateInputValue(text: string, fallback: Date): Date {
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return fallback;
  const next = new Date(fallback);
  next.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return next;
}

/** A `Date` as an `<input type="date">` value — `yyyy-mm-dd` in *local* time, deliberately not
 *  `toISOString().slice(0, 10)`, which converts to UTC first and so reports the previous day for
 *  anyone east of Greenwich in the evening. */
export function toDayInputValue(date: Date | undefined): string {
  if (!date) return "";
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

/** Which candle a day picked in an `<input type="date">` resolves to: the last one at or before the
 *  end of that day. A day with no candle of its own — a weekend, a holiday, a gap in the data —
 *  therefore lands on the session before it rather than being rejected, which is what someone
 *  typing a date actually means. `null` when the value is unparseable or falls before the first
 *  candle. Assumes `data` is ascending by date, as every candle array in this library is. */
export function candleIndexForDay(data: Candle[], value: string): number | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
  let index = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i].date.getTime() > endOfDay) break;
    index = i;
  }
  return index >= 0 ? index : null;
}
