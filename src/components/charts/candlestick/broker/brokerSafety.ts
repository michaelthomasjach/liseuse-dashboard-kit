import type { BrokerEnvironment, BrokerMarket, BrokerOrderRequest } from "./interfaces/Broker.interface";

/** How a strategy's signals reach the broker.
 *
 *  Three modes rather than a switch, because the two ends are not the same feature with a flag
 *  between them:
 *
 *  - `manual` — a signal pre-fills a ticket and stops there. Nothing is sent without a click.
 *  - `confirm` — a signal raises a pending order with a countdown. Not confirmed before it runs
 *    out, it is dropped. A missed confirmation must never become a late order: the market it was
 *    computed on is gone.
 *  - `auto` — a signal is sent. This is the one that can lose money while nobody is watching, and
 *    everything in `BrokerLimits` exists for it. */
export type BrokerMode = "manual" | "confirm" | "auto";

/** The ceilings every order is checked against, whatever the mode.
 *
 *  They are not advice. An order that breaks one is refused, and in `auto` the breach disarms
 *  automation rather than skipping one order and carrying on — a limit that only ever blocks the
 *  order that hit it leaves the strategy running into the same wall on the next bar. */
export interface BrokerLimits {
  /** Largest size a single order may carry. */
  maxOrderSize: number;
  /** Most orders this library will submit in one day, all strategies together. */
  maxOrdersPerDay: number;
  /** Most the account may be down, in its own currency, before automation stops. Counted from what
   *  the host reports, not from anything this library computes: it does not see fills. */
  maxDailyLoss: number;
  /** Largest risk one order may carry — size × distance to its stop, in the account's currency.
   *  Only checkable when the market reports a tick value *and* the order carries a stop; an order
   *  with no stop is refused outright in `auto` (see `checkOrder`). */
  maxRiskPerOrder: number;
}

export const DEFAULT_BROKER_LIMITS: BrokerLimits = {
  maxOrderSize: 1,
  maxOrdersPerDay: 10,
  maxDailyLoss: 100,
  maxRiskPerOrder: 50,
};

/** What the checks are run against — the day's running totals, kept by `useBrokerState`. */
export interface BrokerDayState {
  /** Orders submitted today, accepted or not: a rejected order still consumed an attempt, and a
   *  strategy that rejects fifty times is exactly what a daily cap is for. */
  ordersToday: number;
  /** The account's realised change today, as the host reported it. Negative is a loss. */
  pnlToday: number;
}

export interface BrokerCheckResult {
  ok: boolean;
  /** Why not, in French, ready to show. Empty when `ok`. */
  problems: string[];
  /** The order's own risk in the account's currency, when it could be worked out. Shown on the
   *  confirmation screen whether or not the check passed — it is the number that decides. */
  risk: number | null;
}

/** The risk an order carries if its stop is hit: size × distance × what a tick is worth.
 *
 *  `null` rather than 0 whenever any part is missing. Zero is a claim — "this order risks
 *  nothing" — and it is never true; a missing tick value must read as *unknown* everywhere it is
 *  shown, or a reader will take the absence for safety. */
export function orderRisk(order: BrokerOrderRequest, market: BrokerMarket, referencePrice: number | null): number | null {
  if (order.stopLoss === undefined) return null;
  if (market.tickValue === undefined || market.tickSize === undefined || market.tickSize <= 0) return null;
  const entry = order.type === "limit" ? order.limitPrice ?? referencePrice : referencePrice;
  if (entry === null || entry === undefined) return null;
  const distance = Math.abs(entry - order.stopLoss);
  if (!Number.isFinite(distance) || distance <= 0) return null;
  return (distance / market.tickSize) * market.tickValue * order.size;
}

/** Every reason this order must not be sent.
 *
 *  Written as one function returning *all* the problems rather than throwing on the first, because
 *  a ticket that reveals one fault at a time is a ticket someone fixes four times. It is also the
 *  single place any of this is decided: the ticket, the confirmation screen and the automatic path
 *  all call it, so none of them can be more permissive than another.
 */
