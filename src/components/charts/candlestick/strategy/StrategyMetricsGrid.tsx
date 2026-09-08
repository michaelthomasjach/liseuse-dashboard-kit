import { memo, useState } from "react";
import { InfoIcon } from "../../../icons";
import { Modal } from "../../../primitives/Modal";
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
/** The explanations behind the "i" buttons. Kept as data next to the cells rather than as tooltips:
 *  a ratio nobody can define is a number people either ignore or over-trust, and the definition is
 *  several sentences long — more than a `title` attribute can carry, and more than a reader should
 *  have to hover to keep on screen while they compare two figures. */
const EXPLANATIONS: Record<string, { title: string; body: string }> = {
  sharpe: {
    title: "Ratio de Sharpe",
    body: "Le rendement annualisé divisé par sa volatilité : combien la stratégie rapporte par unité de risque pris.\n\nIl est calculé sur la courbe d'équité barre par barre, pas sur les trades — un compte est tout aussi exposé entre deux trades que pendant l'un d'eux. L'annualisation est mesurée sur vos propres données (combien de bougies tombent réellement dans une année), pas supposée à 252 ou 365, donc elle est juste aussi bien sur du quotidien que sur du 15 minutes. Un taux sans risque de 0 est supposé.\n\nÀ titre indicatif : au-dessus de 1 le rendement paie le risque, au-dessus de 2 c'est très bon, en dessous de 0 la stratégie perd de l'argent. Attention toutefois : Sharpe pénalise autant les bonnes surprises que les mauvaises, l'écart-type ne sachant pas les distinguer.",
  },
  sortino: {
    title: "Ratio de Sortino",
    body: "Le même rapport que Sharpe, mais divisé par la seule volatilité des pertes.\n\nC'est la correction du défaut de Sharpe : une stratégie qui monte par à-coups est punie par l'écart-type alors que ces à-coups-là ne coûtent rien. Sortino ne compte que la volatilité qui fait mal.\n\nConséquence à connaître : sur une stratégie rentable, Sortino est presque toujours SUPÉRIEUR à Sharpe — avec un rendement moyen positif, une barre perdante est plus loin de la moyenne qu'elle ne l'est de zéro. Ce qu'il faut lire, c'est l'écart entre les deux. Large, la volatilité était surtout haussière et n'a rien coûté. Étroit, les à-coups étaient des pertes, et le Sharpe est bas pour la raison qui compte.",
  },
  drawdown: {
    title: "Drawdown maximum",
    body: "La plus forte baisse du compte entre un sommet et le creux qui l'a suivi, avant qu'un nouveau sommet ne soit atteint.\n\nC'est le chiffre de risque le plus utile d'un backtest, et le plus souvent ignoré : deux stratégies au même profit ne sont pas la même stratégie si l'une a divisé le compte par deux en chemin. C'est aussi ce qu'il faut avoir été capable de traverser sans arrêter la stratégie — la plupart des abandons se font là.",
  },
  profitFactor: {
    title: "Facteur de profit",
    body: "Le profit brut divisé par la perte brute. Au-dessus de 1, la stratégie gagne plus qu'elle ne perd.\n\nLe ratio seul cache l'échelle : 1,2 sur une poignée de trades et 1,2 sur un millier ne sont pas la même preuve. C'est pourquoi le profit brut et la perte brute sont affichés à côté plutôt que résumés à leur seul rapport.",
  },
};

function StrategyMetricsGridImpl({ metrics, currency }: StrategyMetricsGridProps) {
  const [explaining, setExplaining] = useState<string | null>(null);
  const cells: { label: string; value: string; hint?: string; tone?: "up" | "down"; info?: string }[] = [
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
      info: "drawdown",
      tone: metrics.maxDrawdown > 0 ? "down" : undefined,
    },
    {
      label: "Facteur de profit",
      info: "profitFactor",
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
      info: "sharpe",
      value: metrics.sharpeRatio === null ? "—" : metrics.sharpeRatio.toFixed(2),
      hint: "rendement annualisé / volatilité",
      tone: metrics.sharpeRatio === null ? undefined : metrics.sharpeRatio >= 1 ? "up" : metrics.sharpeRatio >= 0 ? undefined : "down",
    },
    {
      label: "Ratio de Sortino",
      info: "sortino",
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
          <span className="lq-strategy__metric-label">
            {cell.label}
            {cell.info && (
              <button
                type="button"
                className="lq-strategy__metric-info"
                onClick={() => setExplaining(cell.info!)}
                aria-label={`Que représente « ${cell.label} » ?`}
                title={`Que représente « ${cell.label} » ?`}
              >
                <InfoIcon size={11} />
              </button>
            )}
          </span>
          <span className={["lq-strategy__metric-value", cell.tone && `lq-strategy__metric-value--${cell.tone}`].filter(Boolean).join(" ")}>
            {cell.value}
          </span>
          {cell.hint && <span className="lq-strategy__metric-hint">{cell.hint}</span>}
        </div>
      ))}
      {explaining && EXPLANATIONS[explaining] && (
        <Modal open onClose={() => setExplaining(null)} title={EXPLANATIONS[explaining].title}>
          <p className="lq-chart__indicator-info-text">{EXPLANATIONS[explaining].body}</p>
        </Modal>
      )}
    </div>
  );
}

/** Nothing in here depends on the cursor: it is the run's own summary. Memoized so moving the pointer over the candles stops re-formatting two dozen figures sixty times a second.
 *
 *  A shallow prop comparison is enough: every prop here is either a primitive or an array/object
 *  the panel already holds stable across renders (it comes from the run result, which only changes
 *  when the script re-runs). */
export const StrategyMetricsGrid = memo(StrategyMetricsGridImpl);
