import { UNAVAILABLE_FOR_SYMBOL, unavailableForSymbol } from "../equityOnly";
import { isPriceOverlay } from "../attachedIndicators";
import "./IndicatorLegendHandle.css";
import type { IndicatorInfoTarget } from "../interfaces/IndicatorInfoTarget.interface";
import { IndicatorHelpButton, useOpenIndicatorHelp } from "./IndicatorHelp";
import { hasIndicatorHelp } from "../indicatorHelp";
import { scriptIdFromIndicatorId, infoTargetFor } from "../scripting/scriptOutputToCustomIndicatorDef";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useMemo, useRef, useState } from "react";
import { Popover } from "../../../forms/Popover";
import { ActivityIcon, CodeIcon, CopyIcon, EyeIcon, EyeOffIcon, TrashIcon, SettingsIcon, AlarmClockIcon, ChevronUpIcon, ChevronDownIcon, CursorArrowIcon, MoreHorizontalIcon, InfoIcon } from "../../../icons";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { ChartStyleSettings } from "../chartStyle";
import type { OverlayDataPoint, TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import { CHART_DISPLAY_MODES, type ChartDisplayModeDef } from "../chartModes";
import { Modal } from "../../../primitives/Modal";

/** A comparison overlay's own quote at `at` (the hovered candle, else the last one): its last point
 *  on or before that date — the overlay keeps its own trading hours, so an exact date match is the
 *  exception, not the rule — and the move from the point before it, in the overlay's *own* price
 *  units, not the rebased ones the plot uses. Null when the overlay's history starts after `at`.
 *  `series` must be sorted by date (see `sortedOverlaySeries` in ChartLegend). */
function overlayQuoteAt(series: OverlayDataPoint[], at: Date) {
  const t = at.getTime();
  let lo = 0;
  let hi = series.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].date.getTime() <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (found < 0) return null;
  const point = series[found];
  const prevClose = found > 0 ? series[found - 1].value : (point.open ?? point.value);
  const delta = point.value - prevClose;
  const deltaPct = prevClose !== 0 ? (delta / prevClose) * 100 : 0;
  const hasOHLC = point.open !== undefined && point.high !== undefined && point.low !== undefined;
  return { point, hasOHLC, delta, deltaPct, sign: delta >= 0 ? "+" : "" };
}