export function checkOrder(args: {
  order: BrokerOrderRequest;
  market: BrokerMarket;
  limits: BrokerLimits;
  day: BrokerDayState;
  mode: BrokerMode;
  referencePrice: number | null;
}): BrokerCheckResult {
  const { order, market, limits, day, mode, referencePrice } = args;
  const problems: string[] = [];
  const risk = orderRisk(order, market, referencePrice);

  if (!market.tradable) problems.push("Cet instrument n'est pas négociable en ce moment.");

  if (!Number.isFinite(order.size) || order.size <= 0) problems.push("La taille doit être supérieure à zéro.");
  else {
    if (order.size < market.minSize) problems.push(`La taille minimale chez ce courtier est ${market.minSize}.`);
    if (order.size > limits.maxOrderSize) problems.push(`La taille dépasse votre plafond par ordre (${limits.maxOrderSize}).`);
    // Compared on a rounded remainder: a step of 0.1 and a size of 0.3 leave 0.09999999999999998
    // in binary floating point, and refusing that order would be arithmetic, not safety.
    if (market.sizeStep > 0) {
      const steps = order.size / market.sizeStep;
      if (Math.abs(steps - Math.round(steps)) > 1e-6) problems.push(`La taille doit être un multiple de ${market.sizeStep}.`);
    }
  }

  if (order.type === "limit" && (order.limitPrice === undefined || !Number.isFinite(order.limitPrice))) {
    problems.push("Un ordre à cours limité a besoin d'un prix.");
  }

  // A stop on the wrong side of the entry is not a stop — it fills immediately, in the direction
  // of the loss. Worth catching here rather than letting the broker reject it, because the broker's
  // own message will not say which way round it should have been.
  const entry = order.type === "limit" ? order.limitPrice ?? referencePrice : referencePrice;
  if (order.stopLoss !== undefined && entry !== null && entry !== undefined) {
    if (order.side === "buy" && order.stopLoss >= entry) problems.push("À l'achat, le stop doit être sous le prix d'entrée.");
    if (order.side === "sell" && order.stopLoss <= entry) problems.push("À la vente, le stop doit être au-dessus du prix d'entrée.");
  }
  if (order.takeProfit !== undefined && entry !== null && entry !== undefined) {
    if (order.side === "buy" && order.takeProfit <= entry) problems.push("À l'achat, l'objectif doit être au-dessus du prix d'entrée.");
    if (order.side === "sell" && order.takeProfit >= entry) problems.push("À la vente, l'objectif doit être sous le prix d'entrée.");
  }

  if (day.ordersToday >= limits.maxOrdersPerDay) {
    problems.push(`Plafond du jour atteint : ${limits.maxOrdersPerDay} ordres.`);
  }
  if (day.pnlToday <= -limits.maxDailyLoss) {
    problems.push(`Perte du jour atteinte : ${limits.maxDailyLoss}. Les ordres sont bloqués jusqu'à demain.`);
  }

  if (risk !== null && risk > limits.maxRiskPerOrder) {
    problems.push(`Risque de ${risk.toFixed(2)} au stop, au-dessus de votre plafond de ${limits.maxRiskPerOrder}.`);
  }

  // Automatic mode is the one nobody is watching, so the two things a human would have noticed are
  // required rather than suggested: a stop, and a risk that could actually be worked out.
  if (mode === "auto") {
    if (order.stopLoss === undefined) problems.push("En mode automatique, un ordre sans stop est refusé.");
    else if (risk === null) problems.push("En mode automatique, un ordre dont le risque ne peut pas être chiffré est refusé.");
  }

  return { ok: problems.length === 0, problems, risk };
}

/** A fresh client order id.
 *
 *  Random rather than sequential: two tabs of the same app would otherwise generate the same ids
 *  and a broker honouring them would silently drop the second tab's orders as duplicates. */
export function newClientOrderId(): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Math.random()}`.slice(2);
  return `lq-${Date.now().toString(36)}-${random.replace(/-/g, "").slice(0, 12)}`;
}

/** What the environment is called on screen, and how loudly. */
export const ENVIRONMENT_LABEL: Record<BrokerEnvironment, string> = {
  demo: "Démo",
  live: "Réel",
};
