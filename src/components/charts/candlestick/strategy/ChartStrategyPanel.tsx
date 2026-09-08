import { useRef, useState } from "react";
import { useChartDimensions } from "../../internal/useChartDimensions";
import { ChevronDownIcon, ChevronUpIcon, CloseIcon, DetachWindowIcon, MaximizeIcon, SettingsIcon } from "../../../icons";
import type { StrategyResult, StrategyTrade } from "../interfaces/StrategyResult.interface";
import type { StrategySettings } from "../interfaces/StrategySettings.interface";
import { StrategyEquityChart } from "./StrategyEquityChart";
import { StrategyDistributionChart } from "./StrategyDistributionChart";
import { StrategyExcursionChart } from "./StrategyExcursionChart";
import { StrategyRobustnessPanel } from "./StrategyRobustnessPanel";
import { StrategyMetricsGrid } from "./StrategyMetricsGrid";
import { StrategySettingsForm } from "./StrategySettingsForm";
import "./ChartStrategyPanel.css";

export interface ChartStrategyPanelProps {
  scriptName: string;
  result: StrategyResult | null;
  /** The script's own error, if its last run threw. Shown here rather than left to the editor: a
   *  strategy that crashed on bar 50 and one that simply never found a signal both render as a flat
   *  line and a grid of zeros, and telling them apart is the difference between debugging the code
   *  and debugging the rules. */
  error: { message: string; line?: number } | null;
  running: boolean;
  settings: StrategySettings;
  onSettingsChange: (next: StrategySettings) => void;
  onClose: () => void;
  formatDate: (date: Date) => string;
  /** Opens this same panel in a modal, and hides the docked one. Absent means the caller does not
   *  offer it, and the button does not appear. */
  onRequestFullscreen?: () => void;
  /** Tears the panel off into a real second browser window, hiding the docked one. */
  onRequestDetach?: () => void;
  /** "bare" drops the collapse/fullscreen/detach/close buttons and lets the panel fill whatever it
   *  is inside — for the modal and the detached window, which supply their own way out and their
   *  own size. The docked pane is "full". */
  chrome?: "full" | "bare";
  /** The moment on the price chart the user is pointing at or has clicked — a fill marker's own
   *  timestamp. Every chart in here calls it out, so "this trade" is one place on screen rather
   *  than something to correlate by eye across three panels. */
  markedTime?: number | null;
  /** Reports which trades the pointer is over in any of these charts, so the price chart above can
   *  point at their own fills — the return trip of `markedTime`. */
  onHoverTrades?: (trades: StrategyTrade[] | null) => void;
  /** How far from `markedTime` still counts as the same fill — half a bar, which only the chart
   *  above knows. */
  markedToleranceMs?: number;
  /** Only seeds the folded-on-a-narrow-chart default below. Everything that actually sizes a chart
   *  in here is measured from this panel's own body instead (see `bodyDims`) — taking it from a
   *  sibling laid the contents out for a width this panel did not have, leaving a strip of empty
   *  panel whenever a docked column narrowed the plot beside it. */
  initialWidth: number;
}

/** Below this the panel starts folded. The same threshold the chart's own mobile rail uses, so a
 *  layout does not change its mind about being narrow between one component and the next. */
const NARROW_PANEL_WIDTH = 640;

/** Starting height, and the floor a drag cannot go below — under this the tab bar and a chart
 *  cannot both be read, so there is nothing left to resize *to*. */
const DEFAULT_PANEL_HEIGHT = 320;
const MIN_PANEL_HEIGHT = 140;
/** What the candles above keep, whatever the drag asks for. A backtest with no chart to read it
 *  against is the one arrangement this panel must not be able to produce. */
const MIN_PLOT_HEIGHT = 120;

/** The equity curve's share of whatever height the body actually has. Derived rather than fixed so
 *  dragging the panel taller makes the curve taller — the reason to drag it in the first place —
 *  while the metrics grid below keeps its own size and scrolls, as it already did. */
function equityChartHeight(bodyHeight: number): number {
  return Math.max(110, Math.min(420, Math.round(bodyHeight * 0.52)));
}

type StrategyTab = "performance" | "distribution" | "excursions" | "robustness" | "trades" | "settings";

