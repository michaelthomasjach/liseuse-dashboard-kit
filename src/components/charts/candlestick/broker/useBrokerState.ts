import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_BROKER_LIMITS,
  checkOrder,
  newClientOrderId,
  type BrokerDayState,
  type BrokerLimits,
  type BrokerMode,
} from "./brokerSafety";
import type {
  BrokerAccount,
  BrokerAdapter,
  BrokerEnvironment,
  BrokerMarket,
  BrokerOrderRequest,
  BrokerOrderResult,
  BrokerPosition,
  BrokerSession,
} from "./interfaces/Broker.interface";

/** One line of the journal: what was sent, when, and what came back.
 *
 *  Kept for every attempt including the refused ones, because "why did nothing happen" is the
 *  question this feature will be asked most often, and a journal that only records successes
 *  cannot answer it. */
export interface BrokerJournalEntry {
  id: string;
  at: number;
  order: BrokerOrderRequest;
  /** Absent while in flight. */
  result?: BrokerOrderResult;
  /** Set when the library itself refused to send — a limit, a malformed ticket. The order then
   *  never reached the adapter at all, which the journal says in as many words. */
  blocked?: string[];
}

/** An order raised by a strategy and waiting for a person, in `confirm` mode. */
export interface PendingBrokerOrder {
  order: BrokerOrderRequest;
  market: BrokerMarket;
  /** Epoch ms after which it is dropped rather than sent. */
  expiresAt: number;
  referencePrice: number | null;
}

/** Where the mode, the arming and the limits are kept between visits.
 *
 *  Persisting an *armed* automation is the riskiest thing in this feature and it is a deliberate
 *  choice: a reopened tab comes back ready to trade. Two things make that survivable — the
 *  connection itself is never stored, so a restored tab is armed but logged out, and the panel
 *  leads with a banner naming the mode and the environment. */
const STORAGE_KEY = "lq-broker-state";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readStored(): { mode: BrokerMode; armed: boolean; limits: BrokerLimits } {
  const fallback = { mode: "manual" as BrokerMode, armed: false, limits: DEFAULT_BROKER_LIMITS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<{ mode: BrokerMode; armed: boolean; limits: BrokerLimits }>;
    return {
      mode: parsed.mode === "confirm" || parsed.mode === "auto" ? parsed.mode : "manual",
      // Only ever restored alongside the mode it was armed for: armed-but-manual is not a state
      // anything should be able to come back in.
      armed: parsed.armed === true && parsed.mode === "auto",
      // Merged over the defaults, so a limit added to this library after someone stored their
      // settings comes back as its default rather than as `undefined` — which every comparison
      // would then pass.
      limits: { ...DEFAULT_BROKER_LIMITS, ...(parsed.limits ?? {}) },
    };
  } catch {
    return fallback;
  }
}

export interface UseBrokerStateArgs {
  /** Every broker the host offers. **This library ships none**: an empty list is the normal state
   *  and the connection modal says so plainly rather than looking broken. */
  adapters: BrokerAdapter[];
  /** The account's realised change today, from the host. This library never sees a fill, so it
   *  cannot compute one — and a daily-loss limit checked against a number this library invented
   *  would be worse than no limit. Absent, the loss limit simply never triggers, and the panel
   *  says so. */
  pnlToday?: number;
}

/** The whole trading side of the workspace: which broker is connected, in which environment, how
 *  strategy signals reach it, what has been submitted, and every ceiling in the way.
 *
 *  It places nothing itself. Every call that leaves the browser goes through the adapter the host
 *  supplied — see `BrokerAdapter`, and the reasoning there for why a front-end library must not be
 *  the thing holding credentials or signing orders. */
