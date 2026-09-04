import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { useChartDimensions } from "./internal/useChartDimensions";
import { useViewportWidth } from "./internal/useViewportWidth";
import type { ChartMargin, ChartDimensions } from "./internal/useChartDimensions";
import { useFullscreen } from "./internal/useFullscreen";
import { useSymbolSearchState } from "./candlestick/hooks/useSymbolSearchState";
import { useChartEvents } from "./candlestick/hooks/useChartEvents";
import { useChartDisplayMode } from "./candlestick/hooks/useChartDisplayMode";
import { useTpoOverlay } from "./candlestick/hooks/useTpoOverlay";
import { useChartAppearance } from "./candlestick/hooks/useChartAppearance";
import { usePaneLayout } from "./candlestick/hooks/usePaneLayout";
import { useChartTemplates } from "./candlestick/hooks/useChartTemplates";
import { useHoverSync } from "./candlestick/hooks/useHoverSync";
import { usePaneDragReorder } from "./candlestick/hooks/usePaneDragReorder";
import { useThemePaletteTick } from "./candlestick/hooks/useThemePaletteTick";
import { useDefaultDrawingColor } from "./candlestick/hooks/useDefaultDrawingColor";
import { useAddLineHandlers } from "./candlestick/hooks/useAddLineHandlers";
import { useZoomAndScales } from "./candlestick/hooks/useZoomAndScales";
import { useBarRangeSelection } from "./candlestick/hooks/useBarRangeSelection";
import { useIndicatorPaneScales } from "./candlestick/hooks/useIndicatorPaneScales";
import { useDockedPaneColumnsState } from "./candlestick/hooks/useDockedPaneColumnsState";
import { useDrawingState } from "./candlestick/hooks/useDrawingState";
import { useDrawingInteractions } from "./candlestick/hooks/useDrawingInteractions";
import { useMobilePointPlacement } from "./candlestick/hooks/useMobilePointPlacement";
import { useDrawingToolMenuAnchors } from "./candlestick/hooks/useDrawingToolMenuAnchors";
import { useFloatingToolbarState } from "./candlestick/hooks/useFloatingToolbarState";
import { useAlertFlow } from "./candlestick/hooks/useAlertFlow";
import { useReplayState } from "./candlestick/hooks/useReplayState";
import { useCorrelationSetup } from "./candlestick/hooks/useCorrelationSetup";
import { useRenderCandlestickChart } from "./candlestick/hooks/useRenderCandlestickChart";
import { useSidePanel } from "./candlestick/hooks/useSidePanel";
import { useChartScripting } from "./candlestick/hooks/useChartScripting";
import { ScriptRunnerHost } from "./candlestick/scripting/components/ScriptRunnerHost";
import { ChartHeader } from "./candlestick/components/ChartHeader";
import { ChartSidePanel } from "./candlestick/components/ChartSidePanel";
import { ChartSidePaneColumn } from "./candlestick/components/ChartSidePaneColumn";
import { ToolsRail } from "./candlestick/components/ToolsRail";
import { ChartLegend } from "./candlestick/components/ChartLegend";
import { PaneHeaders } from "./candlestick/components/PaneHeaders";
import { ChartPlotOverlays } from "./candlestick/components/ChartPlotOverlays";
import { ScriptTableOverlay } from "./candlestick/components/ScriptTableOverlay";
import { ScriptLabelOverlay } from "./candlestick/components/ScriptLabelOverlay";
import { FloatingDrawingToolbar } from "./candlestick/components/FloatingDrawingToolbar";
import { ChartModals } from "./candlestick/components/ChartModals";
import { ChartEventTooltip } from "./EventTooltip";
import { SeasonalityView } from "./SeasonalityView";
import "./charts-shared.css";

import type { CandlestickChartProps } from "./CandlestickChart.types";

export type {
  Candle,
  ChartEvent,
  FundamentalDataPoint,
  SymbolSearchCategory,
  SymbolSearchResult,
  TrendLineDrawing,
  OverlayDataPoint,
  IndicatorKind,
  IndicatorBand,
  IndicatorMACD,
  Indicator,
  CustomIndicatorDef,
  ChartTemplate,
  ChartDisplayMode,
  TimeframeOption,
  TimeframeGroup,
  TimeframeEntry,
  CandlestickChartProps, ChartAlert, ChartAlertDraft, ChartAlertCrossing,
  ScriptDef, ScriptAlertEvent,
} from "./CandlestickChart.types";

import { drawingLabel } from "./candlestick/drawingCatalog";
import { indicatorCatalogEntry, indicatorLabel, defaultIndicatorColor } from "./candlestick/indicatorCatalog";
import { CHART_DISPLAY_MODES } from "./candlestick/chartModes";
import { findTimeframeLabel, flattenTimeframeValues } from "./candlestick/timeframes";
import {
  DEFAULT_MARGIN,
  TOOLS_RAIL_WIDTH,
  TOOLS_RAIL_HEIGHT_MOBILE,
  PRICE_AXIS_WIDTH_MOBILE,
  MOBILE_LAYOUT_BREAKPOINT,
  NARROW_EMBED_BREAKPOINT,
  SUB_PANE_COLLAPSED_HEIGHT,
} from "./candlestick/constants";
import { formatPercentFromReference, computeOhlcReadout, toDayInputValue, candleIndexForDay } from "./candlestick/formatting";

/** Stands in for the plot's own pointer-down/up handlers while replay is armed — see where it is
 *  passed below. A module-level constant rather than an inline arrow so the overlay isn't handed a
 *  fresh function identity on every render of an already-armed chart. */
const noopPointerHandler = () => {};

/** A single interactive candlestick chart — drawing tools, indicators, pickers, alerts, symbol
 *  search, and everything else documented on its own props below. Usable standalone, but a few
 *  features (multi-panel layouts, workspace-wide fullscreen, linked panes, the shared watchlist/
 *  alerts side panel) only exist at the `ChartWorkspace` level — use it alongside this component. */
