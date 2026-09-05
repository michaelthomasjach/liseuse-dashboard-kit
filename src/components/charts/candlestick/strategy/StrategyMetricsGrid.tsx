import type { StrategyMetrics } from "../interfaces/StrategyResult.interface";

export interface StrategyMetricsGridProps {
  metrics: StrategyMetrics;
  currency: string;
}

function money(value: number, currency: string): string {
  return `${value >= 0 ? "" : "−"}${Math.abs(value).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function percent(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)} %`;
}

/** The backtest's headline figures. Ordered by what a reader actually decides on: what it made,
 *  what it cost them to hold through, how reliable that was, and only then the accounting.
 *
 *  Every "not enough data" case shows an em dash rather than 0. A profit factor of 0 and a profit
 *  factor that doesn't exist yet are completely different claims, and a grid that renders them
 *  identically is a grid that lies on the first run of every strategy. */
export function StrategyMetricsGrid({ metrics, currency }: StrategyMetricsGridProps) {
  const cells: { label: string; value: string; hint?: string; tone?: "up" | "down" }[] = [
    {
      label: "P&L total",
      value: money(metrics.totalPnl, currency),
      hint: percent(metrics.totalPnlPercent),
      tone: metrics.totalPnl >= 0 ? "up" : "down",
    },
    {
      label: "Drawdown max",
      value: money(-metrics.maxDrawdown, currency),
      hint: `${metrics.maxDrawdownPercent.toFixed(2)} % du pic`,
      tone: metrics.maxDrawdown > 0 ? "down" : undefined,
    },
    {
      label: "Facteur de profit",
      value: metrics.profitFactor === null ? "—" : metrics.profitFactor.toFixed(3),
      hint: metrics.profitFactor === null ? "aucune perte à diviser" : "profit brut / perte brute",
      tone: metrics.profitFactor === null ? undefined : metrics.profitFactor >= 1 ? "up" : "down",
    },
    {
      label: "Trades gagnants",
      value: metrics.tradeCount === 0 ? "—" : `${metrics.winningTrades} / ${metrics.tradeCount}`,
      hint: metrics.winRate === null ? "aucun trade clôturé" : `${(metrics.winRate * 100).toFixed(1)} %`,
    },
    {
      label: "Ratio de Sharpe",
      value: metrics.sharpeRatio === null ? "—" : metrics.sharpeRatio.toFixed(2),
      hint: "rendement annualisé / volatilité",
      tone: metrics.sharpeRatio === null ? undefined : metrics.sharpeRatio >= 1 ? "up" : metrics.sharpeRatio >= 0 ? undefined : "down",
    },
    {
      label: "Ratio de Sortino",
      value: metrics.sortinoRatio === null ? "—" : metrics.sortinoRatio.toFixed(2),
      hint: "idem, volatilité des pertes seules",
      tone: metrics.sortinoRatio === null ? undefined : metrics.sortinoRatio >= 1 ? "up" : metrics.sortinoRatio >= 0 ? undefined : "down",
    },
    { label: "Profit brut", value: money(metrics.grossProfit, currency), tone: "up" },
    { label: "Perte brute", value: money(-metrics.grossLoss, currency), tone: "down" },
    {
      label: "Gain moyen / trade",
      value: metrics.expectedPayoff === null ? "—" : money(metrics.expectedPayoff, currency),
      hint: "espérance par trade",
      tone: metrics.expectedPayoff === null ? undefined : metrics.expectedPayoff >= 0 ? "up" : "down",
    },
    {
      label: "Commissions",
      value: money(metrics.totalCommission, currency),
      hint: `${metrics.commissionLoadPercent.toFixed(2)} % du profit brut`,
    },
    {
      label: "Meilleur trade",
      value: metrics.bestTrade === null ? "—" : money(metrics.bestTrade, currency),
      tone: "up",
    },
    {
      label: "Pire trade",
      value: metrics.worstTrade === null ? "—" : money(metrics.worstTrade, currency),
      tone: "down",
    },
    {
      label: "MAE max",
      value: metrics.worstAdverseExcursion === null ? "—" : money(-metrics.worstAdverseExcursion, currency),
      hint: "pire excursion contre un trade",
      tone: "down",
    },
    {
      label: "MFE max",
      value: metrics.bestFavorableExcursion === null ? "—" : money(metrics.bestFavorableExcursion, currency),
      hint: "meilleure excursion en faveur",
      tone: "up",
    },
    { label: "Équité finale", value: money(metrics.finalEquity, currency) },
    ...(metrics.rejectedOrders > 0
      ? [
          {
            label: "Ordres refusés",
            value: String(metrics.rejectedOrders),
            hint: "marge insuffisante au capital et au levier courants",
            tone: "down" as const,
          },
        ]
      : []),
  ];

  return (
    <div className="lq-strategy__metrics">
      {cells.map((cell) => (
        <div className="lq-strategy__metric" key={cell.label}>
          <span className="lq-strategy__metric-label">{cell.label}</span>
          <span className={["lq-strategy__metric-value", cell.tone && `lq-strategy__metric-value--${cell.tone}`].filter(Boolean).join(" ")}>
            {cell.value}
          </span>
          {cell.hint && <span className="lq-strategy__metric-hint">{cell.hint}</span>}
        </div>
      ))}
    </div>
  );
}
