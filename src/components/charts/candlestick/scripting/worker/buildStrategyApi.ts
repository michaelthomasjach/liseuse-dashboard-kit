import type { StrategySettings, StrategySizeUnit } from "../../interfaces/StrategySettings.interface";
import type { StrategyEquityPoint, StrategyMetrics, StrategyResult, StrategyTrade } from "../../interfaces/StrategyResult.interface";
import type { ScriptDrawingOutput } from "../interfaces/ScriptRunResult.interface";

export interface StrategyEntryOptions {
  /** How much to trade, read through `unit`. Omitted, the strategy pane's own default size is used
   *  — so a script that doesn't care about sizing never has to mention it, and one that does can
   *  override it per rule without touching the settings. */
  size?: number;
  /** What `size` counts in (see `StrategySizeUnit`): contracts, account currency, or percent of
   *  current equity. Defaults to the pane's own setting, so `{ size: 2 }` means "two of whatever
   *  the account is already sized in" rather than silently switching units. */
  unit?: StrategySizeUnit;
}

/** `strategy.*` — the API a `@strategy` script uses to take positions. Deliberately small: four
 *  verbs and three readers. Everything else a trading platform's own strategy API offers (stops,
 *  limits, brackets) is a layer on top of these, and adding them before the simple case is proven
 *  would be guessing at semantics nobody has exercised yet. */
export interface StrategyApi {
  /** Opens (or adds to) a long position. Ignored when `pyramiding` entries are already open, and
   *  when the position is short it is reversed: closed, then opened the other way, which is what
   *  "go long" means to anyone reading it. `comment` labels the trade and the marker dropped on the
   *  chart; `options` sizes it (see `StrategyEntryOptions`). */
  long(comment?: string, options?: StrategyEntryOptions): void;
  short(comment?: string, options?: StrategyEntryOptions): void;
  /** Closes everything currently open, at this bar's fill price. A no-op when flat. */
  close(comment?: string): void;
  /** Current position: `"long"`, `"short"`, or `"flat"`. */
  position(): "long" | "short" | "flat";
  /** Units currently held — always positive; `position()` carries the direction. */
  positionSize(): number;
  /** Average price the open position was entered at, or `null` when flat. */
  averagePrice(): number | null;
  /** Profit of the open position marked to the current bar's close, or 0 when flat. */
  unrealizedProfit(): number;
}

interface OpenLot {
  direction: "long" | "short";
  quantity: number;
  price: number;
  time: number;
  label?: string;
  /** The commission charged when this lot opened. Carried on the lot rather than recomputed at
   *  close: the *reported* profit of a round trip has to be net of both sides, and recomputing the
   *  entry fee from the entry price would silently diverge the moment the commission setting
   *  changes mid-nothing — but more importantly, keeping it is what makes `sum(trade.profit)` equal
   *  the account's own change. They disagreed before this: cash was debited the entry fee at open,
   *  while the trade only ever subtracted the exit fee. */
  entryFee: number;
}

/** Builds the `strategy.*` API together with the simulation behind it.
 *
 *  The simulation is not a second pass over recorded orders: it advances with the script itself,
 *  one bar at a time, because that is the only arrangement in which a strategy cannot see a price
 *  it wouldn't have had. An order placed on bar `i` fills at bar `i`'s own close (or `i+1`'s open,
 *  per `fillTiming`) and at nothing else — there is no point in the run where a later bar is
 *  reachable, so look-ahead is structurally impossible here exactly as it is for `market.*`.
 *
 *  `settleBar` is what the runner calls after each bar's own script pass: it applies any fill the
 *  script asked for and records the account's value. Keeping those two in one place is what keeps
 *  the equity curve and the trade list from ever disagreeing. */
