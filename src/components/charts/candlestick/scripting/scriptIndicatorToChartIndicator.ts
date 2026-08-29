import type { Indicator } from "../interfaces/Indicator.interface";
import type { CustomIndicatorDef } from "../interfaces/CustomIndicatorDef.interface";

/** One `scriptOutputToCustomIndicatorDef.ts` output, converted the rest of the way into a real
 *  `Indicator` — the exact same `{kind: "custom", customData: def}` shape `usePaneLayout.ts`'s own
 *  `addCustomIndicator` already builds for a caller-supplied `CustomIndicatorDef`, which is what
 *  lets a script's plot ride `computeIndicatorValues`/`indicatorCatalogEntry`/every render path
 *  with zero further script-awareness anywhere in that pipeline (both already branch on
 *  `customData` first, before ever looking at `kind`). `def.id` (already the deterministic
 *  `script:<scriptId>:<slug>` scriptOutputToCustomIndicatorDef.ts assigns) is reused directly as
 *  the `Indicator`'s own id too — script indicators are never part of `usePaneLayout`'s own
 *  counter-based CRUD array, so there's no id collision to avoid the way there would be for a
 *  user-added one. */
export function scriptIndicatorToChartIndicator(def: CustomIndicatorDef): Indicator {
  return { id: def.id, kind: "custom", period: 0, customData: def };
}