export function useBrokerState({ adapters, pnlToday }: UseBrokerStateArgs) {
  const [session, setSession] = useState<BrokerSession | null>(null);
  const [adapterId, setAdapterId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<BrokerAccount[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [mode, setMode] = useState<BrokerMode>(() => readStored().mode);
  const [armed, setArmed] = useState<boolean>(() => readStored().armed);
  const [limits, setLimits] = useState<BrokerLimits>(() => readStored().limits);

  // Kept across reloads, deliberately — see `STORAGE_KEY`. The *connection* never is: a reopened
  // tab comes back armed but disconnected, so nothing can be sent until someone logs in again.
  // That is the one thing standing between a restored tab and a live order, and it is the reason
  // the panel shouts about being armed.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, armed, limits }));
    } catch {
      // A browser refusing storage (private mode, blocked site data) is not a reason to stop
      // trading — it only means the choice will not survive the reload.
    }
  }, [mode, armed, limits]);

  const [journal, setJournal] = useState<BrokerJournalEntry[]>([]);
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [pending, setPending] = useState<PendingBrokerOrder | null>(null);
  // Read inside callbacks that must see the *current* pending order rather than the one captured
  // when they were created — `raiseFromStrategy` and `confirmPending` both run long after.
  const pendingRef = useRef<PendingBrokerOrder | null>(null);
  pendingRef.current = pending;

  const adapter = useMemo(() => adapters.find((a) => a.id === adapterId) ?? null, [adapters, adapterId]);

  /** Orders sent today, counted the moment `submit` decides to send rather than when React next
   *  renders. Two clicks a frame apart both read the same `day` memo, and both would pass a cap
   *  with one slot left — a counter that updates synchronously is the only thing that closes
   *  that. Reset when the day rolls over. */
  const sentTodayRef = useRef<{ day: string; count: number }>({ day: today(), count: 0 });
  /** Journal ids, monotonic. Derived from the journal's length they collided between two orders
   *  raised in the same tick, and the second overwrote the first's line. */
  const entrySeqRef = useRef(0);

  /** Orders submitted today. Counted from the journal rather than kept as a number, so it can never
   *  disagree with the list the user is looking at. */
  const day: BrokerDayState = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const since = startOfDay.getTime();
    const fromJournal = journal.filter((entry) => entry.at >= since && entry.blocked === undefined).length;
    if (sentTodayRef.current.day !== today()) sentTodayRef.current = { day: today(), count: 0 };
    return {
      // The larger of the two: the journal is the record, the ref is what has been decided this
      // instant and not yet rendered.
      ordersToday: Math.max(fromJournal, sentTodayRef.current.count),
      pnlToday: pnlToday ?? 0,
    };
  }, [journal, pnlToday]);

  const connect = useCallback(
    async (id: string, values: Record<string, string>, environment: BrokerEnvironment) => {
      const target = adapters.find((a) => a.id === id);
      if (!target) return;
      setConnecting(true);
      setConnectionError(null);
      try {
        const opened = await target.connect(values, environment);
        setSession(opened);
        setAdapterId(id);
        setAccounts(await target.accounts(opened));
      } catch (error) {
        // Shown verbatim. A connection failure the user cannot read is a connection failure they
        // will retype their password against.
        setConnectionError(error instanceof Error ? error.message : String(error));
        setSession(null);
      } finally {
        setConnecting(false);
      }
    },
    [adapters],
  );

  const disconnect = useCallback(async () => {
    if (adapter && session) await adapter.disconnect(session).catch(() => undefined);
    setSession(null);
    setAccounts([]);
    setPositions([]);
    setPending(null);
    // Disconnecting disarms. Reconnecting to a different account with automation still live is the
    // one sequence where a persisted armed state could genuinely surprise someone.
    setArmed(false);
  }, [adapter, session]);

  const refreshPositions = useCallback(async () => {
    if (!adapter || !session) return;
    setPositions(await adapter.positions(session).catch(() => []));
  }, [adapter, session]);

  /** Submits one order, after checking it against every limit.
   *
   *  The single way an order leaves this library — the ticket, the confirmation of a pending order
   *  and the automatic path all come through here, so none of them can be checked less strictly
   *  than another. Returns the journal entry so a caller can report what happened without reading
   *  state back.
   */
  const submit = useCallback(
    async (order: BrokerOrderRequest, market: BrokerMarket, referencePrice: number | null): Promise<BrokerJournalEntry> => {
      // Read through the ref, not the memo: the memo is a render old, and the whole point of the
      // cap is the order that would be the one too many.
      if (sentTodayRef.current.day !== today()) sentTodayRef.current = { day: today(), count: 0 };
      const liveDay = { ...day, ordersToday: Math.max(day.ordersToday, sentTodayRef.current.count) };
      const verdict = checkOrder({ order, market, limits, day: liveDay, mode, referencePrice });
      const id = `entry-${entrySeqRef.current++}`;
      if (!verdict.ok) {
        const blocked: BrokerJournalEntry = { id, at: Date.now(), order, blocked: verdict.problems };
        setJournal((entries) => [blocked, ...entries]);
        // A breach in automatic mode disarms rather than skipping one order: a limit that only
        // stops the order that hit it leaves the strategy running into the same wall next bar.
        if (mode === "auto") setArmed(false);
        return blocked;
      }
      if (!adapter || !session) {
        const blocked: BrokerJournalEntry = { id, at: Date.now(), order, blocked: ["Aucun courtier connecté."] };
        setJournal((entries) => [blocked, ...entries]);
        return blocked;
      }

      // Counted before the call, not after it: an order that times out has still been sent.
      sentTodayRef.current.count += 1;
      const inFlight: BrokerJournalEntry = { id, at: Date.now(), order };
      setJournal((entries) => [inFlight, ...entries]);
      let result: BrokerOrderResult;
      try {
        result = await adapter.placeOrder(session, order);
      } catch (error) {
        result = { status: "rejected", reason: error instanceof Error ? error.message : String(error) };
      }
      const settled: BrokerJournalEntry = { ...inFlight, result };
      setJournal((entries) => entries.map((entry) => (entry.id === id ? settled : entry)));
      // A rejection disarms automation too. Never a retry: this library cannot know whether a
      // timed-out order actually landed, and guessing that one costs money.
      if (result.status === "rejected" && mode === "auto") setArmed(false);
      void refreshPositions();
      return settled;
    },
    [adapter, session, limits, day, mode, refreshPositions],
  );

  /** Raises an order a strategy asked for, and routes it by mode.
   *
   *  `manual` hands it back for the ticket to pre-fill and does nothing else. `confirm` parks it
   *  with a deadline. `auto` submits it, but only while armed — the mode alone is not permission.
   */
  const raiseFromStrategy = useCallback(
    async (args: {
      order: Omit<BrokerOrderRequest, "clientOrderId">;
      market: BrokerMarket;
      referencePrice: number | null;
      confirmSeconds: number;
    }): Promise<{ routed: "ticket" | "pending" | "submitted" | "ignored"; entry?: BrokerJournalEntry }> => {
      const order: BrokerOrderRequest = { ...args.order, clientOrderId: newClientOrderId() };
      if (mode === "manual") return { routed: "ticket" };
      if (mode === "confirm") {
        // One at a time. Replacing a pending order with a newer one would make an order somebody
        // was about to confirm vanish under their cursor, and dropping the new one silently would
        // be no better — so it is refused out loud, in the journal.
        if (pendingRef.current !== null && pendingRef.current.expiresAt > Date.now()) {
          const entry: BrokerJournalEntry = {
            id: `entry-${entrySeqRef.current++}`,
            at: Date.now(),
            order,
            blocked: ["Un ordre attend déjà votre confirmation."],
          };
          setJournal((entries) => [entry, ...entries]);
          return { routed: "ignored", entry };
        }
        setPending({ order, market: args.market, referencePrice: args.referencePrice, expiresAt: Date.now() + args.confirmSeconds * 1000 });
        return { routed: "pending" };
      }
      if (!armed) return { routed: "ignored" };
      return { routed: "submitted", entry: await submit(order, args.market, args.referencePrice) };
    },
    [mode, armed, submit],
  );

  /** Sends the order that was waiting, if it is still allowed to be sent.
   *
   *  The deadline is enforced here and not only by the countdown in the panel: the countdown stops
   *  existing the moment the panel is closed, and an order confirmed ten minutes late is a
   *  different trade wearing the numbers of one that made sense once. */
  const confirmPending = useCallback(async (): Promise<BrokerJournalEntry | null> => {
    const waiting = pendingRef.current;
    if (waiting === null) return null;
    setPending(null);
    if (Date.now() > waiting.expiresAt) {
      const entry: BrokerJournalEntry = {
        id: `entry-${entrySeqRef.current++}`,
        at: Date.now(),
        order: waiting.order,
        blocked: ["Le délai de confirmation est passé : cet ordre a été abandonné."],
      };
      setJournal((entries) => [entry, ...entries]);
      return entry;
    }
    return submit(waiting.order, waiting.market, waiting.referencePrice);
  }, [submit]);

  /** Closes a position, through the journal like everything else.
   *
   *  Closing is an order. Called straight on the adapter it left no trace, which is exactly the
   *  kind of gap that makes a journal untrustworthy — the one record of what this library did
   *  would have been missing the half that reduces risk. */
  const closePosition = useCallback(
    async (positionId: string, size?: number): Promise<BrokerOrderResult | null> => {
      if (!adapter || !session) return null;
      const position = positions.find((entry) => entry.id === positionId);
      const id = `entry-${entrySeqRef.current++}`;
      const order: BrokerOrderRequest = {
        clientOrderId: newClientOrderId(),
        epic: position?.epic ?? positionId,
        // The closing side is the opposite of the position's own, which is what the journal should
        // read: a long closed is a sell.
        side: position?.side === "buy" ? "sell" : "buy",
        type: "market",
        size: size ?? position?.size ?? 0,
      };
      setJournal((entries) => [{ id, at: Date.now(), order }, ...entries]);
      let result: BrokerOrderResult;
      try {
        result = await adapter.closePosition(session, positionId, size);
      } catch (error) {
        result = { status: "rejected", reason: error instanceof Error ? error.message : String(error) };
      }
      setJournal((entries) => entries.map((entry) => (entry.id === id ? { ...entry, result } : entry)));
      void refreshPositions();
      return result;
    },
    [adapter, session, positions, refreshPositions],
  );

  /** Everything stops. Disarms automation and drops whatever was waiting for a decision; closing
   *  open positions is deliberately *not* done here — it is a trade of its own, and a button that
   *  silently sells is not a safety feature. */
  const killSwitch = useCallback(() => {
    setArmed(false);
    setPending(null);
    setMode("manual");
  }, []);

  return {
    adapters,
    adapter,
    session,
    accounts,
    connecting,
    connectionError,
    connect,
    disconnect,
    mode,
    setMode,
    armed,
    setArmed,
    limits,
    setLimits,
    day,
    /** True when the host never told us the account's P&L, so the daily-loss ceiling cannot bite.
     *  Surfaced rather than hidden: a limit that silently never applies is worse than no limit. */
    dailyLossUnknown: pnlToday === undefined,
    journal,
    positions,
    refreshPositions,
    pending,
    setPending,
    submit,
    raiseFromStrategy,
    confirmPending,
    closePosition,
    killSwitch,
  };
}

export type BrokerState = ReturnType<typeof useBrokerState>;
