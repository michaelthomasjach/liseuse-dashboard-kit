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
  ChartTemplateSnapshot,
  ChartTemplateScript,
  ChartPaneLayout,
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
  AiImage,
  AiToolDefinition,
  AiServerTool,
  AiStreamEvent,
} from "./candlestick/ai/interfaces/AiMessage.interface";
export { anthropicSend, DEFAULT_AI_MODEL } from "./candlestick/ai/anthropicSend";

// Raccourcis du graphique et de l'espace de travail : la liste unique, sa fenêtre et son panneau avec recherche.
export { CHART_SHORTCUTS, CHART_SHORTCUT_GROUPS, filterChartShortcuts, shortcutTokenLabel } from "./candlestick/chartShortcuts";
export type { ChartShortcut, ChartShortcutGroup, ShortcutToken } from "./candlestick/chartShortcuts";
export { ShortcutsPanel, ShortcutsModal } from "./candlestick/components/ShortcutsPanel";
export type { ShortcutsPanelProps, ShortcutsModalProps } from "./candlestick/components/ShortcutsPanel";
export type { WorkspaceHelpTab } from "./workspace/WorkspaceHelpModal";

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

export { CalendarHeatmap, calendarLevel } from "./CalendarHeatmap";
export type { CalendarHeatmapProps, CalendarHeatmapDatum } from "./CalendarHeatmap";

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
export type { ChartCustomToolbar } from "./candlestick/interfaces/ChartCustomToolbar.interface";
export type { OverlayDrawingInteraction } from "./candlestick/interfaces/OverlayDrawingInteraction.interface";
export type { ChartHeaderAction } from "./candlestick/interfaces/ChartHeaderAction.interface";

