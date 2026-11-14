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
  // La couleur écrite dans le code ({ color: … }) : le dessin lit `indicator.color`, pas celle de la définition ; sans
  // elle, un script à une seule série était toujours tracé dans la couleur par défaut. Une couleur choisie dans
  // l'onglet Style passe par-dessus (voir `withScriptOverride`).
  return { id: def.id, kind: "custom", period: 0, customData: def, ...(def.color ? { color: def.color } : {}) };
}
