export type PatternMatchType =
  | "doubleTop"
  | "doubleBottom"
  | "headShoulders"
  | "inverseHeadShoulders"
  | "ascendingTriangle"
  | "descendingTriangle"
  | "symmetricalTriangle"
  | "flag"
  | "cupHandle"
  | "diamond"
  | "wolfeWave"
  | "support"
  | "resistance";

/** One auto-detected chart pattern (see `computePatternRecognitionValues`'s own doc for how the
 *  recognition window is scanned) — stored at its own `endIndex` only, null everywhere else
 *  (unlike `IndicatorSRLevel[]`'s "shared value repeated across the window" shape: each match here
 *  is its own one-off event, not an ongoing state, so it has no reason to repeat). `points` carries
 *  every vertex the pattern's own drawing needs (2 for a double top/bottom, 3 for head & shoulders,
 *  up to 5 for a flag/cup & handle/wolfe wave) — deliberately not reusing `TrendLineDrawing`'s
 *  x1/y1/x2/y2/extraPoints shape, since a *detected* pattern is read-only (no drag handles, no
 *  edit modal) and every vertex is equally a "point" here, with nothing structurally special about
 *  the first two. */
export interface IndicatorPatternMatch {
  type: PatternMatchType;
  label: string;
  startIndex: number;
  endIndex: number;
  points: { index: number; price: number }[];
  direction: "bullish" | "bearish" | "neutral";
}
