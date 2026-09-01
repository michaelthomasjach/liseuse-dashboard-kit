import type { IndicatorInfoTarget } from "../interfaces/IndicatorInfoTarget.interface";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { CustomIndicatorDef } from "../interfaces/CustomIndicatorDef.interface";
import type { IndicatorCatalogEntry } from "../indicatorCatalog";
import { indicatorCatalogEntry } from "../indicatorCatalog";
import {
  DEFAULT_PANE_HEIGHT_FRACTION,
  MIN_PANE_HEIGHT_FRACTION,
  MAX_PANE_HEIGHT_FRACTION,
  SUB_PANE_COLLAPSED_HEIGHT,
} from "../constants";

// A script-produced "own"-pane indicator's own `plot.pane(name, { dock })` choice, carried on its
// `customData` (see CustomIndicatorDef.dock's own doc) — a built-in indicator (never has
// `customData`) is always "bottom", the original stacking-below-price behavior.
function indicatorDock(ind: Indicator): "bottom" | "left" | "right" {
  return ind.customData?.dock ?? "bottom";
}

// A `plot.pane(name, { dock: "left"|"right" })` script pane's own column has nothing else to
// absorb whatever height its panes *don't* claim — unlike the bottom stack, where price quietly
// eats whatever indicatorPanesTotalHeight leaves over (see priceHeight below), a side column is
// made *entirely* of these panes, so DEFAULT_PANE_HEIGHT_FRACTION's flat 22% (right for a bottom
// stack, where several panes sharing space alongside price is the common case) left a solo docked
// pane using barely a fifth of its own column, the rest just blank canvas. Normalizes every
// *expanded* pane's own fraction (still whatever startPaneResize's own drag wrote, or an even
// split by default — 1 / expandedCount, not the bottom stack's flat default) against their own
// sum, so together they always fill exactly `boundedHeight` — a lone pane always gets the whole
// column (dragging its own resize handle is then correctly a no-op, nothing to redistribute *to*),
// two even ones split it 50/50 by default, and so on. Collapsed panes take *no* vertical room here
// (height 0) — unlike the bottom stack, where collapsing shrinks a pane along the stack's own axis
// down to a SUB_PANE_COLLAPSED_HEIGHT band that stays in the stack. A docked pane instead folds
// sideways, out of the vertical stack entirely and into its own SIDE_DOCK_COLLAPSED_WIDTH band at
// the column's outer edge (see ChartSidePaneColumn.tsx), so the panes still expanded here share the
// column's *whole* height between them rather than the leftovers.
// Resolves `sidePaneCollapsed` (UI state, see its own doc) onto the indicator itself, so every
// consumer downstream — stackSidePanes here, the column's canvas draw, its axes, its headers —
// keeps reading the plain `ind.paneCollapsed` it already read, with no predicate threaded through
// four layers. Returns the indicator untouched while no override exists for it.
function withSideCollapsed(ind: Indicator, collapsed: Record<string, boolean>): Indicator {
  const override = collapsed[ind.id];
  return override === undefined || override === ind.paneCollapsed ? ind : { ...ind, paneCollapsed: override };
}

// Re-applies a settings-modal edit onto a freshly regenerated script indicator (see
// `scriptIndicatorOverrides`' own doc). `id`/`kind`/`customData` are deliberately restored from the
// script's own output afterwards: those describe what the indicator *is* — which series it draws,
// which side it docks to — and belong to the code, not to the settings modal, so a stale override
// can never pin them to what the script used to say.
function withScriptOverride(ind: Indicator, overrides: Record<string, Partial<Indicator>>): Indicator {
  const override = overrides[ind.id];
  if (!override) return ind;
  return { ...ind, ...override, id: ind.id, kind: ind.kind, customData: ind.customData };
}

function stackSidePanes(
  owned: Indicator[],
  heightFractions: Record<string, number>,
  boundedHeight: number
): { heights: number[]; tops: number[] } {
  const expandedCount = owned.filter((ind) => !ind.paneCollapsed).length;
  const rawFractions = owned.map((ind) => (ind.paneCollapsed ? 0 : (heightFractions[ind.id] ?? 1 / expandedCount)));
  const fractionSum = rawFractions.reduce((sum, f) => sum + f, 0) || 1;
  const heights = owned.map((ind, i) => (ind.paneCollapsed ? 0 : Math.round(boundedHeight * (rawFractions[i] / fractionSum))));
  const tops: number[] = [];
  let cursor = 0;
  for (const h of heights) {
    tops.push(cursor);
    cursor += h;
  }
  return { heights, tops };
}

