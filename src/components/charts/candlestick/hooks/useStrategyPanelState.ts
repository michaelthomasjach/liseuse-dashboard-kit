import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzeScriptKind } from "../scripting/scriptKind";
import type { ScriptDef } from "../interfaces/ScriptDef.interface";

export interface UseStrategyPanelStateArgs {
  scripts: ScriptDef[];
  /** Un-withholds a script's own drawings. Only reached for a strategy that has just appeared —
   *  see the effect below for the one case it covers. */
  restoreScriptDrawings: (scriptId: string) => void;
}

/** Which strategy's tester is open, where it is being read, and which strategies' fills the chart
 *  should therefore be drawing.
 *
 *  Extracted from `CandlestickChart` as one unit because these are one fact wearing several hats:
 *  `openStrategyId` decides the panel, the panel's own view mode, *and* — through
 *  `closedDrawingPrefixes` — which fills reach the canvas. Keeping them together is what stops the
 *  third from drifting away from the first two, which is exactly what happened when the fills were
 *  hidden imperatively instead of derived. */
export function useStrategyPanelState({ scripts, restoreScriptDrawings }: UseStrategyPanelStateArgs) {
  // Every enabled script that declared `@strategy` (see scriptKind.ts). The decorator is read from
  // the source text, so this costs a regex per script per render and needs no run to be known —
  // which is what lets the panel exist before the first backtest has produced anything.
  const strategyScripts = useMemo(
    () => scripts.filter((s) => s.enabled !== false && analyzeScriptKind(s.code).kind === "strategy"),
    [scripts],
  );
  const strategyScriptIds = useMemo(() => strategyScripts.map((s) => s.id), [strategyScripts]);

  // Which strategy's panel is open. A strategy whose tester never shows up is a strategy nobody can
  // read, so one opens on its own the first time it *appears* — but only then. Reopened from its
  // own legend row afterwards (see ChartLegend's own strategy-tester button).
  const [openStrategyId, setOpenStrategyId] = useState<string | null>(null);
  const openStrategy = strategyScripts.find((s) => s.id === openStrategyId) ?? null;

  // Where the tester is being read: docked under the chart, filling a modal, or torn off into a
  // window of its own. Exactly one at a time — the point of the last two is to get the pane out of
  // the way, so leaving it behind as well would defeat them.
  const [view, setView] = useState<"docked" | "fullscreen" | "detached">("docked");
  const [detachedWindow, setDetachedWindow] = useState<Window | null>(null);

  // Auto-opens a strategy that has just *appeared*, and nothing else. The rule this replaces was
  // "nothing is open and a strategy exists, so open one", which could not tell a chart that had
  // never shown a tester from one whose tester the user had just closed: closing it set the id to
  // null, this effect read that as an invitation, and the panel came back within the same frame.
  // The close button worked perfectly and was undone before it could be seen.
  const knownIdsRef = useRef<string[]>([]);
  // Whether the effect below has run once. Strategies already present at mount — a caller's own
  // `defaultScripts` — have not "just appeared" from anyone's point of view: the chart simply
  // loaded carrying them, and opening a tester over the candles before the user has asked for
  // anything is the panel imposing itself rather than answering. They are recorded as known on the
  // first pass and open nothing; a strategy created or enabled afterwards still opens on its own,
  // which is the case the auto-open exists for.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      knownIdsRef.current = strategyScriptIds;
      return;
    }
    const appeared = strategyScriptIds.find((id) => !knownIdsRef.current.includes(id));
    knownIdsRef.current = strategyScriptIds;
    setOpenStrategyId((current) => {
      // The open one was deleted, disabled, or stopped being a @strategy: show whatever just
      // arrived instead, and otherwise close rather than silently switching to an unrelated one.
      if (current !== null && !strategyScriptIds.includes(current)) return appeared ?? null;
      if (current === null && appeared !== undefined) return appeared;
      return current;
    });
    // Outside the updater, never inside it: an updater must be a pure function of the previous
    // state — React is free to call it twice, and a second call here would be a second side effect.
    // The restore covers the one case the derived rule below cannot: a strategy whose drawings
    // `beforeRemoveIndicator` withheld because the user removed one of its indicators.
    if (appeared !== undefined) restoreScriptDrawings(appeared);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategyScriptIds]);

  const close = useCallback(() => {
    setOpenStrategyId(null);
    // Back to docked, so reopening never lands in a mode left behind from last time.
    setView("docked");
  }, []);

  /** Open it, or close it if this same strategy's panel is already the one showing. */
  const toggle = useCallback((scriptId: string) => {
    setOpenStrategyId((current) => (current === scriptId ? null : scriptId));
  }, []);

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

  /** Drawing-id prefixes belonging to every strategy whose panel is *not* open — what the chart
   *  filters its script drawings against.
   *
   *  Derived, never toggled, and that distinction is the whole bug it replaces: withholding on
   *  close only ever holds if the panel was open first, so the moment the tester stopped opening
   *  itself at load, every backtest's fills sat on the candles with nothing on screen to explain
   *  them. Stated as a rule it cannot come apart — the markers are drawn if and only if the panel
   *  that accounts for them is. */
  const closedDrawingPrefixes = useMemo(
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
    closedDrawingPrefixes,
  };
}