export interface ChartLegendProps {
  /** Réglages « Ligne d'état » des paramètres (symbole, description, OHLC, variation, volume, valeurs et titres des
   *  indicateurs). Absent : la légende d'avant ces réglages. */
  statusLine?: ChartStyleSettings;
  /** Formate le volume de la ligne d'état (`legendVolume`). */
  vFmt?: (value: number) => string;
  /** Valeur(s) d'un indicateur à la bougie de la légende, pour `legendIndicatorValues`. */
  indicatorLegendValue?: (indicator: Indicator) => string | null;
  /** Voir `CandlestickChartProps.symbolIsEquity` : false, un indicateur réservé aux actions dit « Indisponible pour ce
   *  symbole » à la place de sa valeur. */
  symbolIsEquity?: boolean;
  dims: { margin: { top: number; left: number } };
  /** The price plot's own height, which caps how tall the indicator list may grow (see
   *  `.lq-chart__indicator-legend`). */
  priceHeight: number;
  symbol: string | undefined;
  symbolSearch: boolean;
  /** Voir `CandlestickChartProps.onSymbolClick` : le nom devient un bouton qui appelle l'hôte. */
  onSymbolClick?: () => void;
  /** Voir `CandlestickChartProps.symbolClickActive`. */
  symbolClickActive: boolean;
  setSymbolSearchOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  currentModeEntry: ChartDisplayModeDef;
  ohlcCandle: Candle;
  ohlcDelta: number;
  ohlcDeltaPct: number;
  ohlcSign: string;
  /** Narrow/phone layout (see CandlestickChart's own `isNarrowLayout`). Splits this header in two:
   *  `SYMBOLE · <type>` on the first line, the quote on a second one below it — and that quote
   *  drops to close + change + percent, since O/H/L/C plus all three of those never fitted on a
   *  phone's width and simply ran off the edge of the plot. */
  mobile: boolean;
  pFmt: (value: number) => string;
  showIndicators: boolean;
  overlayIndicators: Indicator[];
  /** Liste des indicateurs repliée (chevron « ‹ » sous la liste) : il ne reste qu'un bouton « › N » qui la redéplie ; le
   *  symbole et l'OHLC restent. Contrôlé par le graphique, qui le garde avec la disposition des panneaux. Absent : la
   *  légende le tient elle-même. */
  legendCollapsed?: boolean;
  onToggleLegendCollapsed?: () => void;
  /** Volume affiché sur le graphique des prix : sa ligne dans la légende (nom, valeur, masquer, paramètres, retirer). */
  volumeOverlay?: { value: string | null; hidden: boolean; toggleHidden: () => void; openSettings: () => void; remove: () => void };
  indicators: Indicator[];
  defaultIndicatorColor: (index: number) => string;
  openIndicatorSettings: (id: string) => void;
  setHoveredIndicatorId: Dispatch<SetStateAction<string | null>>;
  /** Which indicator is hovered right now, from *either* surface — this legend, or the line itself
   *  on the plot (see `useDrawingInteractions`' own `onHoveredIndicatorChange`). One piece of state
   *  for one fact, so pointing at a curve and pointing at its name light up the same row. */
  /** Ligne symbole · type · OHLC masquée (clic droit « Masquer ces informations »). */
  symbolInfoHidden?: boolean;
  hoveredIndicatorId: string | null;
  indicatorLabel: (indicator: Indicator) => string;
  toggleIndicatorHidden: (id: string) => void;
  /** Réaffiche la légende d'un indicateur masquée par le menu contextuel (`Indicator.legendHidden`). */
  onToggleIndicatorLegend?: (id: string) => void;
  removeIndicator: (id: string) => void;
  /** « Copier » du menu « … » d'un indicateur : le met de côté, Ctrl/Cmd+V en colle une copie (comme Ctrl/Cmd+C au
   *  survol de sa ligne). Absent : pas d'entrée « Copier ». */
  copyIndicator?: (id: string) => void;
  /** Indicator ids that currently have at least one alert (see `useAlertFlow`) — drives the
   *  bell's active state so it stays visible even while the row isn't hovered, same
   *  "icon next to it once an alert exists" treatment the drawing toolbar's own bell gets. */
  alertedIndicatorIds: Set<string>;
  onOpenIndicatorAlert: (indicator: Indicator) => void;
  /** Opens the same "how it works" info modal the indicator picker's own info icon already
   *  does (see IndicatorModals) — this row's own equivalent for an indicator that's already
   *  active, so its explanation stays one click away without going back through the picker. */
  onOpenIndicatorInfo: (target: IndicatorInfoTarget) => void;
  /** Opens the source behind this indicator — its own script for a scripted one, the script that
   *  would reproduce it for a built-in. */
  onOpenIndicatorCode: (indicator: Indicator) => void;
  /** Whether there is any source to show. A kind that detects its own structure by looking at bars
   *  on both sides of a pivot has none, and gets no button rather than one that opens nothing. */
  hasIndicatorCode: (indicator: Indicator) => boolean;
  /** Scripts currently declaring `@strategy`. Their legend rows get a tester toggle — the only way
   *  back once its panel has been closed, and the reason closing it is safe to do. */
  strategyScriptIds: string[];
  /** Which strategy's tester is showing, so its own row can read as pressed. */
  openStrategyId: string | null;
  onToggleStrategyPanel: (scriptId: string) => void;
  symbolOverlays: TrendLineDrawing[];
  drawings: TrendLineDrawing[];
  commitDrawings: (drawings: TrendLineDrawing[]) => void;
  drawingLabel: (drawing: TrendLineDrawing) => string;
  setHoveredDrawingId: Dispatch<SetStateAction<string | null>>;
  setEditingId: Dispatch<SetStateAction<string | null>>;
  setDraft: Dispatch<SetStateAction<TrendLineDrawing | null>>;
  setEditModalTab: (tab: "coords" | "text" | "style") => void;
  removeSymbolOverlay: (ticker: string) => void;
  /** Clic sur le nom d'un symbole comparé : recherche d'un autre symbole pour le remplacer (absent : nom
   *  non cliquable, l'application ne fournit pas de données à comparer). */
  onReplaceOverlaySymbol?: (drawingId: string) => void;
}

/** Symbol/chart-type label + live OHLC readout, then the indicator legend right below it — one
 *  shared top-left column instead of two independently-positioned corners, so neither has to
 *  guess the other's height to avoid overlapping it. Under `mobile` the first of those two is
 *  itself two lines, and its readout shrinks to a close/change/percent quote — see that prop's
 *  own doc. Purely presentational; every interaction is a callback prop. */
