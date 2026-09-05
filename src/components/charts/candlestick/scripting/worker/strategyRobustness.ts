import type { StrategyRobustness, StrategyRobustnessComponent } from "../../interfaces/StrategyRobustness.interface";
import type { StrategySettings } from "../../interfaces/StrategySettings.interface";
import type { StrategyTrade } from "../../interfaces/StrategyResult.interface";

/** Minimum closed trades before an axis is worth scoring. Below it the answer is noise dressed as a
 *  measurement, and reporting "not measured" is the more useful output. */
const MIN_TRADES = 8;
const MIN_TRADES_PER_GROUP = 3;

const clamp = (value: number) => Math.max(0, Math.min(100, value));

/** What a strategy made before costs — the trades' own gross, recovered from the net result and the
 *  commission that was charged. This is what lets cost sensitivity be answered by arithmetic rather
 *  than by another simulation. */
const grossOf = (trade: StrategyTrade) => trade.profit + trade.commission;

/** Total P&L if commission had been `multiple` times what it was. The prices are known, so the fee
 *  at any rate is known; nothing about the *rules* changes with the fee, so no re-run is needed. */
function pnlAtCommission(trades: StrategyTrade[], multiple: number): number {
  return trades.reduce((sum, t) => sum + grossOf(t) - t.commission * multiple, 0);
}

/** Total P&L with `extraTicks` more adverse slippage on each leg. Adverse on both sides, so a round
 *  trip loses twice the tick value times the size. */
function pnlAtSlippage(trades: StrategyTrade[], extraTicks: number, tickSize: number): number {
  const cost = extraTicks * tickSize * 2;
  return trades.reduce((sum, t) => sum + t.profit - cost * t.quantity, 0);
}

/** How much of the base result survives a stress, as 0-100. Full marks for keeping everything,
 *  nothing for giving it all back — and the linear middle, because any curve here would be invented
 *  precision. */
const survival = (stressed: number, base: number) => clamp((stressed / base) * 100);

/** Directional efficiency of a stretch of closes: how much of the distance travelled ended up as
 *  net movement. Near 1 the market went somewhere in a straight line; near 0 it churned. The
 *  cheapest honest separator of "trending" from "ranging", and one computed from the very bars the
 *  trade was actually exposed to rather than from a global regime label. */
function directionalEfficiency(closes: number[]): number {
  if (closes.length < 2) return 0;
  let travelled = 0;
  for (let i = 1; i < closes.length; i++) travelled += Math.abs(closes[i] - closes[i - 1]);
  return travelled > 0 ? Math.abs(closes[closes.length - 1] - closes[0]) / travelled : 0;
}

