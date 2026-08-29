import { useRef } from "react";

/** One anchor ref per `DRAWING_TOOL_CATEGORIES` entry (a fixed, known-at-compile-time list, so
 *  plain individual refs rather than a dynamic map — `Popover` needs a real `RefObject` per
 *  anchor, and refs can't be created in a loop), each button's own dropdown positioned off its
 *  own ref via `menuAnchorRefFor`. Every category id needs its own entry here — falling back to a
 *  shared ref for an unrecognized one silently means the *last* category rendered with that
 *  shared ref wins its own `.current`, so every other one ends up anchoring its own dropdown to a
 *  different category's button instead of its own (this is what a past "Lines" menu opening down
 *  at "Forecasting" instead of its own button was: two categories both fell through to the same
 *  shared ref, so whichever rendered last overwrote it). Pulled out of `CandlestickChart` as its
 *  own hook purely to keep that file under its 1000-line budget. */
export function useDrawingToolMenuAnchors() {
  const linesMenuAnchorRef = useRef<HTMLButtonElement>(null);
  const fibonacciMenuAnchorRef = useRef<HTMLButtonElement>(null);
  const chartPatternsMenuAnchorRef = useRef<HTMLButtonElement>(null);
  const forecastingMenuAnchorRef = useRef<HTMLButtonElement>(null);
  const textNotesMenuAnchorRef = useRef<HTMLButtonElement>(null);

  // "measure" has no entry — it no longer renders via DRAWING_TOOL_CATEGORIES' own map in
  // ToolsRail (moved below the separator as a plain button instead, see its own comment there),
  // so nothing ever calls this with "measure" anymore.
  function menuAnchorRefFor(categoryId: string) {
    if (categoryId === "fibonacci") return fibonacciMenuAnchorRef;
    if (categoryId === "chartPatterns") return chartPatternsMenuAnchorRef;
    if (categoryId === "forecasting") return forecastingMenuAnchorRef;
    if (categoryId === "textNotes") return textNotesMenuAnchorRef;
    return linesMenuAnchorRef;
  }

  return { menuAnchorRefFor };
}
