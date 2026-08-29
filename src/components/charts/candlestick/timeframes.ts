import type { TimeframeEntry } from "./interfaces/TimeframeEntry.interface";
import type { TimeframeGroup } from "./interfaces/TimeframeGroup.interface";

export function isTimeframeGroup(entry: TimeframeEntry): entry is TimeframeGroup {
  return "options" in entry;
}

export function findTimeframeLabel(entries: TimeframeEntry[] | undefined, value: string | undefined): string | null {
  if (!entries || !value) return null;
  for (const entry of entries) {
    if (isTimeframeGroup(entry)) {
      const found = entry.options.find((o) => o.value === value);
      if (found) return found.label;
    } else if (entry.value === value) {
      return entry.label;
    }
  }
  return null;
}

/** Every selectable timeframe's own `value` (never `label` — a script reads this back into
 *  `onTimeframeChange`-style code, not a display string), groups flattened away — a script asking
 *  "what timeframes exist" (the scripting engine's own `market.availableTimeframes()`, exigence
 *  #25) has no use for the picker's own visual grouping, only the flat list of valid values. */
export function flattenTimeframeValues(entries: TimeframeEntry[] | undefined): string[] {
  if (!entries) return [];
  return entries.flatMap((entry) => (isTimeframeGroup(entry) ? entry.options.map((o) => o.value) : [entry.value]));
}