export function ChartLegend({
  dims,
  priceHeight,
  symbol,
  symbolSearch,
  onSymbolClick,
  symbolClickActive,
  setSymbolSearchOpen,
  setSettingsOpen,
  currentModeEntry,
  ohlcCandle,
  ohlcDelta,
  ohlcDeltaPct,
  ohlcSign,
  mobile,
  pFmt,
  showIndicators,
  overlayIndicators,
  legendCollapsed,
  onToggleLegendCollapsed,
  volumeOverlay,
  indicators,
  defaultIndicatorColor,
  openIndicatorSettings,
  setHoveredIndicatorId,
  symbolInfoHidden = false,
  statusLine,
  vFmt,
  indicatorLegendValue,
  symbolIsEquity,
  hoveredIndicatorId,
  indicatorLabel,
  toggleIndicatorHidden,
  onToggleIndicatorLegend,
  removeIndicator,
  copyIndicator,
  alertedIndicatorIds,
  onOpenIndicatorAlert,
  onOpenIndicatorCode,
  hasIndicatorCode,
  strategyScriptIds,
  openStrategyId,
  onToggleStrategyPanel,
  symbolOverlays,
  drawings,
  commitDrawings,
  drawingLabel,
  setHoveredDrawingId,
  setEditingId,
  setDraft,
  setEditModalTab,
  removeSymbolOverlay,
  onReplaceOverlaySymbol,
  onOpenIndicatorInfo,
}: ChartLegendProps) {
  const infoAction = useIndicatorInfoAction(onOpenIndicatorInfo);
  const lineModeEntry = CHART_DISPLAY_MODES.find((m) => m.mode === "line")!;
  // Symbole comparé dont la fenêtre « Mode d'affichage » est ouverte (clic sur son mode dans la légende).
  const [modeFor, setModeFor] = useState<string | null>(null);
  const modeDrawing = modeFor ? symbolOverlays.find((d) => d.id === modeFor) : undefined;
  const modeHasOHLC = (modeDrawing?.overlayData?.length ?? 0) > 0 && modeDrawing!.overlayData!.every((p) => p.open !== undefined && p.high !== undefined && p.low !== undefined);
  // Liste repliée : tenue par le graphique quand il la fournit (gardée avec la disposition), sinon ici.
  const [ownFolded, setOwnFolded] = useState(false);
  const legendFolded = legendCollapsed ?? ownFolded;
  const toggleLegendFolded = onToggleLegendCollapsed ?? (() => setOwnFolded((folded) => !folded));
  // Compared symbols first, indicators after: a symbol is a series of its own, on the same footing
  // as the main one right above, and an indicator added afterwards must not end up between them.
  const legendNames = [...(volumeOverlay ? ["Volume"] : []), ...symbolOverlays.map((dr) => drawingLabel(dr)), ...overlayIndicators.map((ind) => indicatorLabel(ind))];
  // Each overlay's series sorted once per change of the overlays, not on every hover move.
  const sortedOverlaySeries = useMemo(
    () => new Map(symbolOverlays.map((dr) => [dr.id, [...(dr.overlayData ?? [])].sort((a, b) => a.date.getTime() - b.date.getTime())])),
    [symbolOverlays],
  );
  const legendEntryCount = legendNames.length;
  // Ligne d'état : chaque partie masquable (réglages « Ligne d'état »), par défaut comme avant.
  const showSymbol = statusLine?.legendSymbol !== false;
  const showDescription = statusLine?.legendDescription !== false;
  const showOhlc = statusLine?.legendOhlc !== false;
  const showChange = statusLine?.legendChange !== false;
  const showVolume = statusLine?.legendVolume === true && typeof ohlcCandle.volume === "number";
  const showIndicatorValues = statusLine?.legendIndicatorValues === true && indicatorLegendValue !== undefined;
  const showIndicatorTitles = statusLine?.legendIndicatorTitles !== false;
  return (
    <div
      className="lq-chart__plot-topleft"
      // `--lq-chart-price-height` is what caps the indicator list at half the plot (see
      // .lq-chart__indicator-legend) — passed as a custom property rather than an inline
      // max-height so the "half" lives in the stylesheet with the rest of the rule.
      style={{ top: dims.margin.top + 6, left: dims.margin.left + 6, ["--lq-chart-price-height" as string]: `${priceHeight}px` }}
    >
      <div className={["lq-chart__symbol-info", mobile && "lq-chart__symbol-info--stacked"].filter(Boolean).join(" ")} hidden={symbolInfoHidden}>
        {/* Its own hoverable zone (background on hover) only once `symbolSearch` opts in —
            otherwise `symbol` still renders, just as inert text, same as before this
            existed. Double-click only (not single), matching the chart-type label right
            next to it — deliberately NOT also wired to onClick: Modal's own overlay closes
            on click, covering the full viewport once open, so a single click that opened it
            would leave the *second* click of the same double-click gesture landing on that
            overlay instead of this button, closing the modal again immediately. */}
        {/* An host that picks the symbol itself (`onSymbolClick`, see ChartWorkspace) comes first:
            a single click is enough here, since what it opens is not a modal whose overlay would
            catch the second click of a double-click (see just below) — a double-click is two
            clicks, both harmless. The double-click itself stops here, so it never reaches the
            plot underneath. The cursor icon only shows on hover, focus, or while pressed. */}
        {symbol && showSymbol &&
          (onSymbolClick ? (
            <button
              type="button"
              className={[
                "lq-chart__symbol-info-name",
                "lq-chart__symbol-info-name--clickable",
                "lq-chart__symbol-info-name--pick",
                symbolClickActive && "lq-chart__symbol-info-name--active",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={onSymbolClick}
              onDoubleClick={(e) => e.stopPropagation()}
              aria-label={`Changer le symbole de cette fenêtre (${symbol})`}
              title="Changer le symbole de cette fenêtre"
            >
              <span>{symbol}</span>
              <CursorArrowIcon size={11} className="lq-chart__symbol-info-pick-icon" aria-hidden="true" />
            </button>
          ) : symbolSearch ? (
            <button
              type="button"
              className="lq-chart__symbol-info-name lq-chart__symbol-info-name--clickable"
              onDoubleClick={() => setSymbolSearchOpen(true)}
              aria-label="Rechercher un symbole"
              title="Double-clic : rechercher un symbole"
            >
              {symbol}
            </button>
          ) : (
            <span className="lq-chart__symbol-info-name">{symbol}</span>
          ))}
        {symbol && showSymbol && showDescription && <span className="lq-chart__symbol-info-sep">·</span>}
        {showDescription && (
        <button
          type="button"
          className="lq-chart__symbol-info-name lq-chart__symbol-info-name--clickable"
          onDoubleClick={() => setSettingsOpen(true)}
          title="Double-clic : paramètres du graphique"
        >
          {currentModeEntry.label}
        </button>
        )}
        {/* Same element, same up/down colour and same tabular figures either way — only how much
            of the candle it spells out changes. The `--stacked` modifier on the row above is what
            actually breaks the line (a full-width flex basis, see charts-shared.css); this span
            stays a plain sibling of the symbol and the mode label rather than moving into a
            wrapper of its own, so nothing about the desktop row's own baseline alignment shifts. */}
        <span className={["lq-chart__symbol-info-ohlc", ohlcDelta >= 0 ? "lq-chart__symbol-info-ohlc--up" : "lq-chart__symbol-info-ohlc--down"].join(" ")}>
          {mobile ? (
            <>
              {showOhlc && <>{pFmt(ohlcCandle.close)} </>}
              {showChange && (
                <>
                  {ohlcSign}
                  {pFmt(ohlcDelta)} ({ohlcSign}
                  {ohlcDeltaPct.toFixed(2)}%)
                </>
              )}
            </>
          ) : (
            <>
              {showOhlc && <>O {pFmt(ohlcCandle.open)} H {pFmt(ohlcCandle.high)} L {pFmt(ohlcCandle.low)} C {pFmt(ohlcCandle.close)} </>}
              {showChange && (
                <>
                  {ohlcSign}
                  {pFmt(ohlcDelta)} ({ohlcSign}
                  {ohlcDeltaPct.toFixed(2)}%)
                </>
              )}
            </>
          )}
          {showVolume && <> V {(vFmt ?? String)(ohlcCandle.volume!)}</>}
        </span>
      </div>
      {/* Price-overlay indicators (SMA/EMA/WMA/VWAP/Bollinger) only — "own"-pane ones
          (RSI/CHOP/MACD) already get their own pane header with the same
          gear/trash/collapse actions, and don't belong on top of the price section they're
          not even plotted on. Filtering unconditionally on `indicators` here used to list
          every indicator regardless of `pane`, which put RSI/CHOP/MACD's labels in this
          corner overlapping the OHLC readout above them — and made their "eye" button here a
          silent no-op, since an own-pane indicator's visibility reads `paneCollapsed`, not
          `hidden` (see `Indicator.hidden`'s own doc comment). */}
      {((showIndicators && overlayIndicators.length > 0) || symbolOverlays.length > 0 || volumeOverlay) && (
      <>
      <div className={["lq-chart__indicator-legend", legendFolded && "lq-chart__indicator-legend--folded"].filter(Boolean).join(" ")}>
        {/* Symbol-comparison overlays (see onAddSymbolOverlay) — same legend, same hover-
            revealed eye/trash/gear actions as a price-overlay indicator's own entry above,
            but wired to the drawing this one actually is: the gear/double-click open its
            edit modal (Style tab only, see there), the eye toggles its own `hidden` field,
            the trash removes it from `drawings` directly (no confirmation round-trip through
            the app needed, unlike adding one — removing never needs new data). Hovering it
            also sets `hoveredDrawingId`, the same state a mouse actually over its line on the
            canvas would — so the line highlights while its legend entry is hovered, and
            Suppr/Retour arrière removes it from here too, exactly like hovering the line
            itself would. */}
        {symbolOverlays.map((dr) => {
          const quote = overlayQuoteAt(sortedOverlaySeries.get(dr.id) ?? [], ohlcCandle.date);
          const overlayModeEntry = CHART_DISPLAY_MODES.find((m) => m.mode === (dr.overlayDisplayMode ?? "line")) ?? lineModeEntry;
          return (
          <div
            key={dr.id}
            className="lq-chart__indicator-legend-item"
            style={{ color: dr.color ?? defaultIndicatorColor(symbolOverlays.indexOf(dr)) }}
            onDoubleClick={() => {
              setEditingId(dr.id);
              setDraft(dr);
              setEditModalTab("style");
            }}
            onMouseEnter={() => setHoveredDrawingId(dr.id)}
            onMouseLeave={() => setHoveredDrawingId((id) => (id === dr.id ? null : id))}
          >
            {/* Same readout as the main symbol's row above — name · display mode · O H L C and the
                move from the previous point, in the overlay's own prices, up/down coloured — so a
                compared symbol reads as a second quote, not as an indicator. The name keeps the
                overlay's own colour: it is what ties the row to its line on the plot. */}
            <span
              className={["lq-chart__indicator-legend-label", "lq-chart__overlay-legend-quote", dr.hidden && "lq-chart__indicator-legend-label--hidden"].filter(Boolean).join(" ")}
            >
              {/* Nom : un clic ouvre la recherche pour remplacer ce symbole ; mode : un clic ouvre le choix du
                  mode d'affichage. Un double-clic ne remonte pas à la ligne (il ouvrirait aussi ses
                  paramètres par-dessus). */}
              {onReplaceOverlaySymbol ? (
                <button
                  type="button"
                  className="lq-chart__symbol-info-name lq-chart__symbol-info-name--clickable lq-chart__overlay-legend-name"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReplaceOverlaySymbol(dr.id);
                  }}
                  onDoubleClick={(e) => e.stopPropagation()}
                  title={`Remplacer ${drawingLabel(dr)} par un autre symbole`}
                >
                  {drawingLabel(dr)}
                </button>
              ) : (
                <span className="lq-chart__symbol-info-name lq-chart__overlay-legend-name">{drawingLabel(dr)}</span>
              )}
              <span className="lq-chart__symbol-info-sep">·</span>
              <button
                type="button"
                className="lq-chart__symbol-info-name lq-chart__symbol-info-name--clickable"
                onClick={(e) => {
                  e.stopPropagation();
                  setModeFor(dr.id);
                }}
                onDoubleClick={(e) => e.stopPropagation()}
                title="Changer le mode d'affichage"
              >
                {(quote?.hasOHLC ? overlayModeEntry : lineModeEntry).label}
              </button>
              {quote && (
                <span className={["lq-chart__symbol-info-ohlc", quote.delta >= 0 ? "lq-chart__symbol-info-ohlc--up" : "lq-chart__symbol-info-ohlc--down"].join(" ")}>
                  {quote.hasOHLC && !mobile && (
                    <>
                      O {pFmt(quote.point.open!)} H {pFmt(quote.point.high!)} L {pFmt(quote.point.low!)} C{" "}
                    </>
                  )}
                  {pFmt(quote.point.value)} {quote.sign}
                  {pFmt(quote.delta)} ({quote.sign}
                  {quote.deltaPct.toFixed(2)}%)
                </span>
              )}
            </span>
            <div className="lq-chart__indicator-legend-actions">
              <button
                type="button"
                className="lq-chart__indicator-legend-action"
                onClick={() => commitDrawings(drawings.map((d) => (d.id === dr.id ? { ...d, hidden: !d.hidden } : d)))}
                aria-label={dr.hidden ? `Afficher ${drawingLabel(dr)}` : `Masquer ${drawingLabel(dr)}`}
              >
                {dr.hidden ? <EyeOffIcon size={11} /> : <EyeIcon size={11} />}
              </button>
              <button
                type="button"
                className="lq-chart__indicator-legend-action"
                onClick={() => removeSymbolOverlay(dr.overlaySymbol ?? "")}
                aria-label={`Supprimer ${drawingLabel(dr)}`}
              >
                <TrashIcon size={11} />
              </button>
              <button
                type="button"
                className="lq-chart__indicator-legend-action"
                onClick={() => {
                  setEditingId(dr.id);
                  setDraft(dr);
                  setEditModalTab("style");
                }}
                aria-label={`Paramètres ${drawingLabel(dr)}`}
              >
                <SettingsIcon size={11} />
              </button>
            </div>
          </div>
          );
        })}
        {/* Volume affiché sur le graphique des prix : une ligne comme celle d'un indicateur, toujours avec sa valeur. */}
        {volumeOverlay && (
          <div
            className="lq-chart__indicator-legend-item lq-chart__indicator-legend-item--volume"
            onDoubleClick={volumeOverlay.openSettings}
            data-legend-volume=""
          >
            <span className={["lq-chart__indicator-legend-label", volumeOverlay.hidden && "lq-chart__indicator-legend-label--hidden"].filter(Boolean).join(" ")}>
              Volume
              {volumeOverlay.value && <span className="lq-chart__indicator-legend-value"> {volumeOverlay.value}</span>}
            </span>
            <div className="lq-chart__indicator-legend-actions">
              <button type="button" className="lq-chart__indicator-legend-action" onClick={volumeOverlay.toggleHidden} aria-label={volumeOverlay.hidden ? "Afficher Volume" : "Masquer Volume"}>
                {volumeOverlay.hidden ? <EyeOffIcon size={11} /> : <EyeIcon size={11} />}
              </button>
              <button type="button" className="lq-chart__indicator-legend-action" onClick={volumeOverlay.remove} aria-label="Supprimer Volume">
                <TrashIcon size={11} />
              </button>
              <button type="button" className="lq-chart__indicator-legend-action" onClick={volumeOverlay.openSettings} aria-label="Paramètres Volume">
                <SettingsIcon size={11} />
              </button>
            </div>
          </div>
        )}
        {overlayIndicators.map((indicator) => {
          // The *full* indicators array's own index, not this filtered map's — the canvas
          // draw effect cycles defaultIndicatorColor off that same full-array position (see
          // visibleIndicators.forEach a bit further up), so this has to match it exactly or
          // an indicator's legend swatch and its actual line would disagree on its color the
          // moment an own-pane indicator (filtered out of this list) sits before it.
          const i = indicators.indexOf(indicator);
          // Légende masquée (menu contextuel) : un simple repère de sa couleur, qui la réaffiche.
          if (indicator.legendHidden) {
            return (
              <button
                key={indicator.id}
                type="button"
                className="lq-chart__indicator-legend-handle"
                style={{ color: indicator.color ?? defaultIndicatorColor(i) }}
                onClick={() => onToggleIndicatorLegend?.(indicator.id)}
                onMouseEnter={() => setHoveredIndicatorId(indicator.id)}
                onMouseLeave={() => setHoveredIndicatorId((id) => (id === indicator.id ? null : id))}
                aria-label={`Afficher la légende du ${indicatorLabel(indicator)}`}
                title={`Légende du ${indicatorLabel(indicator)} masquée — cliquer pour l'afficher`}
              >
                <EyeOffIcon size={11} />
              </button>
            );
          }
          return (
          <div
            key={indicator.id}
            className={[
              "lq-chart__indicator-legend-item",
              hoveredIndicatorId === indicator.id && "lq-chart__indicator-legend-item--hovered",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ color: indicator.color ?? defaultIndicatorColor(i) }}
            onDoubleClick={() => openIndicatorSettings(indicator.id)}
            onMouseEnter={() => setHoveredIndicatorId(indicator.id)}
            onMouseLeave={() => setHoveredIndicatorId((id) => (id === indicator.id ? null : id))}
          >
            <span
              className={["lq-chart__indicator-legend-label", indicator.hidden && "lq-chart__indicator-legend-label--hidden"]
                .filter(Boolean)
                .join(" ")}
            >
              {showIndicatorTitles && indicatorLabel(indicator)}
              {/* « Vol. jour ATR » : ATR et SMA toujours lisibles ici, ses lignes ne les écrivent qu'en étiquettes. */}
              {unavailableForSymbol(indicator, symbolIsEquity) ? (
                <span className="lq-chart__indicator-legend-value lq-chart__indicator-unavailable">{showIndicatorTitles ? " " : ""}{UNAVAILABLE_FOR_SYMBOL}</span>
              ) : (showIndicatorValues || ((isPriceOverlay(indicator) || indicator.kind === "expectedVolatility") && indicatorLegendValue)) && (() => {
                const value = indicatorLegendValue!(indicator);
                return value ? <span className="lq-chart__indicator-legend-value">{showIndicatorTitles ? " " : ""}{value}</span> : null;
              })()}
            </span>
            {/* Invisibles tant que la ligne n'est pas survolée (voir charts-shared.css), dans l'ordre : œil, code,
                aide, testeur de stratégie, corbeille, puis « … » qui ouvre le menu (alerte, copier, afficher,
                supprimer, paramètres). La cloche reste visible, seule, quand l'indicateur a une alerte. */}
            <div className="lq-chart__indicator-legend-actions">
              {alertedIndicatorIds.has(indicator.id) && (
                <button
                  type="button"
                  className="lq-chart__indicator-legend-action lq-chart__indicator-legend-action--alert-active"
                  onClick={() => onOpenIndicatorAlert(indicator)}
                  aria-pressed
                  aria-label={`Alertes sur ${indicatorLabel(indicator)}`}
                >
                  <AlarmClockIcon size={LEGEND_ICON} />
                </button>
              )}
              <button
                type="button"
                className="lq-chart__indicator-legend-action"
                onClick={() => toggleIndicatorHidden(indicator.id)}
                aria-label={indicator.hidden ? `Afficher ${indicatorLabel(indicator)}` : `Masquer ${indicatorLabel(indicator)}`}
                title={indicator.hidden ? "Afficher" : "Masquer"}
              >
                {indicator.hidden ? <EyeOffIcon size={LEGEND_ICON} /> : <EyeIcon size={LEGEND_ICON} />}
              </button>
              {hasIndicatorCode(indicator) && (
                <button
                  type="button"
                  className="lq-chart__indicator-legend-action"
                  onClick={() => onOpenIndicatorCode(indicator)}
                  aria-label={`Voir le code de ${indicatorLabel(indicator)}`}
                  title="Voir le code"
                >
                  <CodeIcon size={LEGEND_ICON} />
                </button>
              )}
              {!indicator.customData && <IndicatorHelpButton kind={indicator.kind} className="lq-chart__indicator-legend-action" />}
              {/* Only on a row that came from a @strategy script — every other indicator has no
                  tester to show. */}
              {(() => {
                const scriptId = scriptIdFromIndicatorId(indicator.customData?.id);
                if (scriptId === null || !strategyScriptIds.includes(scriptId)) return null;
                const open = openStrategyId === scriptId;
                return (
                  <button
                    type="button"
                    className="lq-chart__indicator-legend-action"
                    onClick={() => onToggleStrategyPanel(scriptId)}
                    aria-pressed={open}
                    aria-label={`${open ? "Fermer" : "Ouvrir"} le testeur de stratégie de ${indicatorLabel(indicator)}`}
                  >
                    <ActivityIcon size={LEGEND_ICON} />
                  </button>
                );
              })()}
              <button
                type="button"
                className="lq-chart__indicator-legend-action"
                onClick={() => removeIndicator(indicator.id)}
                aria-label={`Supprimer ${indicatorLabel(indicator)}`}
                title="Supprimer"
              >
                <TrashIcon size={LEGEND_ICON} />
              </button>
              <IndicatorLegendMenu
                label={indicatorLabel(indicator)}
                // Pas d'alerte sur un indicateur de zones : il n'a pas de valeur à franchir.
                canAlert={indicator.customData?.draw !== "zones" && indicator.customData?.draw !== "boxes"}
                hasAlert={alertedIndicatorIds.has(indicator.id)}
                hidden={indicator.hidden === true}
                onAlert={() => onOpenIndicatorAlert(indicator)}
                onCopy={copyIndicator ? () => copyIndicator(indicator.id) : undefined}
                onToggleHidden={() => toggleIndicatorHidden(indicator.id)}
                onRemove={() => removeIndicator(indicator.id)}
                onSettings={() => openIndicatorSettings(indicator.id)}
                onInfo={infoAction(indicator, () => infoTargetFor(indicator))}
              />
            </div>
          </div>
          );
        })}
      </div>
      {/* Replier la liste, comme sur les plateformes de marché : un chevron discret sous elle ; repliée, un bouton
          « ˅ N » (le nombre de lignes masquées) la redéplie. Le symbole et l'OHLC, au-dessus, restent. */}
      {legendEntryCount > 0 && (
        <button
          type="button"
          className={["lq-chart__indicator-legend-fold", legendFolded && "lq-chart__indicator-legend-fold--folded"].filter(Boolean).join(" ")}
          onClick={toggleLegendFolded}
          aria-expanded={!legendFolded}
          aria-label={legendFolded ? `Déplier la liste des indicateurs (${legendEntryCount})` : "Replier la liste des indicateurs"}
          title={legendFolded ? legendNames.join(" · ") : "Replier la liste des indicateurs"}
          data-legend-fold=""
        >
          {/* Liste verticale : « ^ » la replie vers le haut, « ⌄ N » la redéplie (les panneaux, en ligne, gardent ‹ / ›). */}
          {legendFolded ? <ChevronDownIcon size={11} /> : <ChevronUpIcon size={11} />}
          {legendFolded && <span>{legendEntryCount}</span>}
        </button>
      )}
      </>
      )}
      {/* Mode d'affichage d'un symbole comparé : mêmes options et même présentation que celui de la série
          principale (paramètres du graphique). Sans cours d'ouverture, plus haut et plus bas, seule la
          ligne de clôture peut être tracée. Un clic en dehors de la fenêtre la ferme. */}
      {modeDrawing && (
        <Modal open onClose={() => setModeFor(null)} title={`Mode d'affichage — ${drawingLabel(modeDrawing)}`} footer={null}>
          <div className="lq-chart__display-mode-menu">
            {CHART_DISPLAY_MODES.map((entry) => {
              const current = (modeDrawing.overlayDisplayMode ?? "line") === entry.mode;
              const disabled = entry.mode !== "line" && !modeHasOHLC;
              return (
                <button
                  key={entry.mode}
                  type="button"
                  className={["lq-chart__display-mode-option", current && "lq-chart__display-mode-option--selected"].filter(Boolean).join(" ")}
                  aria-pressed={current}
                  disabled={disabled}
                  title={disabled ? "Ce symbole n'a que des cours de clôture : seule la ligne de clôture peut être tracée" : undefined}
                  onClick={() => {
                    commitDrawings(drawings.map((d) => (d.id === modeDrawing.id ? { ...d, overlayDisplayMode: entry.mode } : d)));
                    setModeFor(null);
                  }}
                >
                  <entry.icon size={15} />
                  {entry.label}
                </button>
              );
            })}
          </div>
          {!modeHasOHLC && <p className="lq-chart__settings-hint">Ce symbole n'a que des cours de clôture : seule la ligne de clôture peut être tracée.</p>}
        </Modal>
      )}
    </div>
  );
}

/** Taille des icônes d'action d'une ligne d'indicateur de la légende (et des en-têtes de panneaux, voir PaneHeaders). */
export const LEGEND_ICON = 14;

/** Action « Informations » d'un indicateur : sa page d'aide (comme le « ? ») pour un indicateur intégré qui en a une,
 *  sinon la fenêtre « À propos » (script, indicateur personnalisé). */
export function useIndicatorInfoAction(onOpenIndicatorInfo: ((target: IndicatorInfoTarget) => void) | undefined) {
  const openHelp = useOpenIndicatorHelp();
  return (indicator: Indicator, target: () => IndicatorInfoTarget): (() => void) | undefined => {
    if (!indicator.customData && openHelp && hasIndicatorHelp(indicator.kind)) return () => openHelp(indicator.kind);
    return onOpenIndicatorInfo ? () => onOpenIndicatorInfo(target()) : undefined;
  };
}

/** Le bouton « … » d'une ligne d'indicateur et son menu : alerte, copier, afficher ou masquer, supprimer, paramètres,
 *  informations. Aussi dans l'en-tête d'un panneau d'indicateur (PaneHeaders). */
export function IndicatorLegendMenu({
  label,
  canAlert,
  hasAlert,
  hidden,
  onAlert,
  onCopy,
  onToggleHidden,
  onRemove,
  onSettings,
  onInfo,
  className = "lq-chart__indicator-legend-action",
}: {
  label: string;
  canAlert: boolean;
  hasAlert: boolean;
  hidden: boolean;
  onAlert: () => void;
  onCopy?: () => void;
  onToggleHidden: () => void;
  onRemove: () => void;
  onSettings: () => void;
  /** « Informations » : la page d'aide de l'indicateur (voir useIndicatorInfoAction). Absent : pas d'entrée. */
  onInfo?: () => void;
  /** Classe du bouton « … » : celle des boutons voisins. */
  className?: string;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  const item = (key: string, icon: ReactNode, text: string, action: () => void, hint?: string) => (
    <button key={key} type="button" role="menuitem" className="lq-chart__indicator-legend-menu-item" onClick={run(action)}>
      {icon}
      <span className="lq-chart__indicator-legend-menu-text">{text}</span>
      {hint && <span className="lq-chart__indicator-legend-menu-hint">{hint}</span>}
    </button>
  );
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={[className, open && "lq-chart__indicator-legend-action--open"].filter(Boolean).join(" ")}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Plus d'options pour ${label}`}
        title="Plus d'options"
      >
        <MoreHorizontalIcon size={LEGEND_ICON} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} placement="bottom" initialFocus>
        <div className="lq-chart__indicator-legend-menu" role="menu" aria-label={`Options de ${label}`}>
          {canAlert && item("alert", <AlarmClockIcon size={14} />, hasAlert ? `Alertes sur ${label}` : `Ajouter une alerte sur ${label}`, onAlert)}
          {onCopy && item("copy", <CopyIcon size={14} />, "Copier", onCopy, "Ctrl+V pour coller")}
          {item("toggle", hidden ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />, hidden ? "Afficher" : "Masquer", onToggleHidden)}
          {item("remove", <TrashIcon size={14} />, "Supprimer", onRemove)}
          {item("settings", <SettingsIcon size={14} />, "Paramètres", onSettings)}
          {onInfo && item("info", <InfoIcon size={14} />, "Informations", onInfo)}
        </div>
      </Popover>
    </>
  );
}
