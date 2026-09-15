import { scriptIdFromIndicatorId } from "./scripting/scriptOutputToCustomIndicatorDef";
import type { Indicator } from "./interfaces/Indicator.interface";

export interface ScriptPaneRemoval {
  /** Every indicator to take off the chart, the one asked for first. */
  removeIds: string[];
  /** The script whose plot output should be withheld while it is gone, or null when the indicator
   *  came from no script. */
  withholdScriptId: string | null;
}

/** What actually goes when one indicator is removed.
 *
 *  **A script is one thing.** Close any part of what a script put on the chart and the whole of it
 *  goes: every indicator it produced — its price overlays *and* its own panes, docked or not —
 *  together with the drawings, the table and the labels it put on the plot (those last three are
 *  withheld rather than deleted, see `useScriptingState`: the script is still running, so reopening
 *  it brings them straight back).
 *
 *  This used to be narrower, and deliberately so: it removed a script's price overlays but left its
 *  other panes alone, on the reasoning that each pane has its own close button and taking a second
 *  one away would be deciding something the reader had not asked for. In practice that reasoning
 *  produced orphans. Removing the KDE script's "Niveaux S/R" overlay left its docked "Niveaux"
 *  pane folded against the right edge — measured — a 40px strip belonging to a script with nothing
 *  else on screen, which is the opposite of what closing something is supposed to do. Half a script
 *  is not a thing a reader can reason about, so there is no half.
 *
 *  An indicator that came from no script is removed alone, as always. */
export function scriptPaneRemoval(id: string, indicators: Indicator[]): ScriptPaneRemoval {
  const indicator = indicators.find((entry) => entry.id === id);
  const scriptId = indicator === undefined ? null : scriptIdFromIndicatorId(indicator.customData?.id);
  if (scriptId === null || indicator === undefined) return { removeIds: [id], withholdScriptId: null };

  const siblings = indicators
    .filter((other) => other.id !== id && scriptIdFromIndicatorId(other.customData?.id) === scriptId)
    .map((other) => other.id);
  return { removeIds: [id, ...siblings], withholdScriptId: scriptId };
}
