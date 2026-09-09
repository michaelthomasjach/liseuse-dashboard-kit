import { indicatorCatalogEntry } from "./indicatorCatalog";
import { scriptIdFromIndicatorId } from "./scripting/scriptOutputToCustomIndicatorDef";
import type { Indicator } from "./interfaces/Indicator.interface";

export interface ScriptPaneRemoval {
  /** Every indicator to take off the chart, the one asked for first. */
  removeIds: string[];
  /** The script whose drawings should be withheld while its pane is gone, or null when the
   *  indicator came from no script. */
  withholdScriptId: string | null;
}

/** What actually goes when one indicator is removed.
 *
 *  Closing a script's own pane takes the overlays that script put on the price plot with it — the
 *  KDE's support/resistance levels are the case this was written for. The pane is where those
 *  levels are explained; leaving them behind means leaving lines on the candles with nothing on
 *  screen that accounts for them.
 *
 *  Deliberately narrow. It removes the script's *price overlays*, not its other panes: each pane
 *  has its own close button, and taking a second one away because the user shut the first would be
 *  deciding something they didn't ask for. Removing an overlay directly likewise removes only that
 *  overlay — the rule reads "closing the pane closes what the pane brought", not the reverse. */
export function scriptPaneRemoval(id: string, indicators: Indicator[]): ScriptPaneRemoval {
  const indicator = indicators.find((entry) => entry.id === id);
  const scriptId = indicator === undefined ? null : scriptIdFromIndicatorId(indicator.customData?.id);
  if (scriptId === null || indicator === undefined) return { removeIds: [id], withholdScriptId: null };
  if (indicatorCatalogEntry(indicator).pane !== "own") return { removeIds: [id], withholdScriptId: scriptId };

  const overlays = indicators
    .filter(
      (other) =>
        other.id !== id &&
        scriptIdFromIndicatorId(other.customData?.id) === scriptId &&
        indicatorCatalogEntry(other).pane === "price",
    )
    .map((other) => other.id);
  return { removeIds: [id, ...overlays], withholdScriptId: scriptId };
}
