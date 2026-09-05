import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, CloseIcon, SettingsIcon } from "../../../icons";
import type { StrategyResult } from "../interfaces/StrategyResult.interface";
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
  /** Measured by the panel's own container so the SVG chart can be sized in pixels — an SVG has no
   *  equivalent of `width: 100%` that also reports back what that resolved to. */
  width: number;
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
  width,
}: ChartStrategyPanelProps) {
  const [tab, setTab] = useState<StrategyTab>("performance");
  const [collapsed, setCollapsed] = useState(false);

  const metrics = result?.metrics;
  const headline = metrics ? metrics.totalPnl : 0;

  return (
    <section className={["lq-strategy", collapsed && "lq-strategy--collapsed"].filter(Boolean).join(" ")}>
      <header className="lq-strategy__header">
        <button
          type="button"
          className="lq-chart__pane-header-action"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Déplier le testeur de stratégie" : "Replier le testeur de stratégie"}
        >
          {collapsed ? <ChevronUpIcon size={13} /> : <ChevronDownIcon size={13} />}
        </button>
        <span className="lq-strategy__title">{scriptName}</span>
        {/* The one number worth carrying in the header, so a collapsed panel still says how the
            strategy is doing. */}
        {metrics && (
          <span className={`lq-strategy__headline lq-strategy__headline--${headline >= 0 ? "up" : "down"}`}>
            {headline >= 0 ? "+" : "−"}
            {Math.abs(headline).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {settings.currency}
          </span>
        )}
        {running && <span className="lq-strategy__status">Exécution…</span>}
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
        <button type="button" className="lq-chart__pane-header-action" onClick={onClose} aria-label="Fermer le testeur de stratégie">
          <CloseIcon size={13} />
        </button>
      </header>

      {!collapsed && (
        <div className="lq-strategy__body">
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
              <StrategyDistributionChart trades={result.trades} width={Math.max(120, width - 24)} />
              <div className="lq-strategy__streaks">
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
              <StrategyExcursionChart trades={result.trades} currency={settings.currency} width={Math.max(120, width - 24)} />
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
                width={Math.max(120, width - 24)}
                height={150}
                formatDate={formatDate}
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
