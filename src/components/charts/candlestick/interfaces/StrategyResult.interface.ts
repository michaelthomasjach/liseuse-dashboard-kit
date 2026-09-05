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
  /** Entries the account couldn't afford, at its equity and leverage. Reported rather than hidden:
   *  a strategy showing three trades where its author expected three hundred is otherwise
   *  indistinguishable from one whose rules simply never fired. */
  rejectedOrders: number;
}
