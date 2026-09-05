/** When the engine acts on an order the script placed. Mirrors the four choices a trading platform
 *  normally offers, because the difference between them is the difference between a backtest you
 *  can trust and one you can't:
 *
 *  - `"barClose"` — fill at the close of the bar the order was placed on. The honest default: the
 *    script decided using that bar's own close, so filling at it assumes no information the script
 *    didn't have.
 *  - `"barOpen"` — fill at the *next* bar's open. Stricter still, and closer to how a signal
 *    computed after a bar closes actually gets traded.
 *  - `"historyTick"` / `"realtimeTick"` — evaluate on every tick rather than once per bar, on
 *    historical bars and on the forming bar respectively. This engine replays *bars*, not ticks
 *    (see `ScriptEngineSnapshot`), so both currently behave as `"barClose"`; they are declared here
 *    because the setting is part of the strategy's own contract and hiding two of its four values
 *    until a tick feed exists would be the worse surprise. */
export type StrategyFillTiming = "barClose" | "barOpen" | "historyTick" | "realtimeTick";

/** How the broker's fee is charged. */
export type StrategyCommissionKind = "percent" | "fixed";

/** What a size *means*. The same number 25 is a wildly different order depending on this, which is
 *  why it travels with the number everywhere rather than being assumed:
 *
 *  - `"contracts"` — 25 units of the instrument. Absolute, price-independent.
 *  - `"currency"` — 25 of the account's own currency at risk, converted to units at the fill price.
 *    Sizes consistently in money terms across instruments quoted very differently.
 *  - `"equityPercent"` — 25% of the account's *current* equity. The only one of the three that
 *    compounds: a winning strategy sizes up on its own, a losing one sizes down. */
export type StrategySizeUnit = "contracts" | "currency" | "equityPercent";

/** Everything the backtest needs that the *script* doesn't declare — the account it trades, and the
 *  frictions it trades against. Deliberately settings rather than script code: the same strategy is
 *  meant to be re-tested at a different size, on a different account, with a different broker's
 *  costs, without editing a line of it.
 *
 *  Carried into the worker on the snapshot (see `ScriptEngineSnapshot.strategySettings`) so the
 *  simulation runs bar by bar alongside the script itself, the same way `Variable` values do — one
 *  path, one re-run, no second simulation on the main thread that could drift from it. */
export interface StrategySettings {
  /** What the account starts with, in `currency`. */
  initialCapital: number;
  /** Purely a display unit — this engine never converts anything. The instrument is assumed to be
   *  quoted in it, which is true of the cases this is for (an EUR account trading a EUR-quoted
   *  instrument) and stated plainly rather than silently assumed. */
  currency: string;
  /** The default order size, in `orderSizeUnit` — used whenever a script's own `strategy.long()`/
   *  `short()` doesn't name its own. */
  orderSize: number;
  orderSizeUnit: StrategySizeUnit;
  /** How many entries may be open at once. 1 means an entry while already in a position is
   *  ignored — the usual "one position at a time" model; higher values let a strategy scale in. */
  pyramiding: number;
  commissionKind: StrategyCommissionKind;
  /** Percent of the traded notional, or a flat amount per order, per `commissionKind`. */
  commissionValue: number;
  /** Multiplies the position's own exposure. Split long/short because they are rarely the same
   *  number on a real account. */
  leverageLong: number;
  leverageShort: number;
  /** Price ticks of adverse slippage applied to every fill — the gap between the price a signal
   *  saw and the price it actually got. Converted to money through `tickSize`. */
  slippageTicks: number;
  /** What one tick is worth, in price units. Not derivable from the data (it is an instrument
   *  property, not a property of its candles), so it is a setting like the rest. */
  tickSize: number;
  fillTiming: StrategyFillTiming;
}

/** Sensible for a first run on any instrument: a round account, one position at a time, a
 *  retail-ish 0.1% commission, no leverage, no slippage. Every one of them is meant to be changed —
 *  they exist so a strategy produces a readable equity curve the first time it is opened, not
 *  because any of them is the right answer for a given market.
 *
 *  The size default is a *percentage of equity*, not a contract count, and deliberately so: "1
 *  contract" means a 40 € position on one instrument and a 75 000 € one on another, so on anything
 *  expensive it is refused outright for want of margin and the strategy shows zero trades for
 *  reasons that have nothing to do with its rules. A share of the account is the only unit that
 *  behaves the same whatever the instrument costs. */
export const DEFAULT_STRATEGY_SETTINGS: StrategySettings = {
  initialCapital: 10000,
  currency: "EUR",
  orderSize: 10,
  orderSizeUnit: "equityPercent",
  pyramiding: 1,
  commissionKind: "percent",
  commissionValue: 0.1,
  leverageLong: 1,
  leverageShort: 1,
  slippageTicks: 0,
  tickSize: 0.01,
  fillTiming: "barClose",
};
