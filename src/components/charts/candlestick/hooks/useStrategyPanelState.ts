import { useCallback, useEffect, useMemo, useState } from "react";
import { analyzeScriptKind } from "../scripting/scriptKind";
import type { ScriptDef } from "../interfaces/ScriptDef.interface";

export interface UseStrategyPanelStateArgs {
  scripts: ScriptDef[];
  /** Un-withholds a script's own drawings. Only reached for a strategy that has just appeared —
   *  see the effect below for the one case it covers. */
  restoreScriptOutput: (scriptId: string) => void;
}

/** Which strategy's tester is open, where it is being read, and which strategies' fills the chart
 *  should therefore be drawing.
 *
 *  Extracted from `CandlestickChart` as one unit because these are one fact wearing several hats:
 *  `openStrategyId` decides the panel, the panel's own view mode, *and* — through
 *  `closedDrawingPrefixes` — which fills reach the canvas. Keeping them together is what stops the
 *  third from drifting away from the first two, which is exactly what happened when the fills were
 *  hidden imperatively instead of derived. */
export function useStrategyPanelState({ scripts, restoreScriptOutput }: UseStrategyPanelStateArgs) {
  // Every enabled script that declared `@strategy` (see scriptKind.ts). The decorator is read from
  // the source text, so this costs a regex per script per render and needs no run to be known —
  // which is what lets the panel exist before the first backtest has produced anything.
  const strategyScripts = useMemo(
    () => scripts.filter((s) => s.enabled !== false && analyzeScriptKind(s.code).kind === "strategy"),
    [scripts],
  );
  const strategyScriptIds = useMemo(() => strategyScripts.map((s) => s.id), [strategyScripts]);

  // Where the tester is being read: docked under the chart, filling a modal, or torn off into a
  // window of its own. Exactly one at a time — the point of the last two is to get the pane out of
  // the way, so leaving it behind as well would defeat them.
  const [view, setView] = useState<"docked" | "fullscreen" | "detached">("docked");
  const [detachedWindow, setDetachedWindow] = useState<Window | null>(null);

  /** Strategies whose tester the user has closed *by hand*.
   *
   *  The one piece of state the open strategy is derived from, and the reason the derivation is
   *  safe. An earlier rule — "nothing is open and a strategy exists, so open one" — could not tell
   *  a chart that had never shown a tester from one whose tester had just been closed: closing set
   *  the id to null, the rule read that as an invitation, and the panel came back within the frame.
   *  Recording the close instead makes the two cases different facts. */
  const [closedByUser, setClosedByUser] = useState<string[]>([]);

  /** Which strategy the reader has explicitly asked for, when they have asked for one. `null` means
   *  "whichever the rule below picks", not "none". */
  const [chosenStrategyId, setChosenStrategyId] = useState<string | null>(null);

  /** Which strategy's panel is open — derived, not stored.
   *
   *  **A strategy and its tester are one thing.** Its lines on the price, its panes and its trade
   *  markers are shown if and only if its tester is open, and its tester is open unless it was
   *  closed by hand. So an enabled strategy arrives with both, closing either takes both, and there
   *  is no state in which the chart carries a strategy's marks with nothing on screen accounting
   *  for them (exigence : « les deux éléments sont liés, si un est fermé l'autre aussi, vice
   *  versa »).
   *
   *  This replaces an auto-open that only fired for a strategy which had just *appeared*, on the
   *  reasoning that a chart loaded carrying one had not asked for its tester. The reasoning held,
   *  and the result was a strategy drawing overlays under a closed panel — exactly the pairing the
   *  rule above forbids.
   *
   *  One at a time, because the tester is one panel. A second strategy opened takes the first's
   *  place, and the first's marks go with it rather than accumulating unexplained on the candles. */
  const openStrategyId = useMemo(() => {
    if (chosenStrategyId !== null && strategyScriptIds.includes(chosenStrategyId)) return chosenStrategyId;
    return strategyScripts.find((s) => !closedByUser.includes(s.id))?.id ?? null;
  }, [chosenStrategyId, strategyScriptIds, strategyScripts, closedByUser]);

  const openStrategy = strategyScripts.find((s) => s.id === openStrategyId) ?? null;

  // Un-withholds whatever the open strategy had withheld — the case `beforeRemoveIndicator` creates
  // when the reader removes one of its indicators from the chart (see `scriptPaneRemoval`). Keyed on
  // the id alone: re-running it for the same open strategy would do nothing anyway, and this is the
  // one side effect the derivation above cannot express.
  useEffect(() => {
    if (openStrategyId !== null) restoreScriptOutput(openStrategyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openStrategyId]);

  const close = useCallback(() => {
    if (openStrategyId !== null) setClosedByUser((ids) => (ids.includes(openStrategyId) ? ids : [...ids, openStrategyId]));
    setChosenStrategyId(null);
    // Back to docked, so reopening never lands in a mode left behind from last time.
    setView("docked");
  }, [openStrategyId]);

  /** Open it, or close it if this same strategy's panel is already the one showing. */
  const toggle = useCallback(
    (scriptId: string) => {
      if (openStrategyId === scriptId) {
        setClosedByUser((ids) => (ids.includes(scriptId) ? ids : [...ids, scriptId]));
        setChosenStrategyId(null);
        return;
      }
      setClosedByUser((ids) => ids.filter((id) => id !== scriptId));
      setChosenStrategyId(scriptId);
    },
    [openStrategyId],
  );

  /** Tears the tester off into a window of its own.
   *
   *  The window is opened inside the click, rather than by the component that renders into it: a
   *  `window.open` that runs later — from an effect, once React has re-rendered — is no longer
   *  attributed to the gesture, and browsers block it as an unsolicited popup. When it *is* blocked
   *  anyway (a blanket block on this site), nothing changes and the pane stays put, which leaves
   *  the browser's own blocked-popup indicator as the explanation rather than a button that appears
   *  to do nothing at all. */
  const detach = useCallback(() => {
    const child = window.open("", "", "width=1100,height=720");
    if (child === null) return;
    setDetachedWindow(child);
    setView("detached");
  }, []);

  /** Id prefixes of every strategy that is *not* the open one — what the chart filters all of a
   *  strategy's own output against: its fills and markers, its panes and its overlays alike.
   *
   *  The other half of "a strategy and its tester are one thing". Stated as a rule over the open
   *  one, it cannot come apart: the marks are drawn if and only if the panel that accounts for them
   *  is. */
  const closedPrefixes = useMemo(
    () => strategyScripts.filter((s) => s.id !== openStrategyId).map((s) => `script:${s.id}:`),
    [strategyScripts, openStrategyId],
  );

  return {
    strategyScripts,
    strategyScriptIds,
    openStrategyId,
    openStrategy,
    view,
    setView,
    detachedWindow,
    setDetachedWindow,
    close,
    toggle,
    detach,
    closedPrefixes,
  };
}
