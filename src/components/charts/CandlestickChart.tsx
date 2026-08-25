import { useId, useRef, useState } from "react";
import * as d3 from "d3";
import { useChartDimensions } from "./internal/useChartDimensions";
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
import { useDrawingState } from "./candlestick/hooks/useDrawingState";
import { useDrawingInteractions } from "./candlestick/hooks/useDrawingInteractions";
import { useDrawingToolMenuAnchors } from "./candlestick/hooks/useDrawingToolMenuAnchors";
import { useFloatingToolbarState } from "./candlestick/hooks/useFloatingToolbarState";
import { useAlertFlow } from "./candlestick/hooks/useAlertFlow";
import { useCorrelationSetup } from "./candlestick/hooks/useCorrelationSetup";
import { useRenderCandlestickChart } from "./candlestick/hooks/useRenderCandlestickChart";
import { useSidePanel } from "./candlestick/hooks/useSidePanel";
import { ChartHeader } from "./candlestick/components/ChartHeader";
import { ChartSidePanel } from "./candlestick/components/ChartSidePanel";
import { ToolsRail } from "./candlestick/components/ToolsRail";
import { ChartLegend } from "./candlestick/components/ChartLegend";
import { PaneHeaders } from "./candlestick/components/PaneHeaders";
import { ChartCanvasOverlay } from "./candlestick/components/ChartCanvasOverlay";
import { ChartHoverBadges } from "./candlestick/components/ChartHoverBadges";
import { FloatingDrawingToolbar } from "./candlestick/components/FloatingDrawingToolbar";
import { ChartModals } from "./candlestick/components/ChartModals";
import { ChartEventTooltip } from "./EventTooltip";
import { SeasonalityView } from "./SeasonalityView";
import "./charts-shared.css";

import type { Candle } from "./candlestick/interfaces/Candle.interface";
import type { ChartEvent } from "./candlestick/interfaces/ChartEvent.interface";
import type { FundamentalDataPoint } from "./candlestick/interfaces/FundamentalDataPoint.interface";
import type { SymbolSearchCategory } from "./candlestick/interfaces/SymbolSearchCategory.interface";
import type { SymbolSearchResult } from "./candlestick/interfaces/SymbolSearchResult.interface";
import type { TrendLineDrawing, OverlayDataPoint } from "./candlestick/interfaces/TrendLineDrawing.interface";
import type { IndicatorKind } from "./candlestick/interfaces/IndicatorKind.interface";
import type { IndicatorBand } from "./candlestick/interfaces/IndicatorBand.interface";
import type { IndicatorMACD } from "./candlestick/interfaces/IndicatorMACD.interface";
import type { Indicator } from "./candlestick/interfaces/Indicator.interface";
import type { CustomIndicatorDef } from "./candlestick/interfaces/CustomIndicatorDef.interface";
import type { ChartTemplate } from "./candlestick/interfaces/ChartTemplate.interface";
import type { ChartDisplayMode } from "./candlestick/interfaces/ChartDisplayMode.interface";
import type { TimeframeOption } from "./candlestick/interfaces/TimeframeOption.interface";
import type { TimeframeGroup } from "./candlestick/interfaces/TimeframeGroup.interface";
import type { TimeframeEntry } from "./candlestick/interfaces/TimeframeEntry.interface";
import type { CandlestickChartProps } from "./candlestick/interfaces/CandlestickChartProps.interface";
import type { ChartAlert, ChartAlertDraft, ChartAlertCrossing } from "./candlestick/interfaces/ChartAlertDraft.interface";

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
};

