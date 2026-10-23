import type { IndicatorInfoTarget } from "../interfaces/IndicatorInfoTarget.interface";
import { infoTargetFor, scriptIdFromIndicatorId } from "../scripting/scriptOutputToCustomIndicatorDef";
import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { ActivityIcon, CodeIcon, EyeIcon, EyeOffIcon, TrashIcon, SettingsIcon, AlarmClockIcon, InfoIcon, ChevronDownIcon, ChevronRightIcon } from "../../../icons";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { OverlayDataPoint, TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import { CHART_DISPLAY_MODES, type ChartDisplayModeDef } from "../chartModes";

/** How many entries the legend carries before it offers to fold. Below this, a control to hide the
 *  list is more chrome than the list itself. */
const LEGEND_FOLD_THRESHOLD = 3;

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
  dims: { margin: { top: number; left: number } };
  /** The price plot's own height, which caps how tall the indicator list may grow (see
   *  `.lq-chart__indicator-legend`). */
  priceHeight: number;
  symbol: string | undefined;
  symbolSearch: boolean;
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
  indicators: Indicator[];
  defaultIndicatorColor: (index: number) => string;
  openIndicatorSettings: (id: string) => void;
  setHoveredIndicatorId: Dispatch<SetStateAction<string | null>>;
  /** Which indicator is hovered right now, from *either* surface — this legend, or the line itself
   *  on the plot (see `useDrawingInteractions`' own `onHoveredIndicatorChange`). One piece of state
   *  for one fact, so pointing at a curve and pointing at its name light up the same row. */
  hoveredIndicatorId: string | null;
  indicatorLabel: (indicator: Indicator) => string;
  toggleIndicatorHidden: (id: string) => void;
  removeIndicator: (id: string) => void;
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
  indicators,
  defaultIndicatorColor,
  openIndicatorSettings,
  setHoveredIndicatorId,
  hoveredIndicatorId,
  indicatorLabel,
  toggleIndicatorHidden,
  removeIndicator,
  alertedIndicatorIds,
  onOpenIndicatorAlert,
  onOpenIndicatorInfo,
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
}: ChartLegendProps) {
  const lineModeEntry = CHART_DISPLAY_MODES.find((m) => m.mode === "line")!;
  // Folded state lives here, not on the chart: it is a way of looking at this list, not a fact
  // about the chart, and nothing outside this component has any use for it.
  const [legendFolded, setLegendFolded] = useState(false);
  // Compared symbols first, indicators after: a symbol is a series of its own, on the same footing
  // as the main one right above, and an indicator added afterwards must not end up between them.
  const legendNames = [...symbolOverlays.map((dr) => drawingLabel(dr)), ...overlayIndicators.map((ind) => indicatorLabel(ind))];
  // Each overlay's series sorted once per change of the overlays, not on every hover move.
  const sortedOverlaySeries = useMemo(
    () => new Map(symbolOverlays.map((dr) => [dr.id, [...(dr.overlayData ?? [])].sort((a, b) => a.date.getTime() - b.date.getTime())])),
    [symbolOverlays],
  );
  const legendEntryCount = legendNames.length;
  return (
    <div
      className="lq-chart__plot-topleft"
      // `--lq-chart-price-height` is what caps the indicator list at half the plot (see
      // .lq-chart__indicator-legend) — passed as a custom property rather than an inline
      // max-height so the "half" lives in the stylesheet with the rest of the rule.
      style={{ top: dims.margin.top + 6, left: dims.margin.left + 6, ["--lq-chart-price-height" as string]: `${priceHeight}px` }}
    >
      <div className={["lq-chart__symbol-info", mobile && "lq-chart__symbol-info--stacked"].filter(Boolean).join(" ")}>
        {/* Its own hoverable zone (background on hover) only once `symbolSearch` opts in —
            otherwise `symbol` still renders, just as inert text, same as before this
            existed. Double-click only (not single), matching the chart-type label right
            next to it — deliberately NOT also wired to onClick: Modal's own overlay closes
            on click, covering the full viewport once open, so a single click that opened it
            would leave the *second* click of the same double-click gesture landing on that
            overlay instead of this button, closing the modal again immediately. */}
        {symbol &&
          (symbolSearch ? (
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
        {symbol && <span className="lq-chart__symbol-info-sep">·</span>}
        <button
          type="button"
          className="lq-chart__symbol-info-name lq-chart__symbol-info-name--clickable"
          onDoubleClick={() => setSettingsOpen(true)}
          title="Double-clic : paramètres du graphique"
        >
          {currentModeEntry.label}
        </button>
        {/* Same element, same up/down colour and same tabular figures either way — only how much
            of the candle it spells out changes. The `--stacked` modifier on the row above is what
            actually breaks the line (a full-width flex basis, see charts-shared.css); this span
            stays a plain sibling of the symbol and the mode label rather than moving into a
            wrapper of its own, so nothing about the desktop row's own baseline alignment shifts. */}
        <span className={["lq-chart__symbol-info-ohlc", ohlcDelta >= 0 ? "lq-chart__symbol-info-ohlc--up" : "lq-chart__symbol-info-ohlc--down"].join(" ")}>
          {mobile ? (
            <>
              {pFmt(ohlcCandle.close)} {ohlcSign}
              {pFmt(ohlcDelta)} ({ohlcSign}
              {ohlcDeltaPct.toFixed(2)}%)
            </>
          ) : (
            <>
              O {pFmt(ohlcCandle.open)} H {pFmt(ohlcCandle.high)} L {pFmt(ohlcCandle.low)} C {pFmt(ohlcCandle.close)} {ohlcSign}
              {pFmt(ohlcDelta)} ({ohlcSign}
              {ohlcDeltaPct.toFixed(2)}%)
            </>
          )}
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
      {((showIndicators && overlayIndicators.length > 0) || symbolOverlays.length > 0) && (
      <>
      {/* Past a handful of indicators the list is taller than the chart it annotates. The chevron
          folds every row into one line — the names, separated by dots, nothing else — and the same
          chevron unfolds it. Only offered once folding would actually buy something: with two rows
          on screen, a control to hide them is more chrome than the rows themselves. */}
      {legendEntryCount > LEGEND_FOLD_THRESHOLD && (
        <button
          type="button"
          className="lq-chart__indicator-legend-fold"
          onClick={() => setLegendFolded((folded) => !folded)}
          aria-expanded={!legendFolded}
          title={legendFolded ? "Déplier la liste des indicateurs" : "Replier la liste des indicateurs"}
        >
          {legendFolded ? <ChevronRightIcon size={11} /> : <ChevronDownIcon size={11} />}
          <span>
            {legendFolded ? legendNames.join(" · ") : `${legendEntryCount} indicateurs`}
          </span>
        </button>
      )}
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
              <span className="lq-chart__symbol-info-name lq-chart__overlay-legend-name">{drawingLabel(dr)}</span>
              <span className="lq-chart__symbol-info-sep">·</span>
              <span className="lq-chart__symbol-info-name">{(quote?.hasOHLC ? overlayModeEntry : lineModeEntry).label}</span>
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
        {overlayIndicators.map((indicator) => {
          // The *full* indicators array's own index, not this filtered map's — the canvas
          // draw effect cycles defaultIndicatorColor off that same full-array position (see
          // visibleIndicators.forEach a bit further up), so this has to match it exactly or
          // an indicator's legend swatch and its actual line would disagree on its color the
          // moment an own-pane indicator (filtered out of this list) sits before it.
          const i = indicators.indexOf(indicator);
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
              {indicatorLabel(indicator)}
            </span>
            {/* Invisible until this item is hovered (see charts-shared.css) — double-click
                the label itself opens the settings modal too, so the gear is a discoverable
                shortcut, not the only way in. The bell is the one exception: it stays visible
                even unhovered once this indicator actually has an alert (see
                .lq-chart__indicator-legend-action--alert-active), the same "icon next to it"
                treatment the drawing toolbar's own bell gets. */}
            <div className="lq-chart__indicator-legend-actions">
              <button
                type="button"
                className={[
                  "lq-chart__indicator-legend-action",
                  alertedIndicatorIds.has(indicator.id) && "lq-chart__indicator-legend-action--alert-active",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onOpenIndicatorAlert(indicator)}
                aria-pressed={alertedIndicatorIds.has(indicator.id)}
                aria-label={alertedIndicatorIds.has(indicator.id) ? `Alertes sur ${indicatorLabel(indicator)}` : `Créer une alerte sur ${indicatorLabel(indicator)}`}
              >
                <AlarmClockIcon size={11} />
              </button>
              <button
                type="button"
                className="lq-chart__indicator-legend-action"
                onClick={() => onOpenIndicatorInfo(infoTargetFor(indicator))}
                aria-label={`À propos de ${indicatorLabel(indicator)}`}
              >
                <InfoIcon size={11} />
              </button>
              {/* Beside the "i", same pairing the indicator picker's own rows already use: one
                  button explains what the indicator does, the next shows how it is computed. */}
              {hasIndicatorCode(indicator) && (
                <button
                  type="button"
                  className="lq-chart__indicator-legend-action"
                  onClick={() => onOpenIndicatorCode(indicator)}
                  aria-label={`Voir le code de ${indicatorLabel(indicator)}`}
                  title="Voir le code"
                >
                  <CodeIcon size={11} />
                </button>
              )}
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
                    <ActivityIcon size={11} />
                  </button>
                );
              })()}
              <button
                type="button"
                className="lq-chart__indicator-legend-action"
                onClick={() => toggleIndicatorHidden(indicator.id)}
                aria-label={indicator.hidden ? `Afficher ${indicatorLabel(indicator)}` : `Masquer ${indicatorLabel(indicator)}`}
              >
                {indicator.hidden ? <EyeOffIcon size={11} /> : <EyeIcon size={11} />}
              </button>
              <button
                type="button"
                className="lq-chart__indicator-legend-action"
                onClick={() => removeIndicator(indicator.id)}
                aria-label={`Supprimer ${indicatorLabel(indicator)}`}
              >
                <TrashIcon size={11} />
              </button>
              <button
                type="button"
                className="lq-chart__indicator-legend-action"
                onClick={() => openIndicatorSettings(indicator.id)}
                aria-label={`Paramètres ${indicatorLabel(indicator)}`}
              >
                <SettingsIcon size={11} />
              </button>
            </div>
          </div>
          );
        })}
      </div>
      </>
      )}
    </div>
  );
}