export interface UsePaneLayoutArgs {
  defaultIndicators: Indicator[] | undefined;
  onIndicatorsChange: ((indicators: Indicator[]) => void) | undefined;
  showVolume: boolean;
  plotBoundedHeight: number;
  /** Script-produced indicators (see `scripting/scriptIndicatorToChartIndicator.ts`) that need
   *  pane space but aren't part of the CRUD-managed `indicators` state below — never passed to
   *  `onIndicatorsChange`, never touched by add/remove/settings, never included in a saved
   *  template. Folded into `owned` (and therefore `ownPaneIndicators`/the height/top arrays) only,
   *  exactly the "additive, not merged" split the approved scripting-engine plan calls for. */
  extraIndicators?: Indicator[];
}

/** Technical indicators (state + CRUD) and the sub-pane layout system they (and volume) share:
 *  which pane sits where, its height, its own manual Y-rescale, and drag-to-resize/drag-to-reorder
 *  between panes. Kept as one hook since a pane's own layout is fundamentally indexed by
 *  `indicators` (an "own"-pane indicator's id doubles as its pane key) — splitting the two apart
 *  would just mean threading `indicators` back and forth between two hooks that both need it on
 *  nearly every line. */
export function usePaneLayout({ defaultIndicators, onIndicatorsChange, showVolume, plotBoundedHeight, extraIndicators: rawExtraIndicators = [] }: UsePaneLayoutArgs) {
  const [indicators, setIndicators] = useState<Indicator[]>(defaultIndicators ?? []);
  const [indicatorPickerOpen, setIndicatorPickerOpen] = useState(false);
  const [indicatorSearchQuery, setIndicatorSearchQuery] = useState("");
  // Which indicator's own "how this works" info modal is open (see INDICATOR_DESCRIPTIONS) — "volume"
  // included since it gets the same info affordance despite not being an Indicator entry itself
  // (see IndicatorModals.tsx's own onOpenIndicatorInfo doc). Lives here (not a local useState in
  // CandlestickChart.tsx, which is why it moved) since it's squarely part of this hook's own
  // indicator-related state cluster, not a reason of its own.
  const [infoKind, setInfoKind] = useState<IndicatorInfoTarget | null>(null);
  const [editingIndicatorId, setEditingIndicatorId] = useState<string | null>(null);
  const [indicatorDraft, setIndicatorDraft] = useState<Indicator | null>(null);
  const [hoveredIndicatorId, setHoveredIndicatorId] = useState<string | null>(null);
  // The tools-rail "manage indicators" modal (a flat list grouped by overlay/own-pane, not tied
  // to hovering any one legend/pane entry) — separate from editingIndicatorId above, which is
  // "which indicator's settings modal is open" and can be triggered *from* a row in this list.
  const [indicatorsManagerOpen, setIndicatorsManagerOpen] = useState(false);
  // Ctrl/Cmd+C over a legend item copies it here (a ref, not state — it's never read during
  // render, so there's no reason to pay for a re-render just to remember it); Ctrl/Cmd+V pastes
  // a fresh copy (new id) appended to `indicators` from wherever this last got set. Deliberately
  // chart-local (not the real OS clipboard) — copying between two *different* chart instances on
  // the same page isn't a scenario this was built for.
  const copiedIndicatorRef = useRef<Indicator | null>(null);
  const indicatorIdRef = useRef(0);
  // Which "own"-pane indicator is currently being dragged by its header's grip handle, for
  // reordering — also doubles as the dragged pane's own "currently dragging" visual cue, since
  // without any feedback at all a drag that hasn't yet crossed into a neighboring pane's own
  // midpoint looks and feels completely inert.
  const [draggingPaneId, setDraggingPaneId] = useState<string | null>(null);
  // Where Volume sits among the "own"-pane indicators — an index into that filtered sequence
  // (0 = before all of them, the historical fixed position; indicators.length = after all of
  // them), not a stored id-based position, so it never goes stale as indicators are themselves
  // added/removed/reordered around it. Volume used to be pinned here permanently; now it's just
  // this array's own starting position, changed by dragging its header's grip handle same as any
  // indicator's.
  const [volumePaneOrder, setVolumePaneOrder] = useState(0);
  // Local view state for the volume pane's own header (name/collapse/remove), layered on top of
  // the `showVolume` prop rather than replacing it: `showVolume` is the caller's own on/off
  // switch, this is the user's in-session view preference once it's on. Not lifted to a prop —
  // no request for the app to control or persist it, same as the other UI-only toggles here.
  const [volumePaneState, setVolumePaneState] = useState<"expanded" | "collapsed" | "hidden">("expanded");
  // Manually-resized sub-pane heights (volume, or an "own"-pane indicator, keyed by "volume" or
  // the indicator's own id), as a fraction of the plot's own bounded height — set by dragging a
  // pane's own top divider (see startPaneResize). Missing entries fall back to
  // DEFAULT_PANE_HEIGHT_FRACTION, same as before per-pane resize existed at all.
  const [paneHeightFractions, setPaneHeightFractions] = useState<Record<string, number>>({});
  // Whether each *docked* pane is folded, keyed by pane id — deliberately its own UI state rather
  // than the `Indicator.paneCollapsed` field the bottom stack toggles through `commitIndicators`.
  // A docked pane is very often script-produced (`plot.pane(name, { dock })`), and those live in
  // `extraIndicators`, never in the CRUD `indicators` list — so `commitIndicators` has nothing to
  // write the flag onto and folding one was silently a no-op. Same per-pane-id, UI-only shape as
  // `paneHeightFractions` right above, which already covers script panes for the same reason.
  // Falls back to the indicator's own `paneCollapsed` while unset, so a saved template that starts
  // a pane folded still opens folded.
  const [sidePaneCollapsed, setSidePaneCollapsed] = useState<Record<string, boolean>>({});
  // Script-produced indicators the user has deleted from the chart, by id. Same reason
  // `sidePaneCollapsed` above exists: these live in `extraIndicators`, never in the CRUD
  // `indicators` list, so `removeIndicator`'s own filter had nothing to remove and its trash button
  // was silently inert. Deleting one hides that single output — the script itself keeps running and
  // stays in the saved-scripts list (its other outputs, signals and drawings included, are
  // untouched); removing the *script* is the editor panel's own job, see ScriptEditorPanel.
  const [dismissedScriptIndicators, setDismissedScriptIndicators] = useState<Record<string, boolean>>({});
  // Settings-modal edits made to a script-produced indicator, by id. A script indicator is rebuilt
  // from scratch on every run (see `scriptIndicatorToChartIndicator` — `{id, kind, period,
  // customData}`, nothing carried over), so an edit written onto the indicator itself would be
  // discarded by the very next run; and since committing a parameter value *is* a re-run, that
  // would be almost immediately. Held beside the indicator and re-applied after each run instead.
  // Only presentation fields (color, sideAxesVisible, hidden…) ever land here — `id`/`kind`/
  // `customData` stay the script's own, see `withScriptOverride`.
  const [scriptIndicatorOverrides, setScriptIndicatorOverrides] = useState<Record<string, Partial<Indicator>>>({});
  // What every consumer below (and the caller, which rebuilds its own combined list from this) uses
  // in place of the raw prop, so a deleted script output disappears from the pane stacks, the
  // docked columns and the legend in one move rather than each filtering separately.
  const extraIndicators = useMemo(
    () => rawExtraIndicators.filter((ind) => !dismissedScriptIndicators[ind.id]).map((ind) => withScriptOverride(ind, scriptIndicatorOverrides)),
    [rawExtraIndicators, dismissedScriptIndicators, scriptIndicatorOverrides]
  );
  // Manual vertical rescale for a sub-pane's own value axis (volume, or an "own"-pane
  // indicator's, keyed the same way as paneHeightFractions above) — dragging that pane's own Y
  // axis strip (see handlePaneYAxisPointerDown) sets a d3.ZoomTransform here, the same
  // scale+translate representation `yTransform` already uses for the price axis, applied via the
  // same `.rescaleY(baseScale)` call. Missing entries mean "not manually adjusted" (d3.zoomIdentity).
  const [paneYTransform, setPaneYTransform] = useState<Record<string, d3.ZoomTransform>>({});
  const paneYAxisDragRef = useRef<{ paneId: string; startPos: number; startTransform: d3.ZoomTransform; size: number } | null>(null);

  function getPaneYTransform(paneId: string): d3.ZoomTransform {
    return paneYTransform[paneId] ?? d3.zoomIdentity;
  }

  // Same drag-to-rescale math as useAxisDragRescale (dragging up zooms in, scales around the
  // strip's own midpoint) — reimplemented rather than reused because that hook calls useRef
  // itself, and the number of sub-panes needing this varies at runtime (one per indicator plus
  // volume), which the rules of hooks don't allow calling a hook a variable number of times for.
  function handlePaneYAxisPointerDown(paneId: string, size: number) {
    return (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      paneYAxisDragRef.current = { paneId, startPos: e.clientY, startTransform: getPaneYTransform(paneId), size };
    };
  }

  function handlePaneYAxisPointerMove(e: React.PointerEvent) {
    const drag = paneYAxisDragRef.current;
    if (!drag) return;
    const delta = e.clientY - drag.startPos;
    const factor = Math.exp(-delta * 0.008);
    const k0 = drag.startTransform.k;
    // No natural ceiling for a sub-pane's own Y axis either — same reasoning as the price axis's
    // own DEFAULT_Y_SCALE_EXTENT in useAxisDragRescale.ts, a generous finite stand-in for
    // "unbounded" rather than a deliberate limit. The floor mirrors the ceiling (0.0001 = 1/10000)
    // rather than 1 — flooring at 1 (the base/identity scale) made dragging to zoom *out* from a
    // fresh, never-adjusted pane a no-op: k0 starts at 1, so any factor < 1 was immediately clamped
    // straight back up to 1 by Math.max, and there was no way to ever get below it from there.
    const k1 = Math.min(10000, Math.max(0.0001, k0 * factor));
    const center = drag.size / 2;
    const t0 = drag.startTransform.y;
    const t1 = center - (center - t0) * (k1 / k0);
    setPaneYTransform((prev) => ({ ...prev, [drag.paneId]: d3.zoomIdentity.scale(k1).translate(0, t1 / k1) }));
  }

  function handlePaneYAxisPointerUp(e: React.PointerEvent) {
    paneYAxisDragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function resetPaneYAxis(paneId: string) {
    setPaneYTransform((prev) => {
      if (!(paneId in prev)) return prev;
      const next = { ...prev };
      delete next[paneId];
      return next;
    });
  }

  // useCallback (not a plain function like most of this file's own helpers) specifically because
  // it's a dependency of the copy/paste keydown effect below — without a stable identity, that
  // effect would tear down and re-add its own `window` listener on every render of this hook
  // (crosshair hover, zoom/pan… none of which this function's own behavior actually depends on),
  // not just when `onIndicatorsChange` itself changes.
  const commitIndicators = useCallback(
    (next: Indicator[]) => {
      setIndicators(next);
      onIndicatorsChange?.(next);
    },
    [onIndicatorsChange]
  );

  // Writes both channels. The `sidePaneCollapsed` record is the one every docked pane actually
  // reads (see its own doc — it's the only channel a script-produced pane has at all), but a pane
  // that *is* in the CRUD list also gets the flag written onto the indicator itself, so folding a
  // docked pane still survives being saved into a template exactly as it did before that record
  // existed. Defined here rather than beside its own useState so it can reach `commitIndicators`.
  const toggleSidePaneCollapsed = useCallback(
    (paneId: string, collapsed: boolean) => {
      setSidePaneCollapsed((prev) => ({ ...prev, [paneId]: collapsed }));
      setIndicators((prev) => {
        if (!prev.some((ind) => ind.id === paneId)) return prev;
        const next = prev.map((ind) => (ind.id === paneId ? { ...ind, paneCollapsed: collapsed } : ind));
        onIndicatorsChange?.(next);
        return next;
      });
    },
    [onIndicatorsChange]
  );

  // Replaces every piece of state a saved template snapshot covers, wholesale rather than
  // merging — loading a template means the pane layout ends up looking *exactly* like it did
  // when saved, including dropping any manual pane-height resize the current (not the template's
  // own) layout happened to have. Used by useChartTemplates' own loadTemplate; not exposed as a
  // prop since nothing about "which template is active" is meant to be controlled by the caller,
  // same as `draggingPaneId`/`volumePaneState` above.
  function loadIndicatorLayout(snapshot: {
    indicators: Indicator[];
    volumePaneOrder: number;
    volumePaneState: "expanded" | "collapsed" | "hidden";
    paneHeightFractions: Record<string, number>;
  }) {
    commitIndicators(snapshot.indicators);
    setVolumePaneOrder(snapshot.volumePaneOrder);
    setVolumePaneState(snapshot.volumePaneState);
    setPaneHeightFractions(snapshot.paneHeightFractions);
    // A template snapshot carries no fullscreen state of its own — clearing it here (rather than
    // leaving the stale-pane effect above to catch it a tick later) avoids a one-frame flash of
    // the old fullscreened pane rendered against the *new* layout's indicators.
    setFullscreenPaneId(null);
  }

  function addIndicator(entry: IndicatorCatalogEntry) {
    commitIndicators([
      ...indicators,
      {
        id: `indicator-${indicatorIdRef.current++}`,
        kind: entry.kind,
        period: entry.defaultPeriod,
        stdDev: entry.hasStdDev ? 2 : undefined,
        ...(entry.kind === "macd" ? { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } : {}),
      },
    ]);
  }

  // A caller-supplied CustomIndicatorDef (see CandlestickChartProps.customIndicators) instead of
  // one of the built-in catalog's own entries — carries a full copy of `def` on `customData`
  // rather than just its id (see that field's own doc), with "custom" as `kind` purely to satisfy
  // the type (never actually read for these — computeIndicatorValues/indicatorCatalogEntry both
  // check `customData` first).
  function addCustomIndicator(def: CustomIndicatorDef) {
    commitIndicators([...indicators, { id: `indicator-${indicatorIdRef.current++}`, kind: "custom", period: 0, customData: def }]);
  }

  // A lower-level primitive addIndicator/addCustomIndicator above don't need themselves (both
  // already know their own full shape up front) — for a kind like "correlation" that only knows
  // what it's adding *after* an async step elsewhere (see useCorrelationSetup), this is the one
  // piece of "give it a fresh id and commit it" logic worth sharing rather than duplicating.
  function appendIndicator(partial: Omit<Indicator, "id">) {
    commitIndicators([...indicators, { id: `indicator-${indicatorIdRef.current++}`, ...partial }]);
  }

  function openIndicatorSettings(id: string) {
    // Script-produced indicators are not in the CRUD list — looking only there is why the gear on a
    // docked pane's own header used to do nothing at all. `extraIndicators` (not the raw prop) so
    // the modal opens on the values actually on screen, overrides and all.
    const indicator = indicators.find((i) => i.id === id) ?? extraIndicators.find((i) => i.id === id);
    if (!indicator) return;
    setEditingIndicatorId(id);
    setIndicatorDraft(indicator);
  }

  function closeIndicatorSettings() {
    setEditingIndicatorId(null);
    setIndicatorDraft(null);
  }

  function saveIndicatorSettings() {
    if (!editingIndicatorId || !indicatorDraft) return;
    if (indicators.some((i) => i.id === editingIndicatorId)) {
      commitIndicators(indicators.map((i) => (i.id === editingIndicatorId ? indicatorDraft : i)));
    } else {
      // Script-produced: park the edit beside the indicator rather than on it (see
      // `scriptIndicatorOverrides`' own doc). Everything the script itself owns is stripped, so the
      // override survives the script changing its own output.
      const presentation: Partial<Indicator> = { ...indicatorDraft };
      delete presentation.id;
      delete presentation.kind;
      delete presentation.customData;
      setScriptIndicatorOverrides((prev) => ({ ...prev, [editingIndicatorId]: presentation }));
    }
    closeIndicatorSettings();
  }

  function deleteEditingIndicator() {
    if (!editingIndicatorId) return;
    // Through removeIndicator rather than filtering `indicators` here: that one already knows a
    // script-produced indicator isn't in the CRUD list and dismisses it instead (see its own doc).
    // It also clears `fullscreenPaneId` synchronously — same "don't wait for the guard effect a
    // render later" reasoning as loadIndicatorLayout's own doc: deleting the very pane that's
    // currently fullscreened is reachable from its own header, and a render's delay would briefly
    // force every other pane to zero height first.
    removeIndicator(editingIndicatorId);
    closeIndicatorSettings();
  }

  function toggleIndicatorHidden(id: string) {
    if (indicators.some((i) => i.id === id)) {
      commitIndicators(indicators.map((i) => (i.id === id ? { ...i, hidden: !i.hidden } : i)));
      return;
    }
    // Script-produced: `hidden` is a presentation field like any other the settings modal writes,
    // so it goes in the same override channel and survives the next run (see
    // `scriptIndicatorOverrides`' own doc).
    const current = extraIndicators.find((i) => i.id === id);
    if (!current) return;
    setScriptIndicatorOverrides((prev) => ({ ...prev, [id]: { ...prev[id], hidden: !current.hidden } }));
  }

  function removeIndicator(id: string) {
    // A script-produced indicator isn't in the CRUD list at all, so filtering that list would be a
    // no-op (which is exactly what the trash button used to be for those). Record it as dismissed
    // instead — see `dismissedScriptIndicators`' own doc: the pane goes, the script stays.
    if (indicators.some((i) => i.id === id)) commitIndicators(indicators.filter((i) => i.id !== id));
    else setDismissedScriptIndicators((prev) => ({ ...prev, [id]: true }));
    if (fullscreenPaneId === id) setFullscreenPaneId(null);
  }

  // Ctrl/Cmd+C over a hovered legend item copies that indicator (copiedIndicatorRef); Ctrl/Cmd+V
  // pastes a duplicate of whatever was last copied (new id, everything else — kind/period/
  // color/etc. — unchanged) appended to the list. Mirrors the browser's own shortcuts rather than
  // inventing new ones, so it's skipped while a text input has focus for the same reason the
  // drawing-delete effect (see useDrawingState) is.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key !== "c" && key !== "v") return;
      const active = document.activeElement;
      const isEditableFocused = active instanceof HTMLElement && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      if (isEditableFocused) return;
      if (key === "c") {
        if (!hoveredIndicatorId) return;
        const indicator = indicators.find((i) => i.id === hoveredIndicatorId);
        if (indicator) copiedIndicatorRef.current = indicator;
        return;
      }
      if (!copiedIndicatorRef.current) return;
      e.preventDefault();
      const next = [...indicators, { ...copiedIndicatorRef.current, id: `indicator-${indicatorIdRef.current++}` }];
      commitIndicators(next);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hoveredIndicatorId, indicators, commitIndicators, copiedIndicatorRef, indicatorIdRef]);

  const volumeVisible = showVolume && volumePaneState !== "hidden";
  const volumeCollapsed = volumeVisible && volumePaneState === "collapsed";

  // Which sub-pane (volume, or an "own"-pane indicator's own id) currently owns the *entire*
  // plot — price included, not just the other sub-panes — via its own header's maximize button
  // (see togglePaneFullscreen below). null the rest of the time, the ordinary shared-layout
  // behavior every height/top computation below already had before this existed.
  const [fullscreenPaneId, setFullscreenPaneId] = useState<string | null>(null);

  // Guards every way `fullscreenPaneId` could otherwise end up pointing at a pane that no
  // longer exists — the indicator itself got removed (one at a time, "tout supprimer", or a
  // freshly-loaded template wholesale-replacing `indicators`), or volume got hidden — rather
  // than scattering the same check across every one of those call sites individually. Left
  // stale, the chart would be stuck with price/volume/every other indicator forced to zero
  // height (see the height computations below) and no visible header left to un-stick it from,
  // since the one button that could exit fullscreen no longer renders either.
  useEffect(() => {
    if (fullscreenPaneId === null) return;
    if (fullscreenPaneId === "volume") {
      if (!volumeVisible) setFullscreenPaneId(null);
      return;
    }
    if (!indicators.some((ind) => ind.id === fullscreenPaneId) && !extraIndicators.some((ind) => ind.id === fullscreenPaneId)) {
      setFullscreenPaneId(null);
    }
  }, [fullscreenPaneId, indicators, extraIndicators, volumeVisible]);

  // The button that calls this only ever renders on an already-expanded pane's header (collapsed,
  // a pane shows just its own re-expand chevron — see PaneHeaders), so there's no "entering
  // fullscreen on a collapsed pane" case to handle here.
  function togglePaneFullscreen(paneId: string) {
    setFullscreenPaneId((current) => (current === paneId ? null : paneId));
  }

  function paneHeightFraction(key: string): number {
    return paneHeightFractions[key] ?? DEFAULT_PANE_HEIGHT_FRACTION;
  }

  // Drag-to-resize a sub-pane via its own top divider: grow/shrink that one pane's height
  // fraction directly, same window-pointermove-listener pattern the plot's own 2D-pan-Y drag
  // uses rather than a second setPointerCapture on top of whatever's already attached to this
  // element.
  function startPaneResize(paneKey: string, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startClientY = e.clientY;
    const startFraction = paneHeightFraction(paneKey);
    const onMove = (ev: PointerEvent) => {
      if (plotBoundedHeight <= 0) return;
      const deltaFraction = (ev.clientY - startClientY) / plotBoundedHeight;
      const next = Math.min(MAX_PANE_HEIGHT_FRACTION, Math.max(MIN_PANE_HEIGHT_FRACTION, startFraction - deltaFraction));
      setPaneHeightFractions((prev) => ({ ...prev, [paneKey]: next }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Reorders the "own"-pane indicators (RSI/CHOP/MACD) among themselves, leaving every
  // price-overlay indicator (SMA/EMA/…) exactly where it already sat in `indicators` — dragging a
  // pane never needs a separate order field of its own since ownPaneIndicators' displayed order
  // already *is* just indicators.filter(pane === "own"), so reordering the panes means splicing
  // that subsequence back into the full array in its new order. Volume isn't part of `indicators`
  // at all (see `volumePaneOrder`/`reorderPanes` below for how it still participates in the same
  // drag). Defensive against `newOwnOrder` being built from a snapshot that's gone slightly stale
  // by the time this runs (pointermove can fire faster than React re-renders during a fast drag,
  // so a queued call can still be working off the *previous* render's ownPaneIndicators) —
  // rather than a bare `.find()!` that would throw and corrupt `indicators` with an `undefined`
  // entry the moment an id doesn't resolve, unmatched ids are just dropped and any own-pane
  // indicator this pass doesn't have a replacement for keeps its current spot.
  function reorderOwnPaneIndicators(newOwnOrder: string[]) {
    const byId = new Map(indicators.map((ind) => [ind.id, ind]));
    const reordered = newOwnOrder.map((id) => byId.get(id)).filter((ind): ind is Indicator => ind !== undefined);
    let cursor = 0;
    const next = indicators.map((ind) => (indicatorCatalogEntry(ind).pane === "own" ? (reordered[cursor++] ?? ind) : ind));
    commitIndicators(next);
  }
  // The pane-drag-reorder effect (see usePaneDragReorder) works over one unified order ("volume"
  // plus every own-pane indicator's id, interleaved) since either kind of pane can now be dragged
  // anywhere among the rest — this splits that unified order back into the two separate
  // mechanisms actually driving it: `volumePaneOrder` (a plain index) for volume,
  // `reorderOwnPaneIndicators` (above) for the indicators' own relative order.
  // `newOrder.indexOf("volume")` already equals "how many indicators precede it", exactly
  // `volumePaneOrder`'s own definition, since nothing else but volume and indicator ids ever
  // appears in this array.
  function reorderPanes(newOrder: string[]) {
    const volumeIndex = newOrder.indexOf("volume");
    if (volumeIndex !== -1) setVolumePaneOrder(volumeIndex);
    reorderOwnPaneIndicators(newOrder.filter((id) => id !== "volume"));
  }
  // A plain (non-memoized) function closing over `indicators`, so the pane-reorder effect
  // shouldn't resubscribe its window listeners on literally every render just because this
  // particular closure is a new reference each time — reads it through a ref kept in sync during
  // render instead of depending on the function value itself.
  const reorderPanesRef = useRef(reorderPanes);
  reorderPanesRef.current = reorderPanes;

  // No breathing room between the price section and the volume section below it: the divider
  // line itself is the only separation, flush against both (same "the border delimits the
  // content" rule applied to the tools rail and the header above). Collapsed reduces the pane to
  // its own fixed-height header strip instead of the usual proportional split. Fullscreened onto
  // some *other* pane, volume drops to zero regardless of its own collapsed/expanded state —
  // fullscreened onto itself, it claims the entire plot instead.
  const volumeHeight = !volumeVisible
    ? 0
    : fullscreenPaneId !== null
      ? fullscreenPaneId === "volume"
        ? plotBoundedHeight
        : 0
      : volumeCollapsed
        ? SUB_PANE_COLLAPSED_HEIGHT
        : Math.round(plotBoundedHeight * paneHeightFraction("volume"));

  // "own"-pane indicators (RSI/CHOP/MACD) stack below price, in the order they were added,
  // interleaved with volume wherever `volumePaneOrder` currently places it — each sized/collapsed
  // the same way, just keyed by the indicator's own id instead of the fixed "volume" key.
  // `indicatorPaneTops` already reserves room for volume's own height wherever it falls (so every
  // other call site just adds `priceHeight`, never `priceHeight + volumeHeight` — that extra term
  // is now folded in here, at the one place that actually knows where volume sits), `volumeTop`
  // is the mirror image for volume's own top, and `allPanesOrder` is every pane's id (volume
  // included) in on-screen order top to bottom, the shape the drag-reorder effect needs.
  // Memoized (not just plain derived consts) so the canvas draw effect can depend on these
  // directly instead of their own wider, less-stable sources (indicators, paneHeightFractions) —
  // without this they'd be a fresh array/reference every render, which would make an "only these
  // deps" dependency array pointless (always "changed").
  const { ownPaneIndicators, indicatorPaneHeights, indicatorPaneTops, volumeTop, allPanesOrder } = useMemo(() => {
    const owned = [...indicators, ...extraIndicators].filter((ind) => indicatorCatalogEntry(ind).pane === "own" && indicatorDock(ind) === "bottom");
    // A fullscreened *indicator* pane (volume's own case is handled entirely by volumeHeight
    // above — it never needs to touch this array) is filtered down to just itself rather than
    // merely zeroed in place: every one of PaneHeaders/drawVolumeAndPanes/useIndicatorPaneScales
    // renders exactly one row per entry in `ownPaneIndicators`, so anything else left in here
    // would still get its own header/scale rendered at zero height instead of disappearing
    // outright, which is what "this pane owns the whole plot now" actually means.
    if (fullscreenPaneId !== null && fullscreenPaneId !== "volume") {
      const target = owned.filter((ind) => ind.id === fullscreenPaneId);
      return {
        ownPaneIndicators: target,
        indicatorPaneHeights: target.map(() => plotBoundedHeight),
        indicatorPaneTops: target.map(() => 0),
        volumeTop: 0,
        allPanesOrder: target.map((ind) => ind.id),
      };
    }
    if (fullscreenPaneId === "volume") {
      return { ownPaneIndicators: [], indicatorPaneHeights: [], indicatorPaneTops: [], volumeTop: 0, allPanesOrder: ["volume"] };
    }
    const heights = owned.map((ind) =>
      ind.paneCollapsed ? SUB_PANE_COLLAPSED_HEIGHT : Math.round(plotBoundedHeight * (paneHeightFractions[ind.id] ?? DEFAULT_PANE_HEIGHT_FRACTION))
    );
    const insertAt = Math.min(Math.max(0, volumePaneOrder), owned.length);
    let cursor = 0; // relative to right after price
    let vTop = 0;
    const tops: number[] = [];
    const order: string[] = [];
    for (let i = 0; i < heights.length; i++) {
      if (volumeVisible && i === insertAt) {
        vTop = cursor;
        cursor += volumeHeight;
        order.push("volume");
      }
      tops.push(cursor);
      order.push(owned[i].id);
      cursor += heights[i];
    }
    if (volumeVisible && insertAt === heights.length) {
      vTop = cursor;
      order.push("volume");
    }
    return { ownPaneIndicators: owned, indicatorPaneHeights: heights, indicatorPaneTops: tops, volumeTop: vTop, allPanesOrder: order };
  }, [indicators, extraIndicators, paneHeightFractions, plotBoundedHeight, volumeVisible, volumeHeight, volumePaneOrder, fullscreenPaneId]);
  const indicatorPanesTotalHeight = indicatorPaneHeights.reduce((sum, h) => sum + h, 0);

  const priceHeight = Math.max(0, plotBoundedHeight - volumeHeight - indicatorPanesTotalHeight);

  // A `plot.pane(name, { dock: "left"|"right" })` script pane's own column — stacked vertically
  // over the *whole* plot height (price+volume+bottom panes together), not just the price
  // section, since it's a sibling region beside the entire chart, not just beside price (see
  // ChartSidePaneColumn's own doc). Empty (and therefore invisible — CandlestickChart only
  // mounts the column at all once it has something to show) the moment some *other* pane is
  // fullscreened: "this pane claims the entire plot" should mean entire, not "entire minus the
  // side columns" — there's no fullscreen button on a docked pane's own header to reach the
  // opposite case (a docked pane claiming the whole plot itself), so that direction never arises.
  const { leftPaneIndicators, leftPaneHeights, leftPaneTops } = useMemo(() => {
    if (fullscreenPaneId !== null) return { leftPaneIndicators: [] as Indicator[], leftPaneHeights: [] as number[], leftPaneTops: [] as number[] };
    const owned = [...indicators, ...extraIndicators]
      .filter((ind) => indicatorCatalogEntry(ind).pane === "own" && indicatorDock(ind) === "left")
      .map((ind) => withSideCollapsed(ind, sidePaneCollapsed));
    const { heights, tops } = stackSidePanes(owned, paneHeightFractions, plotBoundedHeight);
    return { leftPaneIndicators: owned, leftPaneHeights: heights, leftPaneTops: tops };
  }, [indicators, extraIndicators, paneHeightFractions, plotBoundedHeight, fullscreenPaneId, sidePaneCollapsed]);
  const { rightPaneIndicators, rightPaneHeights, rightPaneTops } = useMemo(() => {
    if (fullscreenPaneId !== null) return { rightPaneIndicators: [] as Indicator[], rightPaneHeights: [] as number[], rightPaneTops: [] as number[] };
    const owned = [...indicators, ...extraIndicators]
      .filter((ind) => indicatorCatalogEntry(ind).pane === "own" && indicatorDock(ind) === "right")
      .map((ind) => withSideCollapsed(ind, sidePaneCollapsed));
    const { heights, tops } = stackSidePanes(owned, paneHeightFractions, plotBoundedHeight);
    return { rightPaneIndicators: owned, rightPaneHeights: heights, rightPaneTops: tops };
  }, [indicators, extraIndicators, paneHeightFractions, plotBoundedHeight, fullscreenPaneId, sidePaneCollapsed]);

  return {
    indicators,
    setIndicators,
    indicatorPickerOpen,
    setIndicatorPickerOpen,
    indicatorSearchQuery,
    setIndicatorSearchQuery,
    infoKind,
    setInfoKind,
    editingIndicatorId,
    setEditingIndicatorId,
    indicatorDraft,
    setIndicatorDraft,
    hoveredIndicatorId,
    setHoveredIndicatorId,
    indicatorsManagerOpen,
    setIndicatorsManagerOpen,
    copiedIndicatorRef,
    indicatorIdRef,
    draggingPaneId,
    setDraggingPaneId,
    volumePaneOrder,
    volumePaneState,
    setVolumePaneState,
    paneHeightFractions,
    paneYTransform,
    getPaneYTransform,
    handlePaneYAxisPointerDown,
    handlePaneYAxisPointerMove,
    handlePaneYAxisPointerUp,
    resetPaneYAxis,
    commitIndicators,
    loadIndicatorLayout,
    addIndicator,
    addCustomIndicator,
    appendIndicator,
    openIndicatorSettings,
    closeIndicatorSettings,
    saveIndicatorSettings,
    deleteEditingIndicator,
    toggleIndicatorHidden,
    removeIndicator,
    volumeVisible,
    volumeCollapsed,
    paneHeightFraction,
    startPaneResize,
    reorderPanes,
    reorderPanesRef,
    ownPaneIndicators,
    indicatorPaneHeights,
    indicatorPaneTops,
    volumeTop,
    allPanesOrder,
    volumeHeight,
    priceHeight,
    fullscreenPaneId,
    togglePaneFullscreen,
    leftPaneIndicators,
    leftPaneHeights,
    leftPaneTops,
    rightPaneIndicators,
    rightPaneHeights,
    rightPaneTops,
    toggleSidePaneCollapsed,
    extraIndicators,
  };
}
