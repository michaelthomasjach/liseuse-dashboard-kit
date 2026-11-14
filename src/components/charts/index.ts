export { LineAreaChart } from "./LineAreaChart";
export type { LineAreaChartProps, LineAreaChartHandle, ChartSeries, ChartPoint } from "./LineAreaChart";

export { BarChart } from "./BarChart";
export type { BarChartProps, BarDatum } from "./BarChart";

export { CandlestickChart } from "./CandlestickChart";
export type {
  CandlestickChartProps,
  Candle,
  TrendLineDrawing,
  OverlayDataPoint,
  Indicator,
  CustomIndicatorDef,
  ChartTemplate,
  IndicatorKind,
  ChartEvent,
  FundamentalDataPoint,
  TimeframeOption,
  TimeframeGroup,
  TimeframeEntry,
  ChartAlert,
  ChartAlertDraft,
  ChartAlertCrossing,
  ScriptDef,
  ScriptAlertEvent,
  ChartVisibleRange,
  SymbolSearchResult,
  SymbolSearchList,
} from "./CandlestickChart";

export { ChartEventTooltip } from "./EventTooltip";
export type { ChartEventTooltipProps } from "./EventTooltip";

export type {
  AiSend,
  AiRequest,
  AiMessage,
  AiContentBlock,
  AiToolDefinition,
  AiServerTool,
  AiStreamEvent,
} from "./candlestick/ai/interfaces/AiMessage.interface";
export { anthropicSend, DEFAULT_AI_MODEL } from "./candlestick/ai/anthropicSend";

export { ChartWorkspace } from "./ChartWorkspace";
export type {
  ChartWorkspaceProps,
  ChartWorkspaceWatchlist,
  ChartWorkspaceWatchlistColumn,
  ChartWorkspaceWatchlistRow,
  ChartWorkspaceSidePanelTab,
  ChartWorkspaceGridArea,
  ChartWorkspaceGridLayout,
  ChartWorkspaceGridLayoutId,
  ChartWorkspacePanelCount,
  WatchlistEarningsRow,
  WatchlistDividendRow,
  WatchlistNewsItem,
} from "./ChartWorkspace";
export { CHART_WORKSPACE_GRID_LAYOUTS } from "./workspace/gridLayouts";
export type {
  SymbolProfile,
  SymbolProfilePerformancePoint,
  SymbolProfileNewsItem,
  SymbolProfileKeyStats,
  SymbolProfileEarningsPoint,
} from "./workspace/SymbolProfile.interface";

export { SeasonalityView } from "./SeasonalityView";
export type { SeasonalityViewProps } from "./SeasonalityView";
export { computeSeasonality } from "./internal/seasonality";
export type { SeasonalityGranularity, SeasonalityBucket, SeasonalityOccurrence, SeasonalityResult } from "./internal/seasonality";

export { GaugeChart } from "./GaugeChart";
export type { GaugeChartProps, GaugeThreshold } from "./GaugeChart";

export { DonutChart } from "./DonutChart";
export type { DonutChartProps, DonutDatum } from "./DonutChart";
export { WorldExposureMap } from "./WorldExposureMap";
export type { WorldExposureMapProps, WorldExposureDatum } from "./WorldExposureMap";
export { matchContinent, CONTINENT_LABELS, CONTINENTS } from "./worldGeo";
export type { Continent } from "./worldGeo";

export type { DepthLevel, DepthSnapshot, TapePrint } from "./candlestick/interfaces/MarketDepth.interface";
export type {
  BrokerAdapter,
  BrokerAccount,
  BrokerCredentialField,
  BrokerEnvironment,
  BrokerSession,
  BrokerMarket,
  BrokerOrderRequest,
  BrokerOrderResult,
  BrokerOrderSide,
  BrokerOrderType,
  BrokerPosition,
} from "./candlestick/broker/interfaces/Broker.interface";

export { MatrixChart } from "./MatrixChart";
export type { MatrixChartProps, MatrixCell, MatrixCellDetail, MatrixAxisEntry } from "./MatrixChart";

export { Heatmap, heatmapTileColor, useHeatmapLabelColor } from "./Heatmap";
export type { HeatmapProps, HeatmapGroup, HeatmapTile } from "./Heatmap";

export { AlertsPanel } from "./AlertsPanel";
export type { AlertsPanelProps } from "./AlertsPanel";

export { Sparkline } from "./Sparkline";
export type { SparklineProps } from "./Sparkline";

export { DeltaChart } from "./DeltaChart";
export type { DeltaChartProps, DeltaChartItem } from "./DeltaChart";

export { ChartTooltip } from "./ChartTooltip";
export type { ChartTooltipProps } from "./ChartTooltip";

export { ChartAxis } from "./ChartAxis";
export type { ChartAxisProps } from "./ChartAxis";

export type { ChartMargin, ChartDimensions } from "./internal/useChartDimensions";

export { SankeyChart } from "./SankeyChart";
export type { SankeyChartProps, SankeyNodeDatum, SankeyLinkDatum } from "./SankeyChart";
export type { ChartCustomTool } from "./candlestick/interfaces/ChartCustomTool.interface";
export type { OverlayDrawingInteraction } from "./candlestick/interfaces/OverlayDrawingInteraction.interface";
export type { ChartHeaderAction } from "./candlestick/interfaces/ChartHeaderAction.interface";

// Documentation du langage de script : la page complète (rendue sans fenêtre avec `detached`) et le manuel en texte
// (Markdown), pour une application qui veut les publier sur ses propres pages.
export { ScriptDocumentationModal } from "./candlestick/scripting/components/ScriptDocumentationModal";
// Sons des alertes (synthétisés) et capture d'un graphique en PNG, réutilisables par l'application.
export { playAlertSound, ALERT_SOUND_OPTIONS } from "./candlestick/alertSounds";
// Les outils que l'assistant du graphique offre au modèle (nom, description, paramètres), pour les lister ailleurs
// (ex. une page d'administration) sans dupliquer leur définition.
export { CHART_AI_TOOL_DEFINITIONS } from "./candlestick/ai/aiTools";
// Pont des outils du graphique pour un pilote extérieur (ex. serveur MCP), et boutons d'application du rail.
export type { ChartToolBridge } from "./candlestick/ai/chartToolBridge";
export type { WorkspaceRailAction } from "./workspace/WorkspaceSideRail";
export type { DaySeparatorSettings } from "./candlestick/daySeparators";
export { DEFAULT_DAY_SEPARATORS } from "./candlestick/daySeparators";
// Conversations de l'assistant, gardées par l'application (CandlestickChartProps.ai.conversations).
export type { AiConversation, AiConversationStore } from "./candlestick/ai/useAiAssistant";
export { captureChartBlob, captureChartCanvas, captureFileName } from "./candlestick/captureChart";
export type { ChartCaptureOptions } from "./candlestick/captureChart";
export type { ScriptDocumentationModalProps } from "./candlestick/scripting/components/ScriptDocumentationModal";
export { loadScriptingPrompt } from "./candlestick/scripting/loadScriptingPrompt";