export function computeStrategyRobustness(
  trades: StrategyTrade[],
  settings: StrategySettings,
  bars: { t: number; c: number }[]
): StrategyRobustness {
  const totalPnl = trades.reduce((sum, t) => sum + t.profit, 0);
  const components: StrategyRobustnessComponent[] = [];

  // Two axes this engine structurally cannot answer from one backtest. Listed anyway: their absence
  // is part of what the score means, and a reader who does not know they are missing will over-read
  // the number that remains.
  const unmeasurable: StrategyRobustnessComponent[] = [
    {
      id: "parameters",
      label: "Stabilité des paramètres",
      score: null,
      detail: "Demande de rejouer la stratégie sur une grille de valeurs de ses Variables — plusieurs exécutions, pas une.",
    },
    {
      id: "assets",
      label: "Stabilité des actifs",
      score: null,
      detail: "Demande les données d'autres instruments, que cette bibliothèque ne fournit jamais d'elle-même.",
    },
  ];

  if (trades.length < MIN_TRADES) {
    return {
      score: null,
      unavailableReason: `Seulement ${trades.length} trade${trades.length > 1 ? "s" : ""} clôturé${trades.length > 1 ? "s" : ""} : en dessous de ${MIN_TRADES}, mesurer la solidité reviendrait à mesurer du bruit.`,
      components: unmeasurable,
    };
  }
  if (totalPnl <= 0) {
    return {
      score: null,
      unavailableReason:
        "La stratégie n'est pas rentable dans sa configuration de base : il n'y a pas de performance dont mesurer la solidité. Rendez-la profitable d'abord, la robustesse ensuite.",
      components: unmeasurable,
    };
  }

  // ── Commissions ────────────────────────────────────────────────────────────────────────────
  const doubled = pnlAtCommission(trades, 2);
  components.push({
    id: "commission",
    label: "Sensibilité aux commissions",
    score: survival(doubled, totalPnl),
    detail: `À commission doublée, il reste ${doubled.toFixed(2)} sur ${totalPnl.toFixed(2)} (${((doubled / totalPnl) * 100).toFixed(0)} %).`,
  });

  // ── Slippage ───────────────────────────────────────────────────────────────────────────────
  const slipped = pnlAtSlippage(trades, 2, settings.tickSize);
  components.push({
    id: "slippage",
    label: "Sensibilité au slippage",
    score: survival(slipped, totalPnl),
    detail: `À +2 ticks défavorables par exécution, il reste ${slipped.toFixed(2)} sur ${totalPnl.toFixed(2)} (${((slipped / totalPnl) * 100).toFixed(0)} %).`,
  });

  // ── Coûts, les deux à la fois ──────────────────────────────────────────────────────────────
  const bothStressed = trades.reduce(
    (sum, t) => sum + grossOf(t) - t.commission * 2 - 2 * settings.tickSize * 2 * t.quantity,
    0
  );
  components.push({
    id: "costs",
    label: "Stabilité des coûts",
    score: survival(bothStressed, totalPnl),
    detail: `Commission doublée et slippage doublé ensemble : ${bothStressed.toFixed(2)} restant. Recalculé sur les trades existants — à coûts réels différents, un dimensionnement en % d'équité aurait aussi bougé les tailles, donc c'est une borne optimiste.`,
  });

  // ── Stabilité temporelle ───────────────────────────────────────────────────────────────────
  // Four consecutive quarters by trade count, not by calendar: the question is whether the edge
  // held as it traded, and calendar quarters of a sparse strategy can be empty.
  const quarterSize = Math.floor(trades.length / 4);
  const quarters = [0, 1, 2, 3].map((q) =>
    trades.slice(q * quarterSize, q === 3 ? trades.length : (q + 1) * quarterSize).reduce((sum, t) => sum + t.profit, 0)
  );
  const profitableQuarters = quarters.filter((p) => p > 0).length;
  components.push({
    id: "time",
    label: "Stabilité temporelle",
    score: (profitableQuarters / 4) * 100,
    detail: `${profitableQuarters} quart${profitableQuarters > 1 ? "s" : ""} sur 4 rentable${profitableQuarters > 1 ? "s" : ""} (${quarters.map((p) => p.toFixed(0)).join(", ")}).`,
  });

  // ── Stabilité des régimes ──────────────────────────────────────────────────────────────────
  // Trades close in order and bars are already sorted, so one cursor walks both lists once instead
  // of re-filtering every bar per trade — which on a real run is a few hundred trades against a few
  // thousand bars, i.e. a million comparisons repeated on every re-run of the script.
  const trending: StrategyTrade[] = [];
  const ranging: StrategyTrade[] = [];
  let cursor = 0;
  for (const trade of trades) {
    while (cursor > 0 && bars[cursor - 1].t >= trade.entryTime) cursor--;
    while (cursor < bars.length && bars[cursor].t < trade.entryTime) cursor++;
    const closes: number[] = [];
    for (let i = cursor; i < bars.length && bars[i].t <= trade.exitTime; i++) closes.push(bars[i].c);
    (directionalEfficiency(closes) > 0.3 ? trending : ranging).push(trade);
  }
  const sum = (list: StrategyTrade[]) => list.reduce((s, t) => s + t.profit, 0);
  if (trending.length < MIN_TRADES_PER_GROUP || ranging.length < MIN_TRADES_PER_GROUP) {
    components.push({
      id: "regime",
      label: "Stabilité des régimes",
      score: null,
      detail: `Trop peu de trades dans l'un des deux régimes (${trending.length} en tendance, ${ranging.length} en range) pour comparer.`,
    });
  } else {
    const both = [sum(trending), sum(ranging)];
    const profitable = both.filter((p) => p > 0).length;
    components.push({
      id: "regime",
      label: "Stabilité des régimes",
      score: (profitable / 2) * 100,
      detail: `Tendance : ${both[0].toFixed(0)} sur ${trending.length} trades · Range : ${both[1].toFixed(0)} sur ${ranging.length}.`,
    });
  }

  const measured = components.filter((c): c is StrategyRobustnessComponent & { score: number } => c.score !== null);
  return {
    // The mean of what was actually looked at — never of the axes that were not.
    score: measured.length > 0 ? Math.round(measured.reduce((s, c) => s + c.score, 0) / measured.length) : null,
    unavailableReason: null,
    components: [...components, ...unmeasurable],
  };
}