export function CandlestickChart({
  data,
  width,
  height = 380,
  zoomable = true,
  showVolume = true,
  formatDate,
  formatPrice,
  formatVolume,
  fullscreenToggle = true,
  isFullscreen: isFullscreenProp,
  onFullscreenChange,
  seasonality = false,
  replay = false,
  drawingTools = false,
  defaultDrawings,
  onDrawingsChange,
  alerts, onCreateAlert, onUpdateAlert, onDeleteAlert, alertSoundOptions, onPlaySound,
  showIndicators = false,
  defaultIndicators,
  onIndicatorsChange, customIndicators,
  showTemplates = false,
  defaultTemplates,
  onTemplatesChange,
  initialVisibleCandles = 500,
  YAutoScaling = true,
  onYAutoScalingChange,
  timeframes,
  timeframe,
  onTimeframeChange,
  defaultChartDisplayMode,
  onChartDisplayModeChange, renkoAtrPeriod = 14,
  symbol,
  events,
  fundamentals,
  symbolSearch = false,
  symbolSearchResults,
  onSymbolSearchChange,
  onSymbolSelect,
  onAddSymbolOverlay,
  defaultFavoriteSymbolIds,
  onFavoriteSymbolIdsChange,
  livePrice = false,
  syncedHoverDate,
  onHoverDateChange,
  syncedHoverPrice, onHoverPriceChange,
  linkable = false,
  isLinked = false,
  onLinkClick,
  fillHeight = false,
  sidePanel, defaultSidePanelOpen, onSidePanelOpenChange,
  scripts, onScriptsChange, onScriptAlert, onEditScript, onCreateScript, onDeleteScript, onScriptRunOutput, lastCandleOpen = false,
  margin,
  className,
}: CandlestickChartProps) {
  const clipId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const hovered = hoverIndex !== null ? data[hoverIndex] : null;

  const {
    drawings,
    activeTool,
    setActiveTool,
    selectedToolByCategory,
    openToolMenu,
    setOpenToolMenu,
    infoTool,
    setInfoTool,
    pendingPoint,
    setPendingPoint,
    previewPoint,
    setPreviewPoint,
    pendingSecondPoint,
    setPendingSecondPoint,
    pendingExtraPoints,
    setPendingExtraPoints,
    magnetActive,
    setMagnetActive,
    drawingsHidden,
    setDrawingsHidden,
    drawingsLocked,
    setDrawingsLocked,
    visibleDrawings,
    measurePoints,
    setMeasurePoints,
    brushPreview,
    setBrushPreview,
    brushPointsRef,
    brushDrawingRef,
    hoveredDrawingId,
    setHoveredDrawingId,
    hoverY,
    setHoverY,
    hoverVolumeY,
    setHoverVolumeY,
    hoverIndicatorPaneId,
    setHoverIndicatorPaneId,
    hoverIndicatorPaneY,
    setHoverIndicatorPaneY,
    textEntry, setTextEntry, commitTextEntry, cancelTextEntry,
    editingCell, setEditingCell, commitCellEntry, cancelCellEntry,
    setEditingId,
    draft,
    setDraft,
    editModalTab,
    setEditModalTab,
    selectedDrawingId,
    setSelectedDrawingId,
    defaultDrawingStyle,
    setDefaultDrawingStyle,
    addingOverlaySymbols,
    dragEndpointRef,
    dragAxisRef,
    dragMeasureRef, dragMeasureBodyRef, measureBodyHoveredRef,
    drawingIdRef,
    hoveredDrawingIdRef,
    updateHoveredDrawingId,
    dragLineRef,
    isPanningYRef,
    commitDrawings,
    removeSymbolOverlay,
    handleAddSymbolOverlay,
    cancelDrawingTool,
    finalizeElbowArrow,
    handleToolClick,
    handleSelectToolType,
    magnetSnapPrice,
    closeEditModal,
    saveEditModal,
    deleteEditingDrawing,
    duplicateEditingDrawing,
  } = useDrawingState({ data, defaultDrawings, onDrawingsChange, onAddSymbolOverlay });

  const [tfOpen, setTfOpen] = useState(false);
  const {
    settingsOpen, setSettingsOpen,
    upColorOverride, setUpColorOverride,
    downColorOverride, setDownColorOverride,
    volumeUpColorOverride, setVolumeUpColorOverride,
    volumeDownColorOverride, setVolumeDownColorOverride,
    volumeSettingsOpen, setVolumeSettingsOpen,
    yAutoScalingState, setYAutoScalingState,
    futureZoneVisible, setFutureZoneVisible,
    pastZoneVisible, setPastZoneVisible,
    now,
  } = useChartAppearance({ YAutoScaling, livePrice });
  // Swaps the whole chart body for SeasonalityView — its own flag, not folded into
  // `chartDisplayMode`: its x-axis shares no meaningful relationship with candle/line/Renko's.
  const [seasonalityOpen, setSeasonalityOpen] = useState(false);
  const { symbolSearchOpen, setSymbolSearchOpen, symbolSearchQuery, setSymbolSearchQuery, symbolSearchCategory, setSymbolSearchCategory, favoriteSymbolIds, toggleFavoriteSymbol } =
    useSymbolSearchState({ defaultFavoriteSymbolIds, onFavoriteSymbolIdsChange, onSymbolSearchChange });
  // Tickers whose "+" is currently awaiting onAddSymbolOverlay — a Set (not one at a time) since
  // comparing against AAPL shouldn't block also comparing against GOOGL mid-fetch. Just drives
  // each row's own spinner.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tfAnchorRef = useRef<HTMLButtonElement>(null);
  const { menuAnchorRefFor } = useDrawingToolMenuAnchors();
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(
    onFullscreenChange ? { isFullscreen: isFullscreenProp ?? false, onChange: onFullscreenChange } : undefined
  );
  const sidePanelState = useSidePanel({ defaultSidePanelOpen, onSidePanelOpenChange });
  const baseMargin = margin ?? DEFAULT_MARGIN;
  const verticalRailMargin = drawingTools
    ? { ...baseMargin, left: (baseMargin.left ?? DEFAULT_MARGIN.left ?? 0) + TOOLS_RAIL_WIDTH }
    : baseMargin;
  const [ref, rawDims] = useChartDimensions(verticalRailMargin, {
    width: isFullscreen ? undefined : width,
    height: isFullscreen || fillHeight ? undefined : height,
  });
  // The rail docks to the bottom instead of the left once the wrapper is too narrow to stack every
  // tool button vertically (see MOBILE_LAYOUT_BREAKPOINT's own doc) — decided off `rawDims.width`,
  // which useChartDimensions measures straight from the wrapper element regardless of which margin
  // was passed in (margin only affects the *derived* boundedWidth/boundedHeight/margin fields, see
  // that hook's own doc), so it's accurate here even though `verticalRailMargin` above assumed the
  // desktop layout. `rawDims.margin` already has TOOLS_RAIL_WIDTH folded into `left` from that
  // assumption — on mobile, undo that and fold TOOLS_RAIL_HEIGHT_MOBILE into `bottom` instead, then
  // recompute the two bounded dimensions the same way the hook itself does.
  // The phone layout, as a plain width question. `isMobileRail` below is this *and* there being a
  // rail to flip in the first place — a gate that matters only to the rail itself, not to the
  // other things this width decides: a narrower price axis, a script's docked pane opening folded,
  // the legend stacking its quote onto a second line.
  // Pinned by the settings modal's own "Mise en page" toggle; `null` leaves the width in charge.
  // Kept here, beside the measurement it overrides, rather than in useChartAppearance — nothing
  // else in this component's state cluster is about layout, and this reads as one line with the
  // rule it replaces.
  const [layoutOverride, setLayoutOverride] = useState<"mobile" | "desktop" | null>(null);
  // Two separate questions, either of which engages the touch layout — see the two constants'
  // own docs: is the *screen* a phone/tablet (the window's width), or is this particular chart's
  // box too narrow for a left-docked rail regardless of the screen (one panel of a wide split).
  // Both read as "not yet measured" at 0 rather than as "narrow".
  const viewportWidth = useViewportWidth();
  const isNarrowLayout =
    layoutOverride === null
      ? (viewportWidth > 0 && viewportWidth < MOBILE_LAYOUT_BREAKPOINT) || (rawDims.width > 0 && rawDims.width < NARROW_EMBED_BREAKPOINT)
      : layoutOverride === "mobile";
  const isMobileRail = drawingTools && isNarrowLayout;
  // Clamped, never widened — a caller that already asked for a narrower gutter than this keeps it.
  const narrowAxisRight = Math.min(rawDims.margin.right, PRICE_AXIS_WIDTH_MOBILE);
  // `null` (not `false`) until the wrapper has actually been measured — see usePaneLayout's own
  // `dockedPanesStartFolded` doc, which reads that as "decide nothing yet" rather than "this is a
  // desktop", so a pane present at width 0 isn't permanently written off as already handled.
  const dockedPanesStartFolded = rawDims.width > 0 ? isNarrowLayout : null;
  const resolvedMargin: ChartMargin = isMobileRail
    ? {
        ...rawDims.margin,
        left: rawDims.margin.left - TOOLS_RAIL_WIDTH,
        bottom: rawDims.margin.bottom + TOOLS_RAIL_HEIGHT_MOBILE,
        right: narrowAxisRight,
      }
    : isNarrowLayout
      ? { ...rawDims.margin, right: narrowAxisRight }
      : rawDims.margin;
  // Gated on `isNarrowLayout`, not `isMobileRail`: the price axis narrows on this layout whether or
  // not there are drawing tools, so a drawing-tools-less phone chart needs the recomputation too.
  const dims: ChartDimensions = isNarrowLayout
    ? {
        ...rawDims,
        boundedWidth: Math.max(0, rawDims.width - resolvedMargin.left - resolvedMargin.right),
        boundedHeight: Math.max(0, rawDims.height - resolvedMargin.top - resolvedMargin.bottom),
        margin: resolvedMargin,
      }
    : rawDims;

  const { scriptingState, scriptChartIndicators } = useChartScripting({ scripts, onScriptsChange });
  const showHeader = fullscreenToggle || zoomable || !!timeframes?.length || showIndicators;
  // `dims.height` is measured off `.lq-chart__plot-column`, already below `.lq-chart__main`'s own
  // header in the flex-column layout (see charts-shared.css's own doc on that element) — no more
  // `- HEADER_HEIGHT` subtraction needed here, the browser already did it via ordinary flex.
  const plotHeight = dims.height;
  const plotBoundedHeight = Math.max(0, plotHeight - dims.margin.top - dims.margin.bottom);

  const themeTick = useThemePaletteTick(ref);
  const defaultDrawingColor = useDefaultDrawingColor(ref, themeTick);

  const {
    showFloatingToolbar, showToolbarStyleControls,
    toolbarColor, toolbarTextColor, toolbarStrokeWidth, updateDrawingOrDefaultStyle,
    floatingToolbarPosition, floatingToolbarRef, startFloatingToolbarDrag, alertTarget,
  } = useFloatingToolbarState({
    activeTool,
    selectedDrawingId,
    drawings,
    commitDrawings,
    defaultDrawingStyle,
    setDefaultDrawingStyle,
    defaultDrawingColor,
    plotWidth: dims.boundedWidth,
  });
  const alertFlow = useAlertFlow(alerts ?? [], selectedDrawingId);
  const {
    indicators,
    indicatorPickerOpen,
    setIndicatorPickerOpen,
    indicatorSearchQuery,
    setIndicatorSearchQuery,
    infoKind,
    setInfoKind,
    editingIndicatorId,
    indicatorDraft,
    setIndicatorDraft,
    setHoveredIndicatorId,
    indicatorsManagerOpen,
    setIndicatorsManagerOpen,
    draggingPaneId,
    setDraggingPaneId,
    volumePaneOrder,
    volumePaneState,
    setVolumePaneState,
    paneHeightFractions,
    paneYTransform,
    handlePaneYAxisPointerDown,
    handlePaneYAxisPointerMove,
    handlePaneYAxisPointerUp,
    resetPaneYAxis,
    commitIndicators,
    loadIndicatorLayout,
    addIndicator, addCustomIndicator, appendIndicator,
    openIndicatorSettings, closeIndicatorSettings,
    saveIndicatorSettings,
    deleteEditingIndicator, toggleIndicatorHidden,
    removeIndicator,
    volumeVisible, volumeCollapsed,
    startPaneResize, reorderPanesRef,
    ownPaneIndicators,
    indicatorPaneHeights, indicatorPaneTops,
    volumeTop, allPanesOrder,
    volumeHeight, priceHeight,
    fullscreenPaneId, togglePaneFullscreen,
    leftPaneIndicators, leftPaneHeights, leftPaneTops, leftPaneStackOrder,
    rightPaneIndicators, rightPaneHeights, rightPaneTops, rightPaneStackOrder,
    toggleSidePaneCollapsed,
    extraIndicators: activeScriptIndicators,
  } = usePaneLayout({
    defaultIndicators,
    onIndicatorsChange,
    showVolume,
    plotBoundedHeight,
    extraIndicators: scriptChartIndicators,
    dockedPanesStartFolded,
  });
  const correlationSetup = useCorrelationSetup({ appendIndicator, onAddSymbolOverlay, onSymbolSearchChange });
  // `activeScriptIndicators`, not the raw `scriptChartIndicators` — script outputs the user has
  // deleted from the chart are already filtered out of it (see usePaneLayout's own
  // `dismissedScriptIndicators` doc), so the legend and the overlay list drop them too rather than
  // still listing a pane that is no longer drawn anywhere.
  const combinedIndicators = useMemo(() => [...indicators, ...activeScriptIndicators], [indicators, activeScriptIndicators]);
  // Render-only concat — script signals stay out of the *interactive* `visibleDrawings` every
  // pointer-handler in useDrawingInteractions below still reads (they're read-only in v1, no
  // select/drag/double-click-edit), only the canvas draw pass (ChartPlotOverlays) sees this one.
  const combinedVisibleDrawings = useMemo(() => [...visibleDrawings, ...scriptingState.scriptDrawings], [visibleDrawings, scriptingState.scriptDrawings]);

  const {
    templates,
    activeTemplateId,
    isDirty: templatesDirty,
    saveTemplate,
    saveTemplateAs,
    loadTemplate,
    deleteTemplate,
  } = useChartTemplates({
    defaultTemplates,
    onTemplatesChange,
    indicators,
    volumePaneOrder,
    volumePaneState,
    paneHeightFractions,
    loadIndicatorLayout,
  });

  // Called before useZoomAndScales specifically so `replayState.armed` exists in time to suspend
  // its own pan/zoom while a cutoff is being chosen — see useReplayState.ts's own doc on why
  // `zoomedXScale` itself can't be a hook argument here (the reverse dependency).
  const replayState = useReplayState({ dataLength: data.length });

  // Whether the touch placement flow (see useMobilePointPlacement below) currently owns the plot's
  // gestures. Computed up here, ahead of the two hooks that need to know: while a point is being
  // positioned, a finger dragged across the chart must move the *marker* and nothing else — panning
  // the view at the same time moves the very reference the point is being aimed against.
  const placementActive = isNarrowLayout && activeTool !== null && !replayState.armed;

  const {
    yTransform,
    setYTransform,
    setYManuallyAdjusted,
    xScale, zoomedXScale,
    indexForDate, dateForIndex,
    visibleRange,
    symbolOverlays,
    compareMode,
    overlayProjections,
    priceScale,
    zoomedPriceScale,
    clampToPriceAxis,
    zoomedVolumeScale,
    maxXZoom,
    zoomRef,
    resetX,
    setXTransformAnimated,
    xAxisDrag,
    yAxisDrag,
    xAxisWheelRef,
    yAxisWheelRef,
    isZoomed,
    resetZoom, setVisibleCandleCount,
    resetYAxis,
    candleWidth,
    dateTickValues,
  } = useZoomAndScales({
    data,
    dims,
    plotBoundedHeight,
    priceHeight,
    volumeHeight,
    paneYTransform,
    drawings,
    activeTool,
    replayArmed: replayState.armed,
    placementActive,
    hoveredDrawingIdRef, measureBodyHoveredRef,
    yAutoScalingState,
    zoomable,
    initialVisibleCandles,
    replayActive: replayState.active,
    replayCutoffIndex: replayState.cutoffIndex,
  });

  const { effectiveHoverIndex, effectiveHovered, effectiveHoverY } = useHoverSync({ data, hoverIndex, indexForDate, dateForIndex, syncedHoverDate, onHoverDateChange, hoverY, zoomedPriceScale, clampToPriceAxis, syncedHoverPrice, onHoverPriceChange });

  const barRangeState = useBarRangeSelection({ data, timeframe, setVisibleCandleCount });

  usePaneDragReorder({
    draggingPaneId,
    setDraggingPaneId,
    allPanesOrder,
    ownPaneIndicators,
    indicatorPaneTops,
    indicatorPaneHeights,
    volumeTop,
    volumeHeight,
    priceHeight,
    zoomRef,
    reorderPanesRef,
  });

  const { chartDisplayMode, setChartDisplayMode, displayModeOpen, setDisplayModeOpen, displayModeAnchorRef, visible, heikinAshiCandles, renkoBricks, lineBreakBricks } =
    useChartDisplayMode({ data, visibleRange, renkoAtrPeriod, defaultChartDisplayMode });
  const tpoOverlays = useTpoOverlay(data, visibleRange, indicators);

  const { hiddenEventKinds, setHiddenEventKinds, activeEventStack, setActiveEventStack, eventModalOpen, setEventModalOpen, eventKinds, eventStacks } =
    useChartEvents({ events, indexForDate, visibleRange, dataLength: data.length });

  // The bottom axis's own scale is index-based, so its auto tick generator would label raw
  // indices (0, 100, 200…) instead of dates — explicit tickValues (dateTickValues) plus this
  // index-to-date lookup, same fix BarChart/DeltaChart already use for their categorical axis.
  function dateTickFormat(v: number): string {
    const idx = Math.min(data.length - 1, Math.max(0, Math.round(v - 0.5)));
    return dFmt(data[idx].date);
  }

  const {
    indicatorValues,
    visibleIndicators,
    zoomedOwnPaneScales,
    paneScaleAndOffset,
    pixelYForDrawing,
    valueAxisLabel,
    resolveValueAxisAtY,
  } = useIndicatorPaneScales({
    data,
    fundamentals,
    indicators: combinedIndicators,
    ownPaneIndicators,
    indicatorPaneHeights,
    indicatorPaneTops,
    paneYTransform,
    visibleRange,
    zoomedPriceScale,
    zoomedVolumeScale,
    volumeVisible,
    volumeTop,
    volumeHeight,
    priceHeight,
  });

  // Everything for the two `<ChartSidePaneColumn>` siblings mounted further down — see that
  // hook's own doc for why this is one call instead of being inlined here (keeping this file
  // under its own line budget chief among the reasons).
  const { leftColumnProps, rightColumnProps } = useDockedPaneColumnsState({
    leftPaneIndicators,
    leftPaneHeights,
    leftPaneTops,
    leftPaneStackOrder,
    rightPaneIndicators,
    rightPaneHeights,
    rightPaneTops,
    rightPaneStackOrder,
    visibleIndicators,
    paneYTransform,
    zoomedXScale,
    zoomedPriceScale,
    candleWidth,
    boundedWidth: dims.boundedWidth,
    plotBoundedHeight,
    marginBottom: dims.margin.bottom,
    marginRight: dims.margin.right,
    themeTick,
    data,
    indicators: combinedIndicators,
    hoverIndex: effectiveHoverIndex,
    hovered: effectiveHovered,
    hoverY: effectiveHoverY,
    dateTickFormat,
    startPaneResize,
    indicatorLabel,
    openIndicatorSettings,
    removeIndicator,
    indicatorValues,
    onOpenIndicatorInfo: setInfoKind,
    onEditScript,
    toggleSidePaneCollapsed,
  });

  const { addPriceLine, addVolumeLine, addDateLine, addIndicatorPaneLine } = useAddLineHandlers({
    data,
    drawings,
    commitDrawings,
    drawingIdRef,
    hoverY,
    zoomedPriceScale,
    hoverVolumeY,
    zoomedVolumeScale,
    hovered,
    priceScale,
    hoverIndicatorPaneId,
    hoverIndicatorPaneY,
    paneScaleAndOffset,
  });

  const {
    handleOverlayClick,
    handleOverlayDoubleClick,
    handleEndpointPointerDown,
    handleEndpointPointerMove,
    handleEndpointPointerUp,
    handleMeasureHandlePointerDown,
    handleMeasureHandlePointerMove,
    handleMeasureHandlePointerUp,
    handleAxisHandlePointerDown,
    handleAxisHandlePointerMove,
    handleAxisHandlePointerUp,
    handlePointerMove,
    handleOverlayPointerDown,
    handleOverlayPointerUp,
  } = useDrawingInteractions({
    data,
    dims,
    plotBoundedHeight,
    priceHeight,
    volumeHeight,
    volumeTop,
    volumeVisible,
    volumeCollapsed,
    setHoverIndex,
    setHoverY,
    setHoverVolumeY,
    setHoverIndicatorPaneId,
    setHoverIndicatorPaneY,
    ownPaneIndicators,
    drawings,
    commitDrawings,
    drawingIdRef,
    defaultDrawingStyle,
    activeTool,
    setActiveTool,
    pendingPoint,
    setPendingPoint,
    setPreviewPoint,
    pendingSecondPoint,
    setPendingSecondPoint,
    pendingExtraPoints,
    setPendingExtraPoints,
    measurePoints, setMeasurePoints,
    drawingsLocked,
    visibleDrawings,
    setBrushPreview,
    brushPointsRef,
    brushDrawingRef,
    hoveredDrawingId,
    hoveredDrawingIdRef,
    updateHoveredDrawingId,
    setSelectedDrawingId,
    setEditingId,
    setDraft,
    setEditModalTab,
    dragEndpointRef,
    dragAxisRef,
    dragMeasureRef, dragMeasureBodyRef, measureBodyHoveredRef,
    dragLineRef,
    isPanningYRef,
    cancelDrawingTool,
    finalizeElbowArrow,
    magnetSnapPrice,
    zoomRef,
    zoomedXScale,
    zoomedPriceScale,
    indexForDate,
    dateForIndex,
    priceScale,
    resetZoom,
    yTransform,
    setYTransform,
    setYManuallyAdjusted,
    // Not the raw prop: this hook's own pointerdown starts a price-scale pan, gated on `zoomable`
    // alone, and that pan is the one that kept dragging the view out from under a point being
    // placed. Denying it here means it cannot start even if the overlay routing below ever changes.
    zoomable: zoomable && !placementActive,
    paneScaleAndOffset,
    pixelYForDrawing,
    resolveValueAxisAtY,
    overlayProjections,
    xScale,
    maxXZoom,
    setXTransformAnimated, setTextEntry, setEditingCell,
  });

  useRenderCandlestickChart({
    canvasRef,
    wrapperRef: ref,
    themeTick,
    dims,
    plotBoundedHeight,
    visible,
    zoomedXScale,
    zoomedPriceScale,
    candleWidth,
    chartDisplayMode,
    heikinAshiCandles,
    renkoBricks,
    lineBreakBricks, tpoOverlays,
    data,
    visibleRange,
    upColorOverride,
    downColorOverride,
    volumeUpColorOverride,
    volumeDownColorOverride,
    volumeVisible,
    volumeCollapsed,
    zoomedVolumeScale,
    volumeHeight,
    volumeTop,
    priceHeight,
    ownPaneIndicators,
    indicatorPaneHeights,
    indicatorPaneTops,
    zoomedOwnPaneScales,
    indicators: combinedIndicators,
    overlayProjections,
    symbolOverlays,
    hovered: effectiveHovered,
    hoverY: effectiveHoverY,
    hoverVolumeY,
    hoverIndicatorPaneId,
    hoverIndicatorPaneY,
    hoverIndex: effectiveHoverIndex,
    visibleDrawings: combinedVisibleDrawings,
    hoveredDrawingId,
    activeTool,
    pendingPoint,
    previewPoint,
    pendingSecondPoint,
    pendingExtraPoints,
    brushPreview,
    measurePoints,
    livePrice,
    visibleIndicators,
    indexForDate,
    futureZoneVisible,
    pastZoneVisible,
    replayArmed: replayState.armed,
    replayActive: replayState.active,
    replayPreviewIndex: replayState.previewIndex,
    replayCutoffIndex: replayState.cutoffIndex,
  });

  // NOT the same element in both return paths, and that matters: this early one measures
  // `.lq-chart__main` (the full width), the normal one below measures `.lq-chart__plot-column`
  // (whatever the docked pane columns leave over). useChartDimensions' own callback ref re-attaches
  // its ResizeObserver to whichever is mounted, so each branch measures correctly on its own — but
  // the *branch condition* is that measurement, so the two can hand off to each other indefinitely
  // if the plot column is ever allowed to reach zero width while the parent has some. It can't:
  // `.lq-chart__plot-column` carries a min-width for exactly this reason (see charts-shared.css).

  const mobilePlacement = useMobilePointPlacement({
    enabled: placementActive,
    plotRef: zoomRef,
    onCommit: (point) => handleOverlayClick(point as unknown as React.MouseEvent<SVGRectElement>),
    onPreview: (point) => handlePointerMove(point as unknown as React.PointerEvent<SVGRectElement>),
  });

  // A staged marker belongs to the tool that was active when it was dropped — switching tools, or
  // finishing/cancelling a drawing (both of which clear `activeTool`), must take it with them
  // rather than leave a dot floating over the next thing.
  useEffect(() => {
    mobilePlacement.clear();
    // Only the tool changing matters; `clear` is stable and the hook object is a fresh literal
    // every render, so depending on either would fire this on every commit and wipe the marker
    // the moment it was placed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

  if (dims.width === 0 || data.length === 0) {
    return (
      <div className={["lq-chart", isFullscreen && "lq-chart--fullscreen", className].filter(Boolean).join(" ")} style={{ width: isFullscreen ? undefined : width, height: isFullscreen ? undefined : height }}>
        <div ref={ref} className="lq-chart__main">
          {data.length === 0 && <div className="lq-chart__empty">Aucune donnée</div>}
        </div>
        {sidePanel && sidePanelState.open && (
          <ChartSidePanel panelRef={sidePanelState.panelRef} widthPx={sidePanelState.widthPx} startResize={sidePanelState.startResize}>
            {sidePanel}
          </ChartSidePanel>
        )}
      </div>
    );
  }

  const dFmt = formatDate ?? d3.timeFormat("%d %b %Y");
  const pFmt = formatPrice ?? ((v: number) => v.toFixed(2));
  const vFmt = formatVolume ?? ((v: number) => d3.format(".2s")(v));
  // Every price-axis-pinned badge reads through this instead of `pFmt` directly, so they always
  // agree with the axis right beside them (same compareMode check as its own tickFormat).
  const priceAxisFmt = (v: number) => (compareMode ? formatPercentFromReference(v, overlayProjections[0]?.mainReference ?? v) : pFmt(v));
  const currentTimeframeLabel = findTimeframeLabel(timeframes, timeframe);
  const currentModeEntry = CHART_DISPLAY_MODES.find((m) => m.mode === chartDisplayMode) ?? CHART_DISPLAY_MODES[0];
  // The top-left legend's own indicators — price overlays only, `ownPaneIndicators` (RSI/CHOP/
  // MACD) already have their own pane header and don't belong here too.
  const overlayIndicators = combinedIndicators.filter((ind) => indicatorCatalogEntry(ind).pane === "price");

  const { candle: ohlcCandle, delta: ohlcDelta, deltaPct: ohlcDeltaPct, sign: ohlcSign } = computeOhlcReadout(data, effectiveHoverIndex);

  // Touch placement for every drawing tool (see the hook's own doc). Only ever engaged on the
  // narrow layout and only with a tool selected — a chart being read keeps its ordinary pan,
  // zoom and hover. `handleOverlayClick`/`handlePointerMove` are handed the staged position as a
  // synthetic `{clientX, clientY}`, which is all their placement path ever reads from an event,
  // so no tool needs to know this exists.
  // Mounted in one of two places depending on the layout, hence the variable — the JSX itself is
  // identical either way. Vertical: inside `.lq-chart__plot-column`, whose box is exactly what its
  // `left: 0 / top: 0 / height: plotHeight` are meant to resolve against. Horizontal: one level up,
  // as a child of `.lq-chart__main`, so `width: 100%` covers the *whole* chart rather than only the
  // plot column — a `plot.pane(..., { dock })` column is a flex sibling of that column, and the
  // rail was stopping dead at its edge instead of running under it. It stays absolutely positioned
  // and so takes no flow space either way, which is what lets the bottom-margin reservation
  // (TOOLS_RAIL_HEIGHT_MOBILE, see resolvedMargin) keep working untouched — and that same
  // reservation is already made by the docked column too, through its own `marginBottom`, so there
  // is real empty space under it for the rail to run through.
  const toolsRail = (
    <ToolsRail
      drawingTools={drawingTools}
      dims={dims}
      plotHeight={plotHeight}
      horizontal={isMobileRail}
      selectedToolByCategory={selectedToolByCategory}
      openToolMenu={openToolMenu}
      setOpenToolMenu={setOpenToolMenu}
      activeTool={activeTool}
      handleToolClick={handleToolClick}
      handleSelectToolType={handleSelectToolType}
      menuAnchorRefFor={menuAnchorRefFor}
      magnetActive={magnetActive}
      setMagnetActive={setMagnetActive}
      drawingsHidden={drawingsHidden}
      setDrawingsHidden={setDrawingsHidden}
      drawingsLocked={drawingsLocked}
      setDrawingsLocked={setDrawingsLocked}
      zoomable={zoomable}
      isZoomed={isZoomed}
      resetZoom={resetZoom}
      eventKinds={eventKinds}
      hiddenEventKinds={hiddenEventKinds}
      setHiddenEventKinds={setHiddenEventKinds}
      indicatorsManagerOpen={indicatorsManagerOpen}
      setIndicatorsManagerOpen={setIndicatorsManagerOpen}
      onOpenToolInfo={setInfoTool}
    />
  );

  return (
    <div
      className={["lq-chart", isFullscreen && "lq-chart--fullscreen", placementActive && "lq-chart--placing", className].filter(Boolean).join(" ")}
      style={{ width: isFullscreen ? undefined : width }}
    >
      <div className="lq-chart__main">
      {showHeader && !seasonalityOpen && (
        <ChartHeader
          timeframes={timeframes}
          timeframe={timeframe}
          onTimeframeChange={onTimeframeChange}
          tfOpen={tfOpen}
          setTfOpen={setTfOpen}
          tfAnchorRef={tfAnchorRef}
          currentTimeframeLabel={currentTimeframeLabel}
          {...barRangeState}
          displayModeAnchorRef={displayModeAnchorRef}
          displayModeOpen={displayModeOpen}
          setDisplayModeOpen={setDisplayModeOpen}
          currentModeEntry={currentModeEntry}
          chartDisplayMode={chartDisplayMode}
          setChartDisplayMode={setChartDisplayMode}
          onChartDisplayModeChange={onChartDisplayModeChange}
          showIndicators={showIndicators}
          setIndicatorSearchQuery={setIndicatorSearchQuery}
          setIndicatorPickerOpen={setIndicatorPickerOpen}
          seasonality={seasonality}
          setSeasonalityOpen={setSeasonalityOpen}
          replay={replay}
          replayArmed={replayState.armed}
          replayActive={replayState.active}
          replayPlaying={replayState.playing}
          replaySpeed={replayState.speed}
          replaySpeedOpen={replayState.speedOpen}
          setReplaySpeedOpen={replayState.setSpeedOpen}
          replaySpeedAnchorRef={replayState.speedAnchorRef}
          onReplayTriggerClick={replayState.toggleArm}
          onReplayTogglePlay={replayState.togglePlay}
          onReplaySpeedChange={replayState.setSpeed}
          onReplayQuit={replayState.quit}
          replayDateValue={toDayInputValue(replayState.cutoffIndex !== null ? data[replayState.cutoffIndex]?.date : undefined)}
          replayDateMin={toDayInputValue(data[0]?.date)}
          replayDateMax={toDayInputValue(data[data.length - 1]?.date)}
          onReplayDateChange={(value) => {
            // An empty value is the picker being cleared, not a date — leave the cutoff alone
            // rather than jumping to one end of the history.
            if (!value) return;
            const index = candleIndexForDay(data, value);
            if (index !== null) replayState.setCutoffIndex(index);
          }}
          fullscreenToggle={fullscreenToggle}
          toggleFullscreen={toggleFullscreen}
          isFullscreen={isFullscreen}
          sidePanel={!!sidePanel}
          sidePanelOpen={sidePanelState.open}
          onToggleSidePanel={() => sidePanelState.commitOpen(!sidePanelState.open)}
          showTemplates={showTemplates}
          templates={templates}
          activeTemplateId={activeTemplateId}
          templatesDirty={templatesDirty}
          onSaveTemplate={saveTemplate}
          onSaveTemplateAs={saveTemplateAs}
          onLoadTemplate={loadTemplate}
          onDeleteTemplate={deleteTemplate}
          linkable={linkable}
          isLinked={isLinked}
          onLinkClick={onLinkClick}
        />
      )}

      {/* A `plot.pane(name, { dock: "left"|"right" })` script pane's own column, alongside the
          plot itself — a flex row nested *inside* `.lq-chart__main` (below its own header) rather
          than a sibling of `.lq-chart__main` in the outer `.lq-chart` row, so `.lq-chart__header`
          (above) naturally spans this row's own full width instead of stopping short at the
          plot's own edge — a docked column used to sit *outside* that header entirely, needing a
          separate decorative strip to visually fill the gap; nesting it here needs none. `ref`
          (useChartDimensions) now lives on `.lq-chart__plot-column`, not this row itself —
          flexbox hands that inner wrapper whatever width the docked column(s) don't take, so the
          plot genuinely shrinks with zero changes to any downstream axis/margin math (see
          ChartSidePaneColumn's own doc). */}
      <div className="lq-chart__main-row">
      {leftColumnProps && <ChartSidePaneColumn {...leftColumnProps} />}
      <div ref={ref} className="lq-chart__plot-column">
      {seasonalityOpen ? (
        <SeasonalityView data={data} symbol={symbol} onBack={() => setSeasonalityOpen(false)} showHeader={showHeader} height={plotHeight} mobile={isNarrowLayout} />
      ) : (
      <div
        className="lq-chart__plot"
        style={{ width: dims.width, height: plotHeight }}
        onPointerLeave={(e) => {
          // Touch "leave" fires the instant a finger lifts — pin instead of clear (mouse still
          // clears normally) so the "+"/pane-action badges survive for a follow-up tap; the
          // next tap elsewhere already recomputes this via handlePointerMove.
          if (e.pointerType === "touch") return;
          setHoverIndex(null);
          setHoverY(null);
          setHoverVolumeY(null);
          setHoverIndicatorPaneId(null);
          setHoverIndicatorPaneY(null);
        }}
      >
        {/* Positioned relative to .lq-chart__plot (not .lq-chart__main), same reason the canvas
            is: only .lq-chart__plot's own box lines up with where the svg/canvas content starts.
            Explicitly sized (not left to intrinsic sizing from its svg child) so it never drifts
            from `dims` regardless of how the fullscreen flex container's own centering behaves. */}
        {/* Width is the *entire* reserved left margin (not just TOOLS_RAIL_WIDTH) so its right
            border lands exactly where the plot content starts, not a bare-constant-sized gap
            short of it. Height spans the full plot down to the chart's own bottom border. (In
            horizontal/mobile mode the rail takes TOOLS_RAIL_HEIGHT_MOBILE and a plain CSS
            `width: 100%` of this column instead of any measured figure — see isMobileRail above
            and `.lq-chart__tools-rail--horizontal`'s own rule.) */}
        {!isMobileRail && toolsRail}
        {/* Fixed to the plot's own top-left corner regardless of priceHeight — without this gate
            it would still render, and overlap, once a pane's own maximize button zeroes it out. */}
        {priceHeight > 0 && (
          <ChartLegend
            dims={dims}
            symbol={symbol}
            symbolSearch={symbolSearch}
            setSymbolSearchOpen={setSymbolSearchOpen}
            setSettingsOpen={setSettingsOpen}
            currentModeEntry={currentModeEntry}
            ohlcCandle={ohlcCandle}
            ohlcDelta={ohlcDelta}
            ohlcDeltaPct={ohlcDeltaPct}
            ohlcSign={ohlcSign}
            mobile={isNarrowLayout}
            pFmt={pFmt}
            showIndicators={showIndicators}
            overlayIndicators={overlayIndicators}
            indicators={combinedIndicators}
            defaultIndicatorColor={defaultIndicatorColor}
            openIndicatorSettings={openIndicatorSettings}
            setHoveredIndicatorId={setHoveredIndicatorId}
            indicatorLabel={indicatorLabel}
            toggleIndicatorHidden={toggleIndicatorHidden}
            removeIndicator={removeIndicator}
            alertedIndicatorIds={alertFlow.alertedIndicatorIds} onOpenIndicatorAlert={(ind) => alertFlow.openForIndicator(ind.id, indicatorLabel(ind))}
            symbolOverlays={symbolOverlays}
            drawings={drawings}
            commitDrawings={commitDrawings}
            drawingLabel={drawingLabel}
            setHoveredDrawingId={setHoveredDrawingId}
            setEditingId={setEditingId}
            setDraft={setDraft}
            setEditModalTab={setEditModalTab}
            removeSymbolOverlay={removeSymbolOverlay} onOpenIndicatorInfo={setInfoKind}
          />
        )}
        {priceHeight > 0 && scriptingState.scriptTables.length > 0 && <ScriptTableOverlay tables={scriptingState.scriptTables} />}
        {priceHeight > 0 && scriptingState.scriptLabels.length > 0 && (
          <ScriptLabelOverlay
            labels={scriptingState.scriptLabels}
            dims={dims}
            priceHeight={priceHeight}
            ownPaneIndicators={ownPaneIndicators}
            indicatorPaneTops={indicatorPaneTops}
            indicatorPaneHeights={indicatorPaneHeights}
            zoomedXScale={zoomedXScale}
            zoomedPriceScale={zoomedPriceScale}
            zoomedOwnPaneScales={zoomedOwnPaneScales}
          />
        )}
        <PaneHeaders
          volumeVisible={volumeVisible}
          dims={dims}
          priceHeight={priceHeight}
          volumeTop={volumeTop}
          volumeCollapsed={volumeCollapsed}
          draggingPaneId={draggingPaneId}
          setDraggingPaneId={setDraggingPaneId}
          startPaneResize={startPaneResize}
          SUB_PANE_COLLAPSED_HEIGHT={SUB_PANE_COLLAPSED_HEIGHT}
          hoverVolumeY={hoverVolumeY}
          setVolumePaneState={setVolumePaneState}
          setVolumeSettingsOpen={setVolumeSettingsOpen}
          data={data}
          hoverIndex={effectiveHoverIndex}
          vFmt={vFmt}
          ownPaneIndicators={ownPaneIndicators}
          indicatorPaneTops={indicatorPaneTops}
          commitIndicators={commitIndicators}
          indicators={indicators}
          indicatorLabel={indicatorLabel}
          openIndicatorSettings={openIndicatorSettings}
          removeIndicator={removeIndicator}
          indicatorValues={indicatorValues} onOpenIndicatorInfo={setInfoKind}
          fullscreenPaneId={fullscreenPaneId}
          onTogglePaneFullscreen={togglePaneFullscreen}
          onEditScript={onEditScript}
        />
        <ChartPlotOverlays
          canvasRef={canvasRef}
          dims={dims}
          plotBoundedHeight={plotBoundedHeight}
          plotHeight={plotHeight}
          clipId={clipId}
          zoomedPriceScale={zoomedPriceScale}
          priceAxisFmt={priceAxisFmt}
          volumeVisible={volumeVisible}
          volumeCollapsed={volumeCollapsed}
          priceHeight={priceHeight}
          volumeTop={volumeTop}
          zoomedVolumeScale={zoomedVolumeScale}
          vFmt={vFmt}
          handlePaneYAxisPointerDown={handlePaneYAxisPointerDown}
          handlePaneYAxisPointerMove={handlePaneYAxisPointerMove}
          handlePaneYAxisPointerUp={handlePaneYAxisPointerUp}
          resetPaneYAxis={resetPaneYAxis}
          volumeHeight={volumeHeight}
          ownPaneIndicators={ownPaneIndicators}
          indicatorPaneTops={indicatorPaneTops}
          indicatorPaneHeights={indicatorPaneHeights}
          zoomedOwnPaneScales={zoomedOwnPaneScales}
          zoomedXScale={zoomedXScale}
          dateTickValues={dateTickValues}
          dateTickFormat={dateTickFormat}
          zoomRef={zoomRef}
          activeTool={activeTool}
          /* Armed replay owns the plot's pointer gestures outright. Move and click below are
              swapped for its own; these two are stubbed instead, because it has nothing to do on
              them — but leaving the drawing-interaction pair in place is precisely what let a drag
              still pan the price scale while choosing a cutoff (see useDrawingInteractions' own
              isPanningYRef, gated on `zoomable` alone). The view then shifted out from under the
              very preview line being aimed with — the same thing `replayArmed` already stops
              d3-zoom's own X drag from doing (see useZoomAndScales' own filter). */
          /* Three-way routing, most specific first. Armed replay owns the plot outright; then
             touch placement, which turns the raw gestures into "stage a marker, nudge it, confirm
             it" and only replays a click once the position is settled; then the ordinary desktop
             handlers. Click is deliberately NOT routed to the placement layer — it replays through
             `handleOverlayClick` itself, so a committed point takes exactly the path a mouse click
             would. */
          placementMarker={mobilePlacement.marker}
          handleOverlayPointerDown={
            replayState.armed ? noopPointerHandler : placementActive ? mobilePlacement.onPointerDown : handleOverlayPointerDown
          }
          handlePointerMove={
            replayState.armed
              ? replayState.handlePointerMove(zoomedXScale)
              : placementActive
                ? noopPointerHandler
                : handlePointerMove
          }
          handleOverlayPointerUp={replayState.armed || placementActive ? noopPointerHandler : handleOverlayPointerUp}
          handleOverlayClick={replayState.armed ? replayState.handleClick(zoomedXScale) : placementActive ? noopPointerHandler : handleOverlayClick}
          /* Routed away like the other three while placing. The tap-to-stage / tap-to-confirm
              rhythm lands inside the browser's own double-tap window, so dblclick fires on every
              placement. For every tool but one that is harmless (the handler returns early while a
              tool is active) — but elbowArrow finalizes and clears the tool, which nulls activeTool
              and wipes the staged marker mid-placement. */
          handleOverlayDoubleClick={placementActive ? noopPointerHandler : handleOverlayDoubleClick}
          yAxisWheelRef={yAxisWheelRef}
          yAxisDrag={yAxisDrag}
          resetYAxis={resetYAxis}
          xAxisWheelRef={xAxisWheelRef}
          xAxisDrag={xAxisDrag}
          resetX={resetX}
          visibleDrawings={visibleDrawings}
          hoveredDrawingId={hoveredDrawingId}
          indexForDate={indexForDate}
          pixelYForDrawing={pixelYForDrawing}
          handleAxisHandlePointerDown={handleAxisHandlePointerDown}
          handleAxisHandlePointerMove={handleAxisHandlePointerMove}
          handleAxisHandlePointerUp={handleAxisHandlePointerUp}
          handleEndpointPointerDown={handleEndpointPointerDown}
          handleEndpointPointerMove={handleEndpointPointerMove}
          handleEndpointPointerUp={handleEndpointPointerUp}
          measurePoints={measurePoints}
          handleMeasureHandlePointerDown={handleMeasureHandlePointerDown}
          handleMeasureHandlePointerMove={handleMeasureHandlePointerMove}
          handleMeasureHandlePointerUp={handleMeasureHandlePointerUp}
          eventStacks={eventStacks}
          dFmt={dFmt}
          setEventModalOpen={setEventModalOpen}
          setActiveEventStack={setActiveEventStack}
          textEntry={{ entry: textEntry, setEntry: setTextEntry, onCommit: commitTextEntry, onCancel: cancelTextEntry }}
          editingCell={{ entry: editingCell, setEntry: setEditingCell, onCommit: commitCellEntry, onCancel: cancelCellEntry }}
          hoverY={effectiveHoverY}
          addPriceLine={addPriceLine}
          hoverVolumeY={hoverVolumeY}
          addVolumeLine={addVolumeLine}
          hoverIndicatorPaneId={hoverIndicatorPaneId}
          hoverIndicatorPaneY={hoverIndicatorPaneY}
          addIndicatorPaneLine={addIndicatorPaneLine}
          paneScaleAndOffset={paneScaleAndOffset}
          hovered={effectiveHovered}
          hoverIndex={effectiveHoverIndex}
          addDateLine={addDateLine}
          livePrice={livePrice}
          data={data}
          clampToPriceAxis={clampToPriceAxis}
          now={now}
          showIndicators={showIndicators}
          indicatorValues={indicatorValues}
          activeEventStack={activeEventStack}
          eventModalOpen={eventModalOpen}
        />
        {showFloatingToolbar && (
          <FloatingDrawingToolbar
            position={floatingToolbarPosition}
            toolbarRef={floatingToolbarRef}
            startDrag={startFloatingToolbarDrag}
            showStyleControls={showToolbarStyleControls}
            color={toolbarColor}
            textColor={toolbarTextColor}
            strokeWidth={toolbarStrokeWidth}
            onColorChange={(color) => updateDrawingOrDefaultStyle({ color })}
            onTextColorChange={(textColor) => updateDrawingOrDefaultStyle({ textColor })}
            onStrokeWidthChange={(strokeWidth) => updateDrawingOrDefaultStyle({ strokeWidth })}
            onOpenAlert={() => alertFlow.openFor(alertTarget)} hasAlert={alertFlow.selectedDrawingHasAlert}
            // Only with a drawing actually selected — the toolbar also shows for an armed tool
            // with nothing drawn yet, where there is nothing to delete. Same commit path the
            // Delete key takes (see useDrawingState), and the selection is cleared with it so the
            // toolbar doesn't linger over a drawing that no longer exists.
            onDelete={
              selectedDrawingId !== null
                ? () => {
                    commitDrawings(drawings.filter((d) => d.id !== selectedDrawingId));
                    setSelectedDrawingId(null);
                  }
                : undefined
            }
          />
        )}
      </div>
      )}
      </div>
      {rightColumnProps && <ChartSidePaneColumn {...rightColumnProps} />}
      </div>
      {isMobileRail && !seasonalityOpen && toolsRail}

      {/* Own positioned ancestor is .lq-chart__main (sits outside .lq-chart__plot, which would
          otherwise confine it to the plot area alone) — "fills the whole chart" means
          header+plot together, same footprint as the native fullscreen overlay; not the side
          panel too, which isn't part of what this event happened on. Closing it also clears
          activeEventStack so the popover doesn't reappear once the replacing modal is dismissed. */}
      {eventModalOpen && activeEventStack && (
        <ChartEventTooltip
          events={activeEventStack.events}
          mode="modal"
          formatDate={dFmt}
          onClose={() => {
            setEventModalOpen(false);
            setActiveEventStack(null);
          }}
        />
      )}

      <ScriptRunnerHost
        scripts={scriptingState.scripts} data={data} indicators={indicators} fundamentals={fundamentals}
        // Replay's own cutoff, so a script replays with the chart instead of always computing over
        // the whole history. The replay mask (drawReplayMask.ts) only *hides* what sits past the
        // cutoff on the main plot's canvas — enough for a series laid out along time, but not for
        // output whose shape is derived from the bars themselves (a profile), nor for a docked
        // column, which paints on a canvas of its own that the mask never covers.
        runUpToIndex={replayState.active ? replayState.cutoffIndex : null}
        lastCandleOpen={lastCandleOpen} availableTimeframes={flattenTimeframeValues(timeframes)}
        onOutput={(id, output) => {
          scriptingState.reportRunOutput(id, output);
          onScriptRunOutput?.(id, output);
        }}
        onAlert={onScriptAlert}
      />

      <ChartModals
        {...correlationSetup}
        draft={draft}
        setDraft={setDraft}
        editModalTab={editModalTab}
        setEditModalTab={setEditModalTab}
        closeEditModal={closeEditModal}
        saveEditModal={saveEditModal}
        deleteEditingDrawing={deleteEditingDrawing}
        duplicateEditingDrawing={duplicateEditingDrawing}
        valueAxisLabel={valueAxisLabel}
        defaultColor={defaultDrawingColor}
        indicatorPickerOpen={indicatorPickerOpen} setIndicatorPickerOpen={setIndicatorPickerOpen}
        infoKind={infoKind} setInfoKind={setInfoKind}
        infoTool={infoTool} setInfoTool={setInfoTool}
        indicatorSearchQuery={indicatorSearchQuery} setIndicatorSearchQuery={setIndicatorSearchQuery}
        showVolume={showVolume}
        setVolumePaneState={setVolumePaneState}
        addIndicator={addIndicator}
        customIndicators={customIndicators} addCustomIndicator={addCustomIndicator}
        scripts={scriptingState.scripts} toggleScriptEnabled={scriptingState.toggleScriptEnabled}
        onEditScript={onEditScript} onCreateScript={onCreateScript} onDeleteScript={onDeleteScript}
        setScriptParamValue={scriptingState.setScriptParamValue}
        indicatorsManagerOpen={indicatorsManagerOpen}
        setIndicatorsManagerOpen={setIndicatorsManagerOpen}
        indicators={indicators} commitIndicators={commitIndicators}
        ownPaneIndicators={ownPaneIndicators}
        volumeVisible={volumeVisible}
        visibleDrawings={visibleDrawings}
        setEditingId={setEditingId}
        commitDrawings={commitDrawings}
        drawings={drawings}
        openIndicatorSettings={openIndicatorSettings}
        removeIndicator={removeIndicator}
        editingIndicatorId={editingIndicatorId}
        indicatorDraft={indicatorDraft}
        setIndicatorDraft={setIndicatorDraft}
        closeIndicatorSettings={closeIndicatorSettings}
        deleteEditingIndicator={deleteEditingIndicator}
        saveIndicatorSettings={saveIndicatorSettings}
        settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen}
        mobileLayout={isNarrowLayout} layoutOverride={layoutOverride} setLayoutOverride={setLayoutOverride}
        chartDisplayMode={chartDisplayMode} setChartDisplayMode={setChartDisplayMode} onChartDisplayModeChange={onChartDisplayModeChange}
        upColorOverride={upColorOverride} setUpColorOverride={setUpColorOverride}
        downColorOverride={downColorOverride}
        setDownColorOverride={setDownColorOverride}
        yAutoScalingState={yAutoScalingState}
        setYAutoScalingState={setYAutoScalingState}
        onYAutoScalingChange={onYAutoScalingChange}
        futureZoneVisible={futureZoneVisible} setFutureZoneVisible={setFutureZoneVisible}
        pastZoneVisible={pastZoneVisible} setPastZoneVisible={setPastZoneVisible}
        eventKinds={eventKinds}
        hiddenEventKinds={hiddenEventKinds}
        setHiddenEventKinds={setHiddenEventKinds}
        volumeSettingsOpen={volumeSettingsOpen}
        setVolumeSettingsOpen={setVolumeSettingsOpen}
        volumeUpColorOverride={volumeUpColorOverride}
        setVolumeUpColorOverride={setVolumeUpColorOverride}
        volumeDownColorOverride={volumeDownColorOverride}
        setVolumeDownColorOverride={setVolumeDownColorOverride}
        symbolSearchOpen={symbolSearchOpen}
        setSymbolSearchOpen={setSymbolSearchOpen}
        symbolSearchQuery={symbolSearchQuery}
        setSymbolSearchQuery={setSymbolSearchQuery}
        symbolSearchCategory={symbolSearchCategory}
        setSymbolSearchCategory={setSymbolSearchCategory}
        symbolSearchResults={symbolSearchResults}
        favoriteSymbolIds={favoriteSymbolIds}
        toggleFavoriteSymbol={toggleFavoriteSymbol}
        onSymbolSelect={onSymbolSelect}
        onAddSymbolOverlay={onAddSymbolOverlay}
        symbolOverlays={symbolOverlays}
        addingOverlaySymbols={addingOverlaySymbols}
        handleAddSymbolOverlay={handleAddSymbolOverlay}
        removeSymbolOverlay={removeSymbolOverlay}
        symbol={symbol} timeframe={timeframe}
        {...alertFlow.modalProps}
        overlayIndicators={overlayIndicators} indicatorLabel={indicatorLabel}
        soundOptions={alertSoundOptions} onCreate={onCreateAlert} onPlaySound={onPlaySound} onSave={onUpdateAlert} onDeleteAlert={onDeleteAlert}
      />
      </div>

      {sidePanel && sidePanelState.open && (
        <ChartSidePanel panelRef={sidePanelState.panelRef} widthPx={sidePanelState.widthPx} startResize={sidePanelState.startResize}>
          {sidePanel}
        </ChartSidePanel>
      )}
    </div>
  );
}
