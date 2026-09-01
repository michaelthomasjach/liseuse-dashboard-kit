import type { IndicatorKind } from "./IndicatorKind.interface";

/** What the "?" button on a pane header / legend row opens the info modal *about*.
 *
 *  A built-in indicator is fully identified by its kind — every RSI shares one description, so the
 *  kind is all the modal needs. A script-produced one isn't: its description is whatever its own
 *  script declares with `@description`, so the target has to name the script rather than the kind
 *  (which is always the catch-all `"custom"` and says nothing). `"volume"` is neither an
 *  IndicatorKind nor a script, and has always been its own case here. */
export type IndicatorInfoTarget = IndicatorKind | "volume" | { scriptId: string };

export function isScriptInfoTarget(target: IndicatorInfoTarget): target is { scriptId: string } {
  return typeof target === "object";
}
