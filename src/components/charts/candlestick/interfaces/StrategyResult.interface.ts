import type { StrategyRobustness } from "./StrategyRobustness.interface";
/** One completed round trip — an entry and the exit that closed it. The unit every performance
 *  figure below is computed from, kept rather than only its total so the pane can list them and a
 *  future version can chart their distribution without re-running anything. */
export interface StrategyTrade {
  id: string;
  direction: "long" | "short";
  /** Entry and exit, in epoch milliseconds and price. */
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  quantity: number;
  /** Net of commission and slippage on both sides — what the account actually gained or lost. */
  profit: number;
  /** `profit` as a fraction of the entry's own notional, so trades of different sizes compare. */
  profitPercent: number;
  /** What the script named the entry, when it named one (`strategy.entry("Cassure", ...)`) — how a
   *  trade is traced back to the rule that opened it in a strategy with several. */
  entryLabel?: string;
  exitLabel?: string;
  /** How far this trade went against you, and in your favour, while it was open — its Maximum
   *  Adverse and Maximum Favourable Excursion, in money, both as positive magnitudes.
   *
   *  They answer what entry and exit prices cannot: the route between them. A trade that closed at
   *  +50 having first been 400 down is not the same trade as one that walked straight up, and only
   *  MAE tells them apart. MFE against the realised profit says the other half — how much of what
   *  the trade offered was actually taken. */
  maxAdverse: number;
  maxFavorable: number;
  /** Commission charged over the round trip, both sides. Separated out because "the strategy is
   *  profitable before costs and not after" is one of the most useful things a backtest can say. */
  commission: number;
}

/** The account's own value at one bar — cash plus whatever an open position is currently worth.
 *  One point per bar, so the curve lines up with the candles above it. */
export interface StrategyEquityPoint {
  time: number;
  equity: number;
  /** The running peak, which is what makes drawdown readable straight off the chart rather than
   *  needing a second pass. */
  peak: number;
}

/** What a strategy produced over the replay — the numbers the pane shows and the trades behind
 *  them. Empty (not absent) for a script that declared `@strategy` and never took a position: that
 *  is a real, informative outcome, not a missing result. */
export interface StrategyResult {
  trades: StrategyTrade[];
  equity: StrategyEquityPoint[];
  /** Whatever is still open when the replay ends, marked to the last close. Not folded into
   *  `trades` — an open position has no exit, and counting it as one would quietly flatter every
   *  statistic below. */
  openPosition: {
    direction: "long" | "short";
    quantity: number;
    averagePrice: number;
    /** Marked to the last bar's close. */
    unrealizedProfit: number;
  } | null;
  metrics: StrategyMetrics;
  /** How much of the result survives being poked at — see `StrategyRobustness`, including what it
   *  deliberately does not claim to measure. */
  robustness: StrategyRobustness;
}

/** The summary line of a backtest. Every one of these is derived from `trades`/`equity` — kept
 *  precomputed because the pane reads them on every render and the worker has the data in hand
 *  anyway. */