// Documentation du langage de script : la page complète (rendue sans fenêtre avec `detached`) et le manuel en texte
// (Markdown), pour une application qui veut les publier sur ses propres pages.
export { ScriptDocumentationModal } from "./candlestick/scripting/components/ScriptDocumentationModal";
export { IndicatorHelpArticle, IndicatorHelpIndex } from "./candlestick/components/IndicatorHelpArticle";
export type { IndicatorHelpArticleProps, IndicatorHelpIndexProps } from "./candlestick/components/IndicatorHelpArticle";
export { IndicatorHelpProvider, IndicatorHelpButton, useOpenIndicatorHelp } from "./candlestick/components/IndicatorHelp";
export type { IndicatorHelpProviderProps, IndicatorHelpButtonProps } from "./candlestick/components/IndicatorHelp";
export { INDICATOR_HELP_DETAILS, INDICATOR_HELP_KINDS, hasIndicatorHelp, indicatorHelpPage } from "./candlestick/indicatorHelp";
export type { IndicatorHelpDetails, IndicatorHelpPage, IndicatorHelpParam } from "./candlestick/indicatorHelp";
// « Demander à la documentation » : recherche locale dans la documentation du scripting, et réponse de l'IA de
// l'application sur les seuls passages trouvés, vérifiée contre eux.
export { ScriptDocsAsk } from "./candlestick/scripting/components/ScriptDocsAsk";
export type { ScriptDocsAskProps } from "./candlestick/scripting/components/ScriptDocsAsk";
export { searchScriptDocs, scriptDocsEntries, unknownScriptNames, formatScriptDocsExcerpts } from "./candlestick/scripting/docsSearch/scriptDocsSearch";
export type { ScriptDocsEntry, ScriptDocsExcerpt, ScriptDocsSearchResult, ScriptDocsUnknownName, ScriptDocsSearchOptions } from "./candlestick/scripting/docsSearch/scriptDocsSearch";
export { askScriptDocsWithSend, checkScriptDocsAnswer, parseScriptDocsAnswer, scriptDocsPrompt, SCRIPT_DOCS_SYSTEM_PROMPT } from "./candlestick/scripting/docsSearch/scriptDocsAnswer";
export type { AskScriptDocs, ScriptDocsAnswer, ScriptDocsVerdict, CheckedScriptDocsAnswer } from "./candlestick/scripting/docsSearch/scriptDocsAnswer";
// Sons des alertes (synthétisés) et capture d'un graphique en PNG, réutilisables par l'application.
export { playAlertSound, ALERT_SOUND_OPTIONS } from "./candlestick/alertSounds";
// Les outils que l'assistant du graphique offre au modèle (nom, description, paramètres), pour les lister ailleurs
// (ex. une page d'administration) sans dupliquer leur définition.
export { CHART_AI_TOOL_DEFINITIONS } from "./candlestick/ai/aiTools";
export { chartAiToolCatalog, chartAiToolGroup, CHART_AI_TOOL_GROUPS } from "./candlestick/ai/toolCatalog";
export type { ChartAiToolCatalogEntry } from "./candlestick/ai/toolCatalog";
export type { AiChartControls, AiPaneInfo } from "./candlestick/ai/aiChartControls";
// Pont des outils du graphique pour un pilote extérieur (ex. serveur MCP), et boutons d'application du rail.
export type { ChartToolBridge } from "./candlestick/ai/chartToolBridge";
export type { AiToolOutcome } from "./candlestick/ai/aiTools";
export { encodeCapture, MAX_CAPTURE_BYTES, CAPTURE_TOOL } from "./candlestick/ai/captureTool";
export type { WorkspaceRailAction } from "./workspace/WorkspaceSideRail";
export type { DaySeparatorSettings } from "./candlestick/daySeparators";
export type { ChartAppearanceSettings } from "./candlestick/hooks/useChartAppearance";
// Derniers styles des dessins par outil (props `defaultDrawingStyles` / `onDrawingStylesChange`).
export type { DrawingStylesByTool } from "./candlestick/hooks/useLastDrawingStyles";
// Style conditionnel des bougies (paramètres du graphique, prop `candleColorRules`) et des indicateurs (icônes).
export type { CandleColorRule, CandleColorCondition, CandleColorMetric, CandleColorOperator, CandleIconMark } from "./candlestick/interfaces/CandleColorRule.interface";
export type { RuleIcon, RuleIconPosition } from "./candlestick/interfaces/IndicatorStyleRule.interface";
export { CANDLE_COLOR_RULE_TEMPLATES } from "./candlestick/candleColorRules";
export type { ChartDisplayMode } from "./candlestick/interfaces/ChartDisplayMode.interface";
export type { PriceScaleMode } from "./candlestick/interfaces/PriceScaleMode.interface";
export { DEFAULT_DAY_SEPARATORS } from "./candlestick/daySeparators";
export type { PriceAlertLine } from "./candlestick/render/drawPriceAlertLines";
// Conversations de l'assistant, gardées par l'application (CandlestickChartProps.ai.conversations).
export type { AiConversation, AiConversationStore } from "./candlestick/ai/useAiAssistant";
export { captureChartBlob, captureChartCanvas, captureFileName } from "./candlestick/captureChart";
export type { ChartCaptureOptions } from "./candlestick/captureChart";
export type { ScriptDocumentationModalProps } from "./candlestick/scripting/components/ScriptDocumentationModal";
export { loadScriptingPrompt } from "./candlestick/scripting/loadScriptingPrompt";
// Indicateurs : id unique à chaque ajout, réparation des listes enregistrées où deux indicateurs partageaient un id,
// et zones de temps d'un indicateur `draw: "zones"` fournies par l'application.
export { newIndicatorId, dedupeIndicatorIds } from "./candlestick/indicatorIds";
export type { CustomIndicatorZone } from "./candlestick/interfaces/CustomIndicatorDef.interface";
// Alertes : la série (prix, volume, indicateur) sur laquelle porte une alerte, calculée comme le graphique la trace,
// pour que l'application vérifie les alertes qui ne portent pas sur le prix.
export { alertSeriesValues } from "./candlestick/alertSeries";