/** The strategy tester, docked under the chart where an oscillator pane would sit — which is where
 *  it belongs: it is read *against* the candles above it, not in a window of its own.
 *
 *  Three tabs rather than one long scroll: the equity curve and its headline numbers are what gets
 *  looked at on every run, the trade list is for when one of those numbers is surprising, and the
 *  settings are for between runs. Putting all three on screen at once would leave none of them
 *  enough room in a panel this height. */
export function ChartStrategyPanel({
  scriptName,
  result,
  error,
  running,
  settings,
  onSettingsChange,
  onClose,
  formatDate,
  markedTime = null,
  markedToleranceMs = 0,
  onHoverTrades,
  onRequestFullscreen,
  onRequestDetach,
  chrome = "full",
  initialWidth,
}: ChartStrategyPanelProps) {
  const [tab, setTab] = useState<StrategyTab>("performance");
  // Folded to its header on a narrow chart. At 390px the panel is 41% of the screen, and this app's
  // whole point is trying the *chart* with a finger — opening onto a backtest that has pushed the
  // candles into the top half is the wrong first screen. Seeded from the width rather than watched:
  // it sets the default, and past that the panel is the reader's to open and close.
  const [collapsedState, setCollapsed] = useState(() => initialWidth > 0 && initialWidth < NARROW_PANEL_WIDTH);
  // Folding is a docked-pane affordance: a modal or a window of its own is already "not in the
  // way", and a collapsed one would be an empty frame.
  const collapsed = chrome === "bare" ? false : collapsedState;
  const [height, setHeight] = useState(DEFAULT_PANEL_HEIGHT);
  const sectionRef = useRef<HTMLElement | null>(null);
  // Measured on the body itself rather than passed in: it is the element the charts actually live
  // in, so it reports every reason its size changed — the drag below, a docked column opening or
  // closing beside the plot, the window resizing — with no wiring per cause. Its own box is fixed
  // by the panel's height and scrolls its content (see .lq-strategy__body), so sizing children
  // from it cannot feed back into it.
  const [bodyRef, bodyDims] = useChartDimensions({ top: 0, right: 0, bottom: 0, left: 0 });
  const chartWidth = Math.max(120, bodyDims.width - 24);
  // A second measurement, for the tabs whose content is meant to fill the panel rather than stack
  // up and scroll. An SVG has no `flex: 1` — it needs a number — so the flexible box is measured
  // and its height handed down.
  const [fillRef, fillDims] = useChartDimensions({ top: 0, right: 0, bottom: 0, left: 0 });

  /** How tall this panel may grow, given how much room there is above it right now.
   *
   *  Measured from the gap between this panel's own top and its container's, rather than from the
   *  container's height minus a guess at what else is in it: the panel sits below the whole chart
   *  row — header, plot and any docked columns — and only that gap knows what is actually up
   *  there. Whatever it is, MIN_PLOT_HEIGHT of it survives. */
  function maxHeight(currentHeight: number): number {
    const section = sectionRef.current;
    const parent = section?.parentElement;
    if (!section || !parent) return currentHeight;
    const spaceAbove = section.getBoundingClientRect().top - parent.getBoundingClientRect().top;
    return Math.max(MIN_PANEL_HEIGHT, currentHeight + (spaceAbove - MIN_PLOT_HEIGHT));
  }

  /** Drag the top edge to trade height with everything above. The ceiling is computed at grab
   *  time, so the chart keeps MIN_PLOT_HEIGHT however far the pointer travels. */
  function startResize(e: React.PointerEvent<HTMLDivElement>) {
    if (collapsed) return;
    e.preventDefault();
    const handle = e.currentTarget;
    const startY = e.clientY;
    const startHeight = sectionRef.current?.getBoundingClientRect().height ?? height;
    const max = maxHeight(startHeight);
    handle.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      // Dragging up (a smaller clientY) makes the panel taller — it grows from its own top edge.
      setHeight(Math.max(MIN_PANEL_HEIGHT, Math.min(max, startHeight - (ev.clientY - startY))));
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  /** The same resize from the keyboard, since a drag handle is unreachable without a pointer. */
  function onHandleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const max = maxHeight(sectionRef.current?.getBoundingClientRect().height ?? height);
    const step = e.shiftKey ? 48 : 16;
    setHeight((h) => Math.max(MIN_PANEL_HEIGHT, Math.min(max, h + (e.key === "ArrowUp" ? step : -step))));
  }

  const metrics = result?.metrics;
  const headline = metrics ? metrics.totalPnl : 0;

  return (
    <section
      ref={sectionRef}
      className={["lq-strategy", collapsed && "lq-strategy--collapsed", chrome === "bare" && "lq-strategy--filled"].filter(Boolean).join(" ")}
      // Collapsed, the height is the header's own (see .lq-strategy--collapsed) — pinning the
      // dragged height there would leave a tall empty box under a folded title bar.
      style={collapsed || chrome === "bare" ? undefined : { height }}
    >
      {chrome === "full" && (
      <div
        className="lq-strategy__resize"
        onPointerDown={startResize}
        onKeyDown={onHandleKeyDown}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Redimensionner le testeur de stratégie"
        tabIndex={collapsed ? -1 : 0}
      >
        {/* The same two-bar grip every other draggable divider in the chart shows on approach.
            Without it this was a 7px band with no mark on it at all — the drag worked, but nothing
            said it was there, which is indistinguishable from it not working. */}
        <span className="lq-chart__pane-resize-grip" aria-hidden="true" />
      </div>
      )}
      <header className="lq-strategy__header">
        {chrome === "full" && (
        <button
          type="button"
          className="lq-chart__pane-header-action"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Déplier le testeur de stratégie" : "Replier le testeur de stratégie"}
        >
          {collapsed ? <ChevronUpIcon size={13} /> : <ChevronDownIcon size={13} />}
        </button>
        )}
        <span className="lq-strategy__title">{scriptName}</span>
        {/* The one number worth carrying in the header, so a collapsed panel still says how the
            strategy is doing. */}
        {metrics && (
          <span className={`lq-strategy__headline lq-strategy__headline--${headline >= 0 ? "up" : "down"}`} data-optional="">
            {headline >= 0 ? "+" : "−"}
            {Math.abs(headline).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {settings.currency}
          </span>
        )}
        {running && (
          <span className="lq-strategy__status" data-optional="">
            Exécution…
          </span>
        )}
        <nav className="lq-strategy__tabs">
          {(
            [
              ["performance", "Performance"],
              ["distribution", "Distribution"],
              ["excursions", "MAE / MFE"],
              ["robustness", "Robustesse"],
              ["trades", `Trades${result ? ` (${result.trades.length})` : ""}`],
              ["settings", "Réglages"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={["lq-strategy__tab", tab === id && "lq-strategy__tab--active"].filter(Boolean).join(" ")}
              onClick={() => {
                setTab(id);
                setCollapsed(false);
              }}
            >
              {id === "settings" ? <SettingsIcon size={12} /> : null}
              {label}
            </button>
          ))}
        </nav>
        {chrome === "full" && onRequestFullscreen && (
          <button
            type="button"
            className="lq-chart__pane-header-action"
            onClick={onRequestFullscreen}
            aria-label="Ouvrir le testeur de stratégie en plein écran"
            title="Plein écran"
          >
            <MaximizeIcon size={13} />
          </button>
        )}
        {chrome === "full" && onRequestDetach && (
          <button
            type="button"
            className="lq-chart__pane-header-action"
            onClick={onRequestDetach}
            aria-label="Détacher le testeur de stratégie dans une fenêtre"
            title="Détacher dans une fenêtre"
          >
            <DetachWindowIcon size={13} />
          </button>
        )}
        {chrome === "full" && (
          <button type="button" className="lq-chart__pane-header-action" onClick={onClose} aria-label="Fermer le testeur de stratégie">
            <CloseIcon size={13} />
          </button>
        )}
      </header>

      {!collapsed && (
        <div
          ref={bodyRef}
          className={[
            "lq-strategy__body",
            // These two tabs divide the panel between their parts instead of stacking and
            // scrolling; every other one keeps the ordinary flow it has always had.
            (tab === "distribution" || tab === "excursions") && "lq-strategy__body--fill",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {error && (
            <p className="lq-strategy__error">
              Le script a échoué{error.line !== undefined ? ` à la ligne ${error.line}` : ""} : {error.message}
              {result && result.equity.length > 0 ? " — les chiffres ci-dessous ne portent donc que sur les barres rejouées avant l'erreur." : ""}
            </p>
          )}
          {tab === "settings" ? (
            <StrategySettingsForm settings={settings} onChange={onSettingsChange} />
          ) : !result ? (
            <p className="lq-strategy__empty">
              {running ? "Exécution de la stratégie…" : "Aucun résultat : lancez le script pour exécuter la stratégie."}
            </p>
          ) : tab === "distribution" ? (
            <>
              <p className="lq-strategy__hint">
                Combien de trades ont fini où. Les perdants à gauche du zéro, les gagnants à droite — la forme dit ce qu&apos;un taux de
                réussite ne dit pas : 40 % de gagnants n&apos;est pas la même stratégie selon que les pertes sont petites ou énormes. Les deux
                traits pointillés sont la moyenne et la médiane ; l&apos;écart entre eux mesure à quel point un seul trade tire la moyenne.
              </p>
              <div className="lq-strategy__fill" ref={fillRef}>
                <StrategyDistributionChart
                  trades={result.trades}
                  width={chartWidth}
                  height={fillDims.height}
                  markedTime={markedTime}
                  markedToleranceMs={markedToleranceMs}
                  onHoverTrades={onHoverTrades}
                />
              </div>
              <div className="lq-strategy__streaks lq-strategy__streaks--fill">
                <div className="lq-strategy__metric">
                  <span className="lq-strategy__metric-label">Répartition</span>
                  <span className="lq-strategy__metric-value">
                    {result.metrics.winningTrades} / {result.metrics.losingTrades}
                    {result.metrics.breakevenTrades > 0 ? ` / ${result.metrics.breakevenTrades}` : ""}
                  </span>
                  <span className="lq-strategy__metric-hint">
                    gagnants / perdants{result.metrics.breakevenTrades > 0 ? " / nuls" : ""}
                  </span>
                </div>
                <div className="lq-strategy__metric">
                  <span className="lq-strategy__metric-label">Rendement moyen</span>
                  <span
                    className={`lq-strategy__metric-value lq-strategy__metric-value--${(result.metrics.averageReturnPercent ?? 0) >= 0 ? "up" : "down"}`}
                  >
                    {result.metrics.averageReturnPercent === null ? "—" : `${result.metrics.averageReturnPercent.toFixed(2)} %`}
                  </span>
                  <span className="lq-strategy__metric-hint">par trade</span>
                </div>
                <div className="lq-strategy__metric">
                  <span className="lq-strategy__metric-label">Rendement médian</span>
                  <span
                    className={`lq-strategy__metric-value lq-strategy__metric-value--${(result.metrics.medianReturnPercent ?? 0) >= 0 ? "up" : "down"}`}
                  >
                    {result.metrics.medianReturnPercent === null ? "—" : `${result.metrics.medianReturnPercent.toFixed(2)} %`}
                  </span>
                  <span className="lq-strategy__metric-hint">le trade typique</span>
                </div>
                <div className="lq-strategy__metric">
                  <span className="lq-strategy__metric-label">Série de gains</span>
                  <span className="lq-strategy__metric-value lq-strategy__metric-value--up">{result.metrics.maxConsecutiveWins}</span>
                  <span className="lq-strategy__metric-hint">consécutifs, au mieux</span>
                </div>
                <div className="lq-strategy__metric">
                  <span className="lq-strategy__metric-label">Série de pertes</span>
                  <span className="lq-strategy__metric-value lq-strategy__metric-value--down">{result.metrics.maxConsecutiveLosses}</span>
                  <span className="lq-strategy__metric-hint">consécutives, au pire — ce qu&apos;il faut tenir</span>
                </div>
                <div className="lq-strategy__metric">
                  <span className="lq-strategy__metric-label">MAE / MFE moyens</span>
                  <span className="lq-strategy__metric-value">
                    {result.metrics.averageAdverseExcursion === null
                      ? "—"
                      : `${result.metrics.averageAdverseExcursion.toFixed(2)} / ${(result.metrics.averageFavorableExcursion ?? 0).toFixed(2)}`}
                  </span>
                  <span className="lq-strategy__metric-hint">par trade, en {settings.currency}</span>
                </div>
              </div>
            </>
          ) : tab === "excursions" ? (
            <>
              <p className="lq-strategy__hint">
                Un trade par ligne : à gauche jusqu&apos;où il est allé contre vous (MAE), à droite jusqu&apos;où il est allé pour vous (MFE),
                et le point où vous êtes réellement sorti. Un point loin à gauche de son propre segment est un gain rendu ; un long bras
                gauche, un trade qui a été sous l&apos;eau avant de fonctionner.
              </p>
              <div className="lq-strategy__fill" ref={fillRef}>
                <StrategyExcursionChart
                  trades={result.trades}
                  currency={settings.currency}
                  width={chartWidth}
                  height={fillDims.height}
                  markedTime={markedTime}
                  markedToleranceMs={markedToleranceMs}
                  onHoverTrades={onHoverTrades}
                />
              </div>
            </>
          ) : tab === "robustness" ? (
            <StrategyRobustnessPanel robustness={result.robustness} />
          ) : tab === "trades" ? (
            <StrategyTradesTable result={result} currency={settings.currency} formatDate={formatDate} />
          ) : (
            <>
              <StrategyEquityChart
                equity={result.equity}
                trades={result.trades}
                initialCapital={settings.initialCapital}
                currency={settings.currency}
                width={chartWidth}
                height={equityChartHeight(bodyDims.height)}
                formatDate={formatDate}
                markedTime={markedTime}
                onHoverTrades={onHoverTrades}
              />
              {/* One segment per closed trade, in order — the run's own shape at a glance: a wall of
                  red says "this loses steadily", a red patch says "this broke in one regime". */}
              {result.trades.length > 0 && (
                <div className="lq-strategy__ribbon" aria-hidden="true">
                  {result.trades.map((trade) => (
                    <span
                      key={trade.id}
                      className={`lq-strategy__ribbon-cell lq-strategy__ribbon-cell--${trade.profit >= 0 ? "up" : "down"}`}
                      title={`${trade.profit >= 0 ? "+" : "−"}${Math.abs(trade.profit).toFixed(2)}`}
                    />
                  ))}
                </div>
              )}
              <StrategyMetricsGrid metrics={result.metrics} currency={settings.currency} />
              {result.openPosition && (
                <p className="lq-strategy__open-position">
                  Position encore ouverte : {result.openPosition.direction === "long" ? "long" : "short"}{" "}
                  {result.openPosition.quantity.toFixed(4).replace(/\.?0+$/, "")} @ {result.openPosition.averagePrice.toFixed(2)} ·{" "}
                  <span className={result.openPosition.unrealizedProfit >= 0 ? "lq-strategy__up" : "lq-strategy__down"}>
                    {result.openPosition.unrealizedProfit >= 0 ? "+" : "−"}
                    {Math.abs(result.openPosition.unrealizedProfit).toFixed(2)} {settings.currency}
                  </span>{" "}
                  latents — non comptés dans les statistiques ci-dessus, qui ne portent que sur les trades clôturés.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function StrategyTradesTable({
  result,
  currency,
  formatDate,
}: {
  result: StrategyResult;
  currency: string;
  formatDate: (date: Date) => string;
}) {
  if (result.trades.length === 0) {
    return <p className="lq-strategy__empty">Aucun trade clôturé sur la plage rejouée.</p>;
  }
  return (
    <div className="lq-strategy__trades">
      <div className="lq-strategy__trades-row lq-strategy__trades-row--header">
        <span>#</span>
        <span>Sens</span>
        <span>Entrée</span>
        <span>Sortie</span>
        <span>Taille</span>
        <span>P&L</span>
        <span>%</span>
      </div>
      {result.trades.map((trade, i) => (
        <div className="lq-strategy__trades-row" key={trade.id}>
          <span>{i + 1}</span>
          <span className={trade.direction === "long" ? "lq-strategy__up" : "lq-strategy__down"}>
            {trade.direction === "long" ? "Long" : "Short"}
          </span>
          <span title={trade.entryLabel}>
            {formatDate(new Date(trade.entryTime))} · {trade.entryPrice.toFixed(2)}
          </span>
          <span title={trade.exitLabel}>
            {formatDate(new Date(trade.exitTime))} · {trade.exitPrice.toFixed(2)}
          </span>
          <span>{trade.quantity.toFixed(4).replace(/\.?0+$/, "")}</span>
          <span className={trade.profit >= 0 ? "lq-strategy__up" : "lq-strategy__down"}>
            {trade.profit >= 0 ? "+" : "−"}
            {Math.abs(trade.profit).toFixed(2)} {currency}
          </span>
          <span className={trade.profit >= 0 ? "lq-strategy__up" : "lq-strategy__down"}>{trade.profitPercent.toFixed(2)} %</span>
        </div>
      ))}
    </div>
  );
}
