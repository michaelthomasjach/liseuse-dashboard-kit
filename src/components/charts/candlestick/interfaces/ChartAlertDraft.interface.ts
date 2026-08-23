/** The condition an alert fires on — "crossing"/"crossingUp"/"crossingDown"/"greaterThan"/
 *  "lessThan" apply to every line-like drawing/tool; "fibLevel" only applies to a Fibonacci
 *  (retracement or extension) drawing/tool, targeting one specific ratio level instead of the
 *  drawing's own line. */
export type ChartAlertCrossing = { kind: "crossing" | "crossingUp" | "crossingDown" | "greaterThan" | "lessThan" } | { kind: "fibLevel"; level: number };

/** What `AlertCreateModal`'s own "Create" button hands back — a plain data bag, not something
 *  this library stores, evaluates, or ever triggers itself (same "caller owns the data" shape as
 *  `drawings`/`indicators`/everything else here). `CandlestickChartProps.onCreateAlert` is the
 *  only thing that ever produces one of these. */
export interface ChartAlertDraft {
  /** Which drawing this alert is attached to — `null` either while a tool was merely active (no
   *  drawing placed yet) at the moment the alert modal was opened, or for an alert created
   *  directly from an indicator's own legend row (see `conditionIndicatorId`), which has no
   *  drawing to attach to at all. */
  drawingId: string | null;
  /** Which series the condition compares the target line/level against — a specific indicator's
   *  own id, or the literal `"price"` for the plain candle series. Doubles as the alert's own
   *  subject when `drawingId` is `null` and this isn't `"price"` (an indicator-only alert, e.g.
   *  "RSI(14) crosses above 70", with no drawn line involved at all). */
  conditionIndicatorId: string;
  crossing: ChartAlertCrossing;
  trigger: "onlyOnce" | "oncePerBar" | "oncePerBarClose" | "oncePerMinute";
  sound: string;
  message: string;
  expiresAt: Date | null;
}

/** A persisted alert — what `ChartAlertDraft` becomes once the caller has assigned it a stable
 *  id and appended it to its own list (see `CandlestickChartProps.alerts`). Never constructed by
 *  this library itself, same "caller owns the data" stance as `ChartAlertDraft`. */
export interface ChartAlert extends ChartAlertDraft {
  id: string;
}