export function buildStrategyApi(settings: StrategySettings, getBar: () => { t: number; o: number; c: number } | null) {
  const lots: OpenLot[] = [];
  const trades: StrategyTrade[] = [];
  const equity: StrategyEquityPoint[] = [];
  const markers: ScriptDrawingOutput[] = [];
  let cash = settings.initialCapital;
  let totalCommission = 0;
  let peak = settings.initialCapital;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let tradeSeq = 0;
  let rejectedOrders = 0;
  // Orders placed during the current bar's own pass, applied by settleBar below rather than
  // immediately: a script that goes long and then closes within the same bar must not produce two
  // fills at two different prices, because there is only one price on that bar to fill at.
  let pending: { kind: "long" | "short" | "close"; size: number; unit: StrategySizeUnit; label?: string }[] = [];

  const commissionFor = (notional: number) =>
    settings.commissionKind === "percent" ? (Math.abs(notional) * settings.commissionValue) / 100 : Math.abs(settings.commissionValue);

  /** Adverse by construction: a buy fills above the price the signal saw, a sell below it. Slippage
   *  that could help you is not slippage. */
  const slip = (price: number, side: "buy" | "sell") =>
    price + (side === "buy" ? 1 : -1) * settings.slippageTicks * settings.tickSize;

  /** Leverage bounds how much exposure the account may carry — it does *not* multiply what a
   *  position of a given size earns. An earlier version multiplied the P&L, which double-counts:
   *  the size is already whatever the script asked for, so scaling its result too reports gains no
   *  account could have made. See `affordable` below for where it actually applies. */
  const leverageFor = (direction: "long" | "short") =>
    Math.max(1, direction === "long" ? settings.leverageLong : settings.leverageShort);

  /** Whether the account can carry this much more exposure. Without it a strategy quietly trades a
   *  notional its capital could never cover — on a BTC-priced instrument, a "1 contract" order is
   *  75 000 against a 10 000 account — and every figure downstream describes an account that could
   *  not exist. Rejecting is the honest outcome, and `rejectedOrders` is why: a strategy that takes
   *  no trade because it can afford none must say so, not look like a strategy with no signals. */
  function affordable(direction: "long" | "short", quantity: number, price: number, markPrice: number): boolean {
    const equityNow = cash + markToMarket(markPrice);
    if (equityNow <= 0) return false;
    const exposure = lots.reduce((sum, lot) => sum + lot.price * lot.quantity, 0) + price * quantity;
    return exposure <= equityNow * leverageFor(direction);
  }

  function openLot(direction: "long" | "short", quantity: number, rawPrice: number, time: number, label?: string) {
    if (quantity <= 0) return;
    const price = slip(rawPrice, direction === "long" ? "buy" : "sell");
    const fee = commissionFor(price * quantity);
    cash -= fee;
    totalCommission += fee;
    lots.push({ direction, quantity, price, time, label, entryFee: fee });
    markers.push({
      kind: "point",
      date: time,
      price,
      // The circled badge (see drawMarkers.ts) rather than an arrow: an entry and its exit are two
      // ends of one thing, and a shape that reads as a marker-with-a-label carries the size and
      // price a bare arrow can't.
      shape: "pin",
      // No colour: the worker has no theme, and a hex baked in here would ignore the palette the
      // chart is actually drawn in. `markerSide` names the *meaning* and drawMarkers.ts resolves it
      // against the same colorUp/colorDown the candles use.
      markerSide: direction === "long" ? "long" : "short",
      text: `${direction === "long" ? "Achat" : "Vente"} ${quantity} @ ${price.toFixed(2)}${label ? ` · ${label}` : ""}`,
    });
  }

  function closeLots(rawPrice: number, time: number, label?: string) {
    for (const lot of lots) {
      const price = slip(rawPrice, lot.direction === "long" ? "sell" : "buy");
      const fee = commissionFor(price * lot.quantity);
      const gross = (lot.direction === "long" ? price - lot.price : lot.price - price) * lot.quantity;
      // Net of *both* sides, so the trade list adds up to the equity curve.
      const profit = gross - fee - lot.entryFee;
      cash += gross - fee;
      totalCommission += fee;
      const notional = lot.price * lot.quantity;
      trades.push({
        id: `trade-${tradeSeq++}`,
        direction: lot.direction,
        entryTime: lot.time,
        entryPrice: lot.price,
        exitTime: time,
        exitPrice: price,
        quantity: lot.quantity,
        profit,
        profitPercent: notional > 0 ? (profit / notional) * 100 : 0,
        entryLabel: lot.label,
        exitLabel: label,
        // The entry's own fee was charged when it opened; this is the round trip's total.
        commission: fee + lot.entryFee,
      });
      markers.push({
        kind: "point",
        date: time,
        price,
        shape: "pin",
        markerSide: profit >= 0 ? "win" : "loss",
        text: `Sortie ${lot.quantity} @ ${price.toFixed(2)} · ${profit >= 0 ? "+" : ""}${profit.toFixed(2)}`,
      });
    }
    lots.length = 0;
  }

  /** Turns a size expressed in any of the three units into contracts, at the moment of the fill —
   *  which is the only moment two of them mean anything, since both need a price and one needs the
   *  account's current equity. Resolving at order time instead would silently size against whatever
   *  the previous bar happened to leave behind.
   *
   *  A non-finite or non-positive result is 0, i.e. no order: a division by a zero price, or an
   *  equity that has gone to nothing, should stop the strategy trading rather than produce an
   *  Infinity-sized position that poisons every figure downstream. */
  function resolveQuantity(size: number, unit: StrategySizeUnit, fillPrice: number, markPrice: number): number {
    if (!Number.isFinite(size) || size <= 0 || fillPrice <= 0) return 0;
    const quantity =
      unit === "contracts"
        ? size
        : unit === "currency"
          ? size / fillPrice
          : ((cash + markToMarket(markPrice)) * (size / 100)) / fillPrice;
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  }

  function markToMarket(price: number): number {
    return lots.reduce((sum, lot) => sum + (lot.direction === "long" ? price - lot.price : lot.price - price) * lot.quantity, 0);
  }

  const api: StrategyApi = {
    long: (comment, options) => {
      pending.push({ kind: "long", size: options?.size ?? settings.orderSize, unit: options?.unit ?? settings.orderSizeUnit, label: comment });
    },
    short: (comment, options) => {
      pending.push({ kind: "short", size: options?.size ?? settings.orderSize, unit: options?.unit ?? settings.orderSizeUnit, label: comment });
    },
    close: (comment) => {
      pending.push({ kind: "close", size: 0, unit: "contracts", label: comment });
    },
    position: () => (lots.length === 0 ? "flat" : lots[0].direction),
    positionSize: () => lots.reduce((sum, lot) => sum + lot.quantity, 0),
    averagePrice: () => {
      if (lots.length === 0) return null;
      const size = lots.reduce((sum, lot) => sum + lot.quantity, 0);
      return size === 0 ? null : lots.reduce((sum, lot) => sum + lot.price * lot.quantity, 0) / size;
    },
    unrealizedProfit: () => {
      const bar = getBar();
      return bar ? markToMarket(bar.c) : 0;
    },
  };

  /** Applies this bar's own orders, then records the account's value. `nextOpen` is the following
   *  bar's open, needed only by `fillTiming: "barOpen"` — `null` on the last bar, where there is no
   *  next open and the close is the only honest price left. */
  function settleBar(bar: { t: number; o: number; c: number }, nextBar: { t: number; o: number } | null) {
    // `barOpen` fills on the *next* bar, so the fill's own time is that bar's too — stamping it
    // with the signal bar's would drop the marker one candle left of the price it filled at, and
    // put the trade's entry in the list a bar before it happened.
    const fillOnNext = settings.fillTiming === "barOpen" && nextBar !== null;
    const fillPrice = fillOnNext ? nextBar.o : bar.c;
    const fillTime = fillOnNext ? nextBar.t : bar.t;
    for (const order of pending) {
      if (order.kind === "close") {
        closeLots(fillPrice, fillTime, order.label);
        continue;
      }
      const direction = order.kind;
      // A signal the other way is a reversal, not an addition — closing first is what "go long
      // while short" unambiguously means.
      if (lots.length > 0 && lots[0].direction !== direction) closeLots(fillPrice, fillTime, "Retournement");
      if (lots.length >= Math.max(1, settings.pyramiding)) continue;
      const quantity = resolveQuantity(order.size, order.unit, fillPrice, bar.c);
      if (quantity <= 0) continue;
      if (!affordable(direction, quantity, fillPrice, bar.c)) {
        rejectedOrders++;
        continue;
      }
      openLot(direction, quantity, fillPrice, fillTime, order.label);
    }
    pending = [];

    const value = cash + markToMarket(bar.c);
    peak = Math.max(peak, value);
    const drawdown = peak - value;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;
    }
    equity.push({ time: bar.t, equity: value, peak });
  }

  function getResult(): StrategyResult {
    const bar = getBar();
    const lastClose = bar?.c ?? null;
    const wins = trades.filter((t) => t.profit > 0);
    const losses = trades.filter((t) => t.profit < 0);
    const grossProfit = wins.reduce((s, t) => s + t.profit, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
    const totalPnl = trades.reduce((s, t) => s + t.profit, 0);
    const size = lots.reduce((s, lot) => s + lot.quantity, 0);
    const metrics: StrategyMetrics = {
      totalPnl,
      totalPnlPercent: settings.initialCapital > 0 ? (totalPnl / settings.initialCapital) * 100 : 0,
      maxDrawdown,
      maxDrawdownPercent,
      tradeCount: trades.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: trades.length > 0 ? wins.length / trades.length : null,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
      averageProfit: trades.length > 0 ? totalPnl / trades.length : null,
      bestTrade: trades.length > 0 ? Math.max(...trades.map((t) => t.profit)) : null,
      worstTrade: trades.length > 0 ? Math.min(...trades.map((t) => t.profit)) : null,
      grossProfit,
      grossLoss,
      totalCommission,
      commissionLoadPercent: grossProfit > 0 ? (totalCommission / grossProfit) * 100 : 0,
      expectedPayoff: trades.length > 0 ? totalPnl / trades.length : null,
      finalEquity: equity.length > 0 ? equity[equity.length - 1].equity : settings.initialCapital,
      rejectedOrders,
    };
    return {
      trades,
      equity,
      openPosition:
        lots.length > 0 && lastClose !== null
          ? {
              direction: lots[0].direction,
              quantity: size,
              averagePrice: api.averagePrice() ?? lots[0].price,
              unrealizedProfit: markToMarket(lastClose),
            }
          : null,
      metrics,
    };
  }

  return { api, settleBar, getResult, getMarkers: () => markers };
}