import { drawingLabel } from "./candlestick/drawingCatalog";
import { indicatorCatalogEntry, indicatorLabel, defaultIndicatorColor } from "./candlestick/indicatorCatalog";
import { CHART_DISPLAY_MODES } from "./candlestick/chartModes";
import { findTimeframeLabel } from "./candlestick/timeframes";
import {
  DEFAULT_MARGIN,
  TOOLS_RAIL_WIDTH,
  HEADER_HEIGHT,
  SUB_PANE_COLLAPSED_HEIGHT,
} from "./candlestick/constants";
import { formatPercentFromReference, computeOhlcReadout } from "./candlestick/formatting";

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
  const resolvedMargin = drawingTools
    ? { ...baseMargin, left: (baseMargin.left ?? DEFAULT_MARGIN.left ?? 0) + TOOLS_RAIL_WIDTH }
    : baseMargin;
  const [ref, dims] = useChartDimensions(resolvedMargin, {
    width: isFullscreen ? undefined : width,
    height: isFullscreen || fillHeight ? undefined : height,
  });

  const showHeader = fullscreenToggle || zoomable || !!timeframes?.length || showIndicators;
  const headerSpace = showHeader ? HEADER_HEIGHT : 0;
  const plotHeight = Math.max(0, dims.height - headerSpace);
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
  const [infoKind, setInfoKind] = useState<IndicatorKind | "volume" | null>(null);
  const {
    indicators,
    indicatorPickerOpen,
    setIndicatorPickerOpen,
    indicatorSearchQuery,
    setIndicatorSearchQuery,
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
  } = usePaneLayout({ defaultIndicators, onIndicatorsChange, showVolume, plotBoundedHeight });
  const correlationSetup = useCorrelationSetup({ appendIndicator, onAddSymbolOverlay, onSymbolSearchChange });

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
    hoveredDrawingIdRef, measureBodyHoveredRef,
    yAutoScalingState,
    zoomable,
    initialVisibleCandles,
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
    indicators,
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
    zoomable,
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
    indicators,
    overlayProjections,
    symbolOverlays,
    hovered: effectiveHovered,
    hoverY: effectiveHoverY,
    hoverVolumeY,
    hoverIndicatorPaneId,
    hoverIndicatorPaneY,
    hoverIndex: effectiveHoverIndex,
    visibleDrawings,
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
  });

  // `ref` always lands on .lq-chart__main (never the outer .lq-chart directly) in every return
  // path here — useChartDimensions' own ResizeObserver effect doesn't re-run on a ref retarget
  // (its deps are just options.width/height/aspectRatio), so it'd silently keep watching whatever
  // stale element it first attached to if this ever moved between branches on the same mount.
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
  const overlayIndicators = indicators.filter((ind) => indicatorCatalogEntry(ind).pane === "price");

  const { candle: ohlcCandle, delta: ohlcDelta, deltaPct: ohlcDeltaPct, sign: ohlcSign } = computeOhlcReadout(data, effectiveHoverIndex);

  return (
    <div className={["lq-chart", isFullscreen && "lq-chart--fullscreen", className].filter(Boolean).join(" ")} style={{ width: isFullscreen ? undefined : width }}>
      {/* `ref` (useChartDimensions) lives here, not on the outer .lq-chart — flexbox (outer div
          is a row, this + ChartSidePanel its children) hands this whatever width the panel
          doesn't take, so the plot genuinely shrinks with zero changes to any downstream
          axis/margin math (see ChartSidePanel.tsx's own doc). */}
      <div ref={ref} className="lq-chart__main">
      {showHeader && !seasonalityOpen && (
        <ChartHeader
          dims={dims}
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

      {seasonalityOpen ? (
        <SeasonalityView data={data} symbol={symbol} onBack={() => setSeasonalityOpen(false)} showHeader={showHeader} height={plotHeight} />
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
            short of it. Height spans the full plot down to the chart's own bottom border. */}
        <ToolsRail
          drawingTools={drawingTools}
          dims={dims}
          plotHeight={plotHeight}
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
        />
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
          pFmt={pFmt}
          showIndicators={showIndicators}
          overlayIndicators={overlayIndicators}
          indicators={indicators}
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
        />
        <ChartCanvasOverlay
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
          handleOverlayPointerDown={handleOverlayPointerDown}
          handlePointerMove={handlePointerMove}
          handleOverlayPointerUp={handleOverlayPointerUp}
          handleOverlayClick={handleOverlayClick}
          handleOverlayDoubleClick={handleOverlayDoubleClick}
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
        />
        <ChartHoverBadges
          hoverY={effectiveHoverY}
          dims={dims}
          addPriceLine={addPriceLine}
          zoomedPriceScale={zoomedPriceScale}
          priceAxisFmt={priceAxisFmt}
          hoverVolumeY={hoverVolumeY}
          priceHeight={priceHeight}
          volumeTop={volumeTop}
          addVolumeLine={addVolumeLine}
          zoomedVolumeScale={zoomedVolumeScale}
          vFmt={vFmt}
          hoverIndicatorPaneId={hoverIndicatorPaneId}
          hoverIndicatorPaneY={hoverIndicatorPaneY}
          addIndicatorPaneLine={addIndicatorPaneLine}
          paneScaleAndOffset={paneScaleAndOffset}
          hovered={effectiveHovered}
          zoomedXScale={zoomedXScale}
          hoverIndex={effectiveHoverIndex}
          plotBoundedHeight={plotBoundedHeight}
          dFmt={dFmt}
          addDateLine={addDateLine}
          livePrice={livePrice}
          data={data}
          clampToPriceAxis={clampToPriceAxis}
          now={now}
          showIndicators={showIndicators}
          indicatorValues={indicatorValues}
          visibleDrawings={visibleDrawings}
          volumeVisible={volumeVisible}
          pixelYForDrawing={pixelYForDrawing}
          hoveredDrawingId={hoveredDrawingId}
          indexForDate={indexForDate}
          activeEventStack={activeEventStack}
          eventModalOpen={eventModalOpen}
          plotHeight={plotHeight}
          setEventModalOpen={setEventModalOpen}
          setActiveEventStack={setActiveEventStack}
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
          />
        )}
      </div>
      )}

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
        indicatorSearchQuery={indicatorSearchQuery} setIndicatorSearchQuery={setIndicatorSearchQuery}
        showVolume={showVolume}
        setVolumePaneState={setVolumePaneState}
        addIndicator={addIndicator}
        customIndicators={customIndicators} addCustomIndicator={addCustomIndicator}
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
        upColorOverride={upColorOverride} setUpColorOverride={setUpColorOverride}
        downColorOverride={downColorOverride}
        setDownColorOverride={setDownColorOverride}
        yAutoScalingState={yAutoScalingState}
        setYAutoScalingState={setYAutoScalingState}
        onYAutoScalingChange={onYAutoScalingChange}
        futureZoneVisible={futureZoneVisible} setFutureZoneVisible={setFutureZoneVisible}
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
