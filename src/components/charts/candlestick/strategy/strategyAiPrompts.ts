import type { StrategyResult } from "../interfaces/StrategyResult.interface";
import type { StrategySettings } from "../interfaces/StrategySettings.interface";

export interface StrategyAiPrompt {
  id: string;
  /** What the chip says — short enough to read at a glance in a row of them. */
  label: string;
  /** What is actually asked, before the backtest's own numbers are appended. */
  question: string;
}

/** The questions worth asking about a backtest, written out so nobody has to.
 *
 *  Each one is a real question about *this* run rather than a prompt template with blanks: the
 *  numbers travel separately (see `strategyAiRequest`), which is what lets the same five chips
 *  stand in front of any strategy without being rewritten per script. They are ordered the way a
 *  result is actually read — is it real, why does it lose, what would fix it, what breaks it — so
 *  the row doubles as a suggestion of where to start. */
export const STRATEGY_AI_PROMPTS: StrategyAiPrompt[] = [
  {
    id: "verdict",
    label: "Ce résultat est-il exploitable ?",
    question:
      "Ce backtest est-il exploitable en l'état ? Dis-moi franchement si les chiffres tiennent la route, ce qui te paraît suspect, et ce qui manque pour en juger.",
  },
  {
    id: "improve",
    label: "Trois pistes d'amélioration",
    question:
      "Propose trois modifications concrètes des règles pour améliorer ce résultat, classées par gain attendu. Pour chacune : ce qu'elle change, pourquoi tu penses que ça aide ici, et ce qu'elle risque de coûter.",
  },
  {
    id: "drawdown",
    label: "Réduire le drawdown",
    question:
      "Comment réduire le drawdown maximal de cette stratégie sans détruire son rendement ? Sois précis sur les règles de sortie et de dimensionnement.",
  },
  {
    id: "losers",
    label: "Pourquoi les trades perdants perdent",
    question:
      "Qu'est-ce que les trades perdants ont en commun, d'après les chiffres dont tu disposes ? Quelle règle d'entrée ou de sortie les filtrerait, et laquelle des deux vaut mieux ?",
  },
  {
    id: "overfit",
    label: "Est-elle sur-optimisée ?",
    question:
      "Cette stratégie a-t-elle l'air sur-optimisée ? Dis-moi ce qui te fait pencher d'un côté ou de l'autre, et comment le vérifier concrètement.",
  },
];

function money(value: number, currency: string): string {
  return `${value.toFixed(2)} ${currency}`;
}

/** The backtest as a few lines of plain text, appended to whichever question was clicked.
 *
 *  Sent with the question rather than left for the model to fetch: the assistant's tools read the
 *  *chart* — candles, indicators, drawings — and a backtest is none of those. Without this it would
 *  be answering about a strategy whose results it cannot see, which is exactly the kind of fluent,
 *  ungrounded answer worth refusing to make possible. */
export function strategyAiRequest(
  prompt: StrategyAiPrompt,
  scriptName: string,
  result: StrategyResult,
  settings: StrategySettings
): string {
  const m = result.metrics;
  const currency = settings.currency;
  const lines = [
    `Stratégie : « ${scriptName} ».`,
    `Capital initial ${money(settings.initialCapital, currency)}, capital final ${money(m.finalEquity, currency)}.`,
    `${m.tradeCount} trades clôturés — ${m.winningTrades} gagnants, ${m.losingTrades} perdants${
      m.breakevenTrades > 0 ? `, ${m.breakevenTrades} nuls` : ""
    }.`,
    `Résultat net ${money(m.totalPnl, currency)} (${m.totalPnlPercent.toFixed(2)} %).`,
    `Taux de réussite ${m.winRate === null ? "—" : `${(m.winRate * 100).toFixed(1)} %`}.`,
    `Facteur de profit ${m.profitFactor === null ? "—" : m.profitFactor.toFixed(2)} (gains bruts ${money(
      m.grossProfit,
      currency
    )}, pertes brutes ${money(m.grossLoss, currency)}).`,
    `Drawdown maximal ${money(m.maxDrawdown, currency)} (${m.maxDrawdownPercent.toFixed(2)} %).`,
    `Meilleur trade ${m.bestTrade === null ? "—" : money(m.bestTrade, currency)}, pire ${
      m.worstTrade === null ? "—" : money(m.worstTrade, currency)
    }.`,
    `Espérance par trade ${m.expectedPayoff === null ? "—" : money(m.expectedPayoff, currency)}.`,
    `Sharpe ${m.sharpeRatio === null ? "—" : m.sharpeRatio.toFixed(2)}, Sortino ${
      m.sortinoRatio === null ? "—" : m.sortinoRatio.toFixed(2)
    }.`,
    `Commissions cumulées ${money(m.totalCommission, currency)} (${m.commissionLoadPercent.toFixed(1)} % des gains bruts).`,
    `Excursion adverse moyenne ${
      m.averageAdverseExcursion === null ? "—" : money(m.averageAdverseExcursion, currency)
    }, favorable moyenne ${m.averageFavorableExcursion === null ? "—" : money(m.averageFavorableExcursion, currency)}.`,
  ];
  if (result.trades.length > 0) {
    const first = result.trades[0];
    const last = result.trades[result.trades.length - 1];
    lines.push(
      `Période couverte : du ${new Date(first.entryTime).toISOString().slice(0, 10)} au ${new Date(last.exitTime)
        .toISOString()
        .slice(0, 10)}.`
    );
  }
  return `${prompt.question}

Voici les résultats du backtest, qui sont la seule source chiffrée dont tu disposes sur cette stratégie — n'invente aucun chiffre qui n'y figure pas, et dis-le quand une question demande une donnée que je ne t'ai pas donnée :
${lines.map((line) => `- ${line}`).join("\n")}

Réponds en français, en cinq phrases au plus par point, sans préambule.`;
}
