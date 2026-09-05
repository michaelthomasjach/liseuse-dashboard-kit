/** One axis of the robustness score, kept separately from the total rather than folded into it —
 *  a bare "82/100" says nothing a reader can act on, whereas "82, and the weak one is slippage"
 *  says exactly what to look at next. */
export interface StrategyRobustnessComponent {
  id: string;
  label: string;
  /** 0-100, or `null` when this axis could not be measured at all. The two are very different
   *  claims and the UI shows them differently: a 0 means "measured, and it fails", a `null` means
   *  "this engine cannot answer that from one backtest" — see `reason`. */
  score: number | null;
  /** What the number means here, or — when `score` is null — why there isn't one. Shown next to the
   *  axis, because a robustness score whose components are unexplained is a number people either
   *  over-trust or ignore. */
  detail: string;
}

/** How much of a strategy's result survives being poked at.
 *
 *  A deliberate and important limitation, stated here rather than buried: this is computed from a
 *  *single* backtest. Three of the axes a full robustness study would use — parameter stability,
 *  behaviour on other instruments, and walk-forward — need the strategy re-run many times over
 *  varied inputs, which this engine has no way to do from one pass. They are reported as
 *  unmeasured rather than quietly left out of the arithmetic or, worse, guessed at: a score that
 *  silently averages over dimensions it never looked at is worse than no score.
 *
 *  What *is* measured is measured honestly. Cost sensitivity is recomputed analytically from the
 *  trade list — the entry and exit prices are known, so a different commission or slippage is
 *  arithmetic, not a new simulation — with the one caveat noted on `costs`. */
export interface StrategyRobustness {
  /** The mean of whatever was actually measured, 0-100. `null` when the strategy is not profitable
   *  in its own base configuration: there is no performance whose solidity could be in question,
   *  and scoring one anyway would invite reading a fragile loser as a robust one. */
  score: number | null;
  /** Why `score` is null, when it is. */
  unavailableReason: string | null;
  components: StrategyRobustnessComponent[];
}