export interface StrategyMetrics {
  /** Realised profit and loss over every closed trade, net of costs. */
  totalPnl: number;
  /** `totalPnl` against the starting capital. */
  totalPnlPercent: number;
  /** The deepest peak-to-trough fall of the equity curve, as money and as a fraction of the peak
   *  it fell from. The single most useful risk number a backtest produces: two strategies with the
   *  same profit are not the same strategy if one of them halved the account on the way. */
  maxDrawdown: number;
  maxDrawdownPercent: number;
  tradeCount: number;
  winningTrades: number;
  losingTrades: number;
  /** Winners over total, as a fraction. `null` with no closed trade — deliberately not 0, which
   *  would read as "never wins" rather than "nothing to measure yet". */
  winRate: number | null;
  /** Gross profit over gross loss. `null` when there is no loss to divide by (an unbeaten strategy,
   *  or no trades at all) — infinity is not a number a reader can act on. */
  profitFactor: number | null;
  /** Mean profit per closed trade, and the best/worst single one. */
  averageProfit: number | null;
  bestTrade: number | null;
  worstTrade: number | null;
  /** The two halves `profitFactor` is the ratio of, kept separately because the ratio alone hides
   *  the scale: 1.2 off a handful of trades and 1.2 off a thousand are not the same evidence. */
  grossProfit: number;
  grossLoss: number;
  /** Annualised return over the volatility of the *equity curve*, bar by bar — not over the spread
   *  of trade outcomes. That distinction is the whole point of the measure: two strategies can
   *  close the same trades at the same prices and still put the account through completely
   *  different rides in between, and it is the ride this prices.
   *
   *  `null` when there is nothing to divide by: fewer than two equity points, or an equity curve
   *  that never moved. Deliberately not 0 — "no volatility" and "no return per unit of volatility"
   *  are different claims, and a strategy that never traded should not be reported as having earned
   *  nothing per unit of risk. */
  sharpeRatio: number | null;
  /** The same ratio against *downside* deviation only. Sharpe punishes a strategy for its good
   *  surprises as much as its bad ones, because standard deviation cannot tell them apart; Sortino
   *  divides by the volatility of losses alone.
   *
   *  So Sortino sits *above* Sharpe for essentially any profitable strategy — with a positive mean
   *  return, a losing bar is further from the mean than it is from zero, so the downside deviation
   *  comes out the smaller of the two. What is worth reading is the **gap between them**: a wide one
   *  says most of the volatility was upside, which costs nothing; a narrow one says the swings were
   *  mostly losses, and that the Sharpe was low for the reason that actually matters. Neither
   *  number says that on its own, which is why both are shown.
   *
   *  `null` on the same grounds as `sharpeRatio`, plus one of its own: a curve that never had a
   *  losing bar has no downside to divide by. Infinity is not a number a reader can act on. */
  sortinoRatio: number | null;
  /** Total commission paid, so the reader can tell a strategy that works from one that only works
   *  for free — and the same figure against gross profit, which is the honest way to read it. */
  totalCommission: number;
  commissionLoadPercent: number;
  /** Mean profit per trade weighted by how often each side happens — win rate x average win minus
   *  loss rate x average loss. What one more trade is worth in expectation, which is the number a
   *  strategy actually lives or dies by. `null` with no closed trade. */
  expectedPayoff: number | null;
  /** Account value at the end — starting capital plus realised P&L plus any open position's own
   *  mark. What the pane's own headline figure shows. */
  finalEquity: number;
  /** The worst adverse excursion any single trade went through, and the best favourable one — the
   *  headline of the MAE/MFE tab. The first sizes the heat the strategy asks you to sit through,
   *  which is what a stop would have to clear; the second, against the average result, says how
   *  much of what it offered is being left behind. `null` with no closed trade. */
  worstAdverseExcursion: number | null;
  bestFavorableExcursion: number | null;
  /** The same two excursions averaged over every closed trade. The maxima say what the strategy is
   *  capable of putting you through; these say what it routinely does — and a stop has to survive
   *  the second far more often than the first. */
  averageAdverseExcursion: number | null;
  averageFavorableExcursion: number | null;
  /** Mean and median trade result, as a percentage of the entry's own notional so trades of
   *  different sizes compare.
   *
   *  Both, not one: the mean is what compounds, but it is dragged around by a single outlier, and a
   *  strategy whose mean is positive only because of one enormous winner is a different proposition
   *  from one whose median is positive. When they disagree, the gap between them *is* the finding. */
  averageReturnPercent: number | null;
  medianReturnPercent: number | null;
  /** Trades that closed at exactly zero. Counted separately from wins and losses rather than folded
   *  into either — at a commission of zero a scratch is genuinely neither, and silently calling it a
   *  loss would misstate the win rate. */
  breakevenTrades: number;
  /** The longest runs of consecutive winners and losers. What a percentage cannot say: a 40% win
   *  rate spread evenly is a strategy you can hold through, and the same 40% arriving as eleven
   *  losses in a row is one most people abandon before it works. */
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  /** Entries the account couldn't afford, at its equity and leverage. Reported rather than hidden:
   *  a strategy showing three trades where its author expected three hundred is otherwise
   *  indistinguishable from one whose rules simply never fired. */
  rejectedOrders: number;
}
