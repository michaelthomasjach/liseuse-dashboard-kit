import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorKind } from "../interfaces/IndicatorKind.interface";
import type { CustomIndicatorDef } from "../interfaces/CustomIndicatorDef.interface";
import type { IndicatorCatalogEntry } from "../indicatorCatalog";
import { indicatorCatalogEntry } from "../indicatorCatalog";
import {
  DEFAULT_PANE_HEIGHT_FRACTION,
  MIN_PANE_HEIGHT_FRACTION,
  MAX_PANE_HEIGHT_FRACTION,
  SUB_PANE_COLLAPSED_HEIGHT,
} from "../constants";

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
export function usePaneLayout({ defaultIndicators, onIndicatorsChange, showVolume, plotBoundedHeight, extraIndicators = [] }: UsePaneLayoutArgs) {
  const [indicators, setIndicators] = useState<Indicator[]>(defaultIndicators ?? []);
  const [indicatorPickerOpen, setIndicatorPickerOpen] = useState(false);
  const [indicatorSearchQuery, setIndicatorSearchQuery] = useState("");
  // Which indicator's own "how this works" info modal is open (see INDICATOR_DESCRIPTIONS) — "volume"
  // included since it gets the same info affordance despite not being an Indicator entry itself
  // (see IndicatorModals.tsx's own onOpenIndicatorInfo doc). Lives here (not a local useState in
  // CandlestickChart.tsx, which is why it moved) since it's squarely part of this hook's own
  // indicator-related state cluster, not a reason of its own.
  const [infoKind, setInfoKind] = useState<IndicatorKind | "volume" | null>(null);
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

  function commitIndicators(next: Indicator[]) {
    setIndicators(next);
    onIndicatorsChange?.(next);
  }

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
    const indicator = indicators.find((i) => i.id === id);
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
    commitIndicators(indicators.map((i) => (i.id === editingIndicatorId ? indicatorDraft : i)));
    closeIndicatorSettings();
  }

  function deleteEditingIndicator() {
    if (!editingIndicatorId) return;
    commitIndicators(indicators.filter((i) => i.id !== editingIndicatorId));
    closeIndicatorSettings();
  }

  function toggleIndicatorHidden(id: string) {
    commitIndicators(indicators.map((i) => (i.id === id ? { ...i, hidden: !i.hidden } : i)));
  }

  function removeIndicator(id: string) {
    commitIndicators(indicators.filter((i) => i.id !== id));
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
    const owned = [...indicators, ...extraIndicators].filter((ind) => indicatorCatalogEntry(ind).pane === "own");
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
  };
}
